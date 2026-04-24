/**
 * Cross-application API routes.
 *
 * Bearer-token-authenticated data endpoints for external apps calling Glint
 * on behalf of a user. Scope definitions and access rules are managed directly
 * in Prism — no registration in Glint required.
 *
 * Scope → Glint permission mapping:
 *   read_todos      → view_todos                           (GET sets, todos, comments)
 *   create_todos    → create_todos / add_subtodos          (POST todo)
 *   edit_todos      → edit_own_todos / edit_any_todo       (PATCH todo title)
 *   complete_todos  → complete_any_todo                    (PATCH todo completion)
 *   delete_todos    → delete_own_todos / delete_any_todo   (DELETE todo)
 *   manage_sets     → manage_sets                         (POST/PATCH/DELETE set)
 *   read_settings   → (team membership only)              (GET settings)
 *   manage_settings → manage_settings                     (PATCH settings)
 *   comment         → comment                             (POST comment)
 *   delete_comments → delete_own_comments / delete_any_comment (DELETE comment)
 *   write_todos     → legacy catch-all for create/edit/complete
 */

import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { getTeamRole } from "../auth";
import { hasPermission } from "../permissions";
import { getTeamSettings, setTeamSettings } from "../config";
import type { TeamSettings } from "../types";
import { requireCrossAppAuth, hasCrossAppScope } from "../cross-app-auth";

const crossApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─────────────────────────────────────────────────────────────────────────────
// Sets — read (covered by read_todos scope)
// ─────────────────────────────────────────────────────────────────────────────

