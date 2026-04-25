import { Hono } from "hono";
import type { Bindings, Variables, PermissionKey } from "../types";
import { requireAuth, getTeamRole, isPersonalSpaceId } from "../auth";
import { getAppConfig } from "../config";
import { hasPermission } from "../permissions";
import { resolveUserProfiles } from "../userProfileCache";

const comments = new Hono<{ Bindings: Bindings; Variables: Variables }>();

comments.get(
  "/api/teams/:teamId/todos/:todoId/comments",
  requireAuth,
  async (c) => {
    const teamId = c.req.param("teamId");
    const todoId = c.req.param("todoId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const todo = await c.env.DB.prepare(
      "SELECT id FROM todos WHERE id = ? AND team_id = ?",
    )
      .bind(todoId, teamId)
      .first();
    if (!todo) return c.json({ error: "Todo not found" }, 404);

    const result = await c.env.DB.prepare(
      "SELECT id, user_id, username, body, created_at FROM comments WHERE todo_id = ? ORDER BY created_at ASC",
    )
      .bind(todoId)
      .all();

    const commenterIds = new Set(
      result.results
        .map((r) => r.user_id as string | null)
        .filter((id): id is string => !!id),
    );
    let nameMap: Record<string, string> = {};
    let avatarMap: Record<string, string> = {};
    if (commenterIds.size > 0) {
      const config = await getAppConfig(c.env.KV);
      const ids = isPersonalSpaceId(teamId, session.userId)
        ? new Set([session.userId])
        : commenterIds;
      ({ nameMap, avatarMap } = await resolveUserProfiles(
        c.env.KV,
        config,
        session,
        teamId,
        ids,
      ));
    }

    return c.json({
      comments: result.results.map((r) => ({
        id: r.id as string,
        userId: r.user_id as string,
        username: r.username as string,
        displayName: nameMap[r.user_id as string] ?? (r.username as string),
        avatarUrl: avatarMap[r.user_id as string] ?? null,
        body: r.body as string,
        createdAt: r.created_at as string,
      })),
    });
  },
);

comments.post(
  "/api/teams/:teamId/todos/:todoId/comments",
  requireAuth,
  async (c) => {
    const teamId = c.req.param("teamId");
    const todoId = c.req.param("todoId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const todo = await c.env.DB.prepare(
      "SELECT id, set_id FROM todos WHERE id = ? AND team_id = ?",
    )
      .bind(todoId, teamId)
      .first<{ id: string; set_id: string }>();
    if (!todo) return c.json({ error: "Todo not found" }, 404);

    if (
      !(await hasPermission(c.env.DB, teamId, role, "comment", todo.set_id))
    ) {
      return c.json({ error: "No permission to comment" }, 403);
    }

    const { body } = await c.req.json<{ body: string }>();
    if (!body?.trim()) return c.json({ error: "Body is required" }, 400);

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO comments (id, todo_id, user_id, username, body) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(id, todoId, session.userId, session.username, body.trim())
      .run();

    return c.json(
      {
        comment: {
          id,
          userId: session.userId,
          username: session.username,
          displayName: session.displayName || session.username,
          avatarUrl: session.avatarUrl || null,
          body: body.trim(),
          createdAt: new Date().toISOString(),
        },
      },
      201,
    );
  },
);

comments.delete(
  "/api/teams/:teamId/todos/:todoId/comments/:commentId",
  requireAuth,
  async (c) => {
    const teamId = c.req.param("teamId");
    const todoId = c.req.param("todoId");
    const commentId = c.req.param("commentId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const todo = await c.env.DB.prepare(
      "SELECT set_id FROM todos WHERE id = ? AND team_id = ?",
    )
      .bind(todoId, teamId)
      .first<{ set_id: string }>();
    if (!todo) return c.json({ error: "Not found" }, 404);

    const existing = await c.env.DB.prepare(
      "SELECT user_id FROM comments WHERE id = ? AND todo_id = ?",
    )
      .bind(commentId, todoId)
      .first<{ user_id: string }>();
    if (!existing) return c.json({ error: "Not found" }, 404);

    const isOwner = existing.user_id === session.userId;
    const perm: PermissionKey = isOwner
      ? "delete_own_comments"
      : "delete_any_comment";
    if (!(await hasPermission(c.env.DB, teamId, role, perm, todo.set_id))) {
      return c.json({ error: "No permission to delete comment" }, 403);
    }

    await c.env.DB.prepare("DELETE FROM comments WHERE id = ?")
      .bind(commentId)
      .run();
    return c.json({ ok: true });
  },
);

export default comments;