crossApp.get(
  "/api/cross-app/teams/:teamId/sets",
  requireCrossAppAuth("read_todos"),
  async (c) => {
    const teamId = c.req.param("teamId");
    const role = getTeamRole(c.get("session"), teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const result = await c.env.DB.prepare(
      "SELECT id, name, sort_order FROM todo_sets WHERE team_id = ? ORDER BY sort_order ASC, created_at ASC",
    )
      .bind(teamId)
      .all();

    return c.json({
      sets: result.results.map((r) => ({ id: r.id, name: r.name })),
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Sets — manage (manage_sets scope)
// ─────────────────────────────────────────────────────────────────────────────

crossApp.post(
  "/api/cross-app/teams/:teamId/sets",
  requireCrossAppAuth("manage_sets"),
  async (c) => {
    const teamId = c.req.param("teamId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
      return c.json({ error: "No permission to manage sets" }, 403);
    }

    const { name } = await c.req.json<{ name: string }>();
    if (!name?.trim()) return c.json({ error: "name is required" }, 400);

    const maxRow = await c.env.DB.prepare(
      "SELECT COALESCE(MAX(sort_order), 0) as m FROM todo_sets WHERE team_id = ?",
    )
      .bind(teamId)
      .first<{ m: number }>();

    const id = crypto.randomUUID();
    const sortOrder = (maxRow?.m ?? 0) + 1;
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      "INSERT INTO todo_sets (id, team_id, user_id, name, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(id, teamId, session.userId, name.trim(), sortOrder, now)
      .run();

    return c.json(
      { set: { id, name: name.trim(), sortOrder, createdAt: now } },
      201,
    );
  },
);

crossApp.patch(
  "/api/cross-app/teams/:teamId/sets/:setId",
  requireCrossAppAuth("manage_sets"),
  async (c) => {
    const teamId = c.req.param("teamId");
    const setId = c.req.param("setId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    // manage_sets required; owners of their own set may rename without it
    // (mirrors regular route logic).
    if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
      const existing = await c.env.DB.prepare(
        "SELECT user_id FROM todo_sets WHERE id = ? AND team_id = ?",
      )
        .bind(setId, teamId)
        .first<{ user_id: string }>();
      if (!existing || existing.user_id !== session.userId) {
        return c.json({ error: "No permission to manage sets" }, 403);
      }
    }

    const body = await c.req.json<{ name?: string }>();
    if (body.name !== undefined && !body.name.trim()) {
      return c.json({ error: "name must not be empty" }, 400);
    }

    const updates: string[] = [];
    const values: (string | number)[] = [];
    if (body.name !== undefined) {
      updates.push("name = ?");
      values.push(body.name.trim());
    }
    if (updates.length === 0) return c.json({ error: "No updates" }, 400);

    updates.push("updated_at = datetime('now')");
    values.push(setId, teamId);

    await c.env.DB.prepare(
      `UPDATE todo_sets SET ${updates.join(", ")} WHERE id = ? AND team_id = ?`,
    )
      .bind(...values)
      .run();

    return c.json({ ok: true });
  },
);

crossApp.delete(
  "/api/cross-app/teams/:teamId/sets/:setId",
  requireCrossAppAuth("manage_sets"),
  async (c) => {
    const teamId = c.req.param("teamId");
    const setId = c.req.param("setId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
      const existing = await c.env.DB.prepare(
        "SELECT user_id FROM todo_sets WHERE id = ? AND team_id = ?",
      )
        .bind(setId, teamId)
        .first<{ user_id: string }>();
      if (!existing || existing.user_id !== session.userId) {
        return c.json({ error: "No permission to manage sets" }, 403);
      }
    }

    await c.env.DB.prepare("DELETE FROM todo_sets WHERE id = ? AND team_id = ?")
      .bind(setId, teamId)
      .run();

    return c.json({ ok: true });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Todos — read
// ─────────────────────────────────────────────────────────────────────────────

crossApp.get(
  "/api/cross-app/teams/:teamId/sets/:setId/todos",
  requireCrossAppAuth("read_todos"),
  async (c) => {
    const teamId = c.req.param("teamId");
    const setId = c.req.param("setId");
    const role = getTeamRole(c.get("session"), teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    if (!(await hasPermission(c.env.DB, teamId, role, "view_todos", setId))) {
      return c.json({ error: "No permission to view todos" }, 403);
    }

    const result = await c.env.DB.prepare(
      "SELECT id, parent_id, title, completed, sort_order, created_at, updated_at FROM todos WHERE set_id = ? AND team_id = ? ORDER BY sort_order ASC, created_at ASC",
    )
      .bind(setId, teamId)
      .all();

    return c.json({
      todos: result.results.map((r) => ({
        id: r.id,
        parentId: r.parent_id,
        title: r.title,
        completed: r.completed === 1,
        sortOrder: r.sort_order,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Todos — write
// ─────────────────────────────────────────────────────────────────────────────

crossApp.post(
  "/api/cross-app/teams/:teamId/sets/:setId/todos",
  requireCrossAppAuth(["create_todos", "write_todos"]),
  async (c) => {
    const teamId = c.req.param("teamId");
    const setId = c.req.param("setId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const { title, parentId } = await c.req.json<{
      title: string;
      parentId?: string;
    }>();
    if (!title?.trim()) return c.json({ error: "title is required" }, 400);

    const permKey = parentId ? "add_subtodos" : "create_todos";
    if (!(await hasPermission(c.env.DB, teamId, role, permKey, setId))) {
      return c.json({ error: `No permission: ${permKey}` }, 403);
    }

    const set = await c.env.DB.prepare(
      "SELECT id FROM todo_sets WHERE id = ? AND team_id = ?",
    )
      .bind(setId, teamId)
      .first();
    if (!set) return c.json({ error: "Set not found" }, 404);

    if (parentId) {
      const parent = await c.env.DB.prepare(
        "SELECT id FROM todos WHERE id = ? AND set_id = ? AND team_id = ?",
      )
        .bind(parentId, setId, teamId)
        .first();
      if (!parent) return c.json({ error: "Parent todo not found" }, 404);
    }

    const maxOrder = await c.env.DB.prepare(
      "SELECT COALESCE(MAX(sort_order), 0) as m FROM todos WHERE set_id = ? AND team_id = ? AND parent_id IS NULL",
    )
      .bind(setId, teamId)
      .first<{ m: number }>();

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      "INSERT INTO todos (id, user_id, set_id, team_id, parent_id, title, completed, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)",
    )
      .bind(
        id,
        session.userId,
        setId,
        teamId,
        parentId ?? null,
        title.trim(),
        (maxOrder?.m ?? 0) + 1,
        now,
        now,
      )
      .run();

    return c.json({
      todo: {
        id,
        parentId: parentId ?? null,
        title: title.trim(),
        completed: false,
        sortOrder: (maxOrder?.m ?? 0) + 1,
        createdAt: now,
        updatedAt: now,
      },
    });
  },
);

crossApp.patch(
  "/api/cross-app/teams/:teamId/todos/:todoId",
  requireCrossAppAuth(["edit_todos", "complete_todos", "write_todos"]),
  async (c) => {
    const teamId = c.req.param("teamId");
    const todoId = c.req.param("todoId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const todo = await c.env.DB.prepare(
      "SELECT user_id, set_id FROM todos WHERE id = ? AND team_id = ?",
    )
      .bind(todoId, teamId)
      .first<{ user_id: string; set_id: string }>();
    if (!todo) return c.json({ error: "Not found" }, 404);

    const isOwn = todo.user_id === session.userId;
    const setId = todo.set_id;
    const patch = await c.req.json<{ title?: string; completed?: boolean }>();

    if (patch.title !== undefined) {
      if (!hasCrossAppScope(c, "edit_todos", "write_todos")) {
        return c.json(
          { error: "Missing required scope: edit_todos or write_todos" },
          403,
        );
      }
      const perm = isOwn ? "edit_own_todos" : "edit_any_todo";
      if (!(await hasPermission(c.env.DB, teamId, role, perm, setId))) {
        return c.json({ error: "No permission to edit this todo" }, 403);
      }
      await c.env.DB.prepare(
        "UPDATE todos SET title = ?, updated_at = ? WHERE id = ? AND team_id = ?",
      )
        .bind(patch.title.trim(), new Date().toISOString(), todoId, teamId)
        .run();
    }

    if (patch.completed !== undefined) {
      if (!hasCrossAppScope(c, "complete_todos", "write_todos")) {
        return c.json(
          { error: "Missing required scope: complete_todos or write_todos" },
          403,
        );
      }
      if (
        !isOwn &&
        !(await hasPermission(
          c.env.DB,
          teamId,
          role,
          "complete_any_todo",
          setId,
        ))
      ) {
        return c.json({ error: "No permission to toggle completion" }, 403);
      }
      await c.env.DB.prepare(
        "UPDATE todos SET completed = ?, updated_at = ? WHERE id = ? AND team_id = ?",
      )
        .bind(patch.completed ? 1 : 0, new Date().toISOString(), todoId, teamId)
        .run();
    }

    return c.json({ ok: true });
  },
);

crossApp.delete(
  "/api/cross-app/teams/:teamId/todos/:todoId",
  requireCrossAppAuth("delete_todos"),
  async (c) => {
    const teamId = c.req.param("teamId");
    const todoId = c.req.param("todoId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const todo = await c.env.DB.prepare(
      "SELECT user_id, set_id FROM todos WHERE id = ? AND team_id = ?",
    )
      .bind(todoId, teamId)
      .first<{ user_id: string; set_id: string }>();
    if (!todo) return c.json({ error: "Not found" }, 404);

    const isOwn = todo.user_id === session.userId;
    const perm = isOwn ? "delete_own_todos" : "delete_any_todo";
    if (!(await hasPermission(c.env.DB, teamId, role, perm, todo.set_id))) {
      return c.json({ error: "No permission to delete this todo" }, 403);
    }

    await c.env.DB.prepare("DELETE FROM todos WHERE id = ? AND team_id = ?")
      .bind(todoId, teamId)
      .run();

    return c.json({ ok: true });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Comments
// ─────────────────────────────────────────────────────────────────────────────

crossApp.get(
  "/api/cross-app/teams/:teamId/todos/:todoId/comments",
  requireCrossAppAuth("read_todos"),
  async (c) => {
    const teamId = c.req.param("teamId");
    const todoId = c.req.param("todoId");
    const role = getTeamRole(c.get("session"), teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const todo = await c.env.DB.prepare(
      "SELECT set_id FROM todos WHERE id = ? AND team_id = ?",
    )
      .bind(todoId, teamId)
      .first<{ set_id: string }>();
    if (!todo) return c.json({ error: "Todo not found" }, 404);

    if (
      !(await hasPermission(c.env.DB, teamId, role, "view_todos", todo.set_id))
    ) {
      return c.json({ error: "No permission to view todos" }, 403);
    }

    const result = await c.env.DB.prepare(
      "SELECT id, user_id, username, body, created_at FROM comments WHERE todo_id = ? ORDER BY created_at ASC",
    )
      .bind(todoId)
      .all();

    return c.json({
      comments: result.results.map((r) => ({
        id: r.id,
        userId: r.user_id,
        username: r.username,
        body: r.body,
        createdAt: r.created_at,
      })),
    });
  },
);

crossApp.post(
  "/api/cross-app/teams/:teamId/todos/:todoId/comments",
  requireCrossAppAuth("comment"),
  async (c) => {
    const teamId = c.req.param("teamId");
    const todoId = c.req.param("todoId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const todo = await c.env.DB.prepare(
      "SELECT set_id FROM todos WHERE id = ? AND team_id = ?",
    )
      .bind(todoId, teamId)
      .first<{ set_id: string }>();
    if (!todo) return c.json({ error: "Todo not found" }, 404);

    if (
      !(await hasPermission(c.env.DB, teamId, role, "comment", todo.set_id))
    ) {
      return c.json({ error: "No permission to comment" }, 403);
    }

    const { body } = await c.req.json<{ body: string }>();
    if (!body?.trim()) return c.json({ error: "body is required" }, 400);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      "INSERT INTO comments (id, todo_id, user_id, username, body, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(id, todoId, session.userId, session.username, body.trim(), now)
      .run();

    return c.json(
      {
        comment: {
          id,
          userId: session.userId,
          username: session.username,
          body: body.trim(),
          createdAt: now,
        },
      },
      201,
    );
  },
);

crossApp.delete(
  "/api/cross-app/teams/:teamId/todos/:todoId/comments/:commentId",
  requireCrossAppAuth("delete_comments"),
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
    if (!todo) return c.json({ error: "Todo not found" }, 404);

    const comment = await c.env.DB.prepare(
      "SELECT user_id FROM comments WHERE id = ? AND todo_id = ?",
    )
      .bind(commentId, todoId)
      .first<{ user_id: string }>();
    if (!comment) return c.json({ error: "Comment not found" }, 404);

    const isOwn = comment.user_id === session.userId;
    const perm = isOwn ? "delete_own_comments" : "delete_any_comment";
    if (!(await hasPermission(c.env.DB, teamId, role, perm, todo.set_id))) {
      return c.json({ error: "No permission to delete this comment" }, 403);
    }

    await c.env.DB.prepare("DELETE FROM comments WHERE id = ?")
      .bind(commentId)
      .run();

    return c.json({ ok: true });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────────

crossApp.get(
  "/api/cross-app/teams/:teamId/settings",
  requireCrossAppAuth("read_settings"),
  async (c) => {
    const teamId = c.req.param("teamId");
    const role = getTeamRole(c.get("session"), teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const s = await getTeamSettings(c.env.KV, teamId);
    return c.json({ settings: s });
  },
);

crossApp.patch(
  "/api/cross-app/teams/:teamId/settings",
  requireCrossAppAuth("manage_settings"),
  async (c) => {
    const teamId = c.req.param("teamId");
    const role = getTeamRole(c.get("session"), teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    if (!(await hasPermission(c.env.DB, teamId, role, "manage_settings"))) {
      return c.json({ error: "No permission to manage settings" }, 403);
    }

    const body = await c.req.json<Partial<TeamSettings>>();

    const allowed: (keyof TeamSettings)[] = [
      "site_name",
      "site_logo_url",
      "accent_color",
      "welcome_message",
      "default_set_name",
      "allow_member_create_sets",
      "default_timezone",
    ];

    const patch: Partial<TeamSettings> = {};
    for (const key of allowed) {
      if (key in body) {
        (patch as Record<string, unknown>)[key] = body[key];
      }
    }

    const s = await setTeamSettings(c.env.KV, teamId, patch);
    return c.json({ settings: s });
  },
);

export default crossApp;
