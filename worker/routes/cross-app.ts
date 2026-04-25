/**
 * Cross-application API routes.
 *
 * Bearer-token-authenticated data endpoints for external apps calling Glint
 * on behalf of a user. Scope definitions and access rules are managed directly
 * in Prism — no registration in Glint required.
 *
 * Scope → Glint permission mapping:
 *   read_todos      → view_todos                              (GET sets, todos, comments, export)
 *   create_todos    → create_todos / add_subtodos             (POST todo, import-into-set)
 *   edit_todos      → edit_own_todos / edit_any_todo          (PATCH todo title)
 *   complete_todos  → complete_any_todo                       (PATCH todo completion)
 *   delete_todos    → delete_own_todos / delete_any_todo      (DELETE todo)
 *   reorder_todos   → reorder_todos                           (POST todos/reorder)
 *   claim_todos     → claim_todos                             (POST todos/:id/claim)
 *   manage_sets     → manage_sets                             (POST/PATCH/DELETE set, reorder, import)
 *   read_settings   → (team membership only)                  (GET settings)
 *   manage_settings → manage_settings                         (PATCH settings)
 *   comment         → comment                                 (POST comment)
 *   delete_comments → delete_own_comments / delete_any_comment (DELETE comment)
 *   write_todos     → legacy catch-all for create/edit/complete
 */

import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { getTeamRole, isPersonalSpaceId } from "../auth";
import { hasPermission } from "../permissions";
import { getAppConfig, getTeamSettings, setTeamSettings } from "../config";
import type { TeamSettings } from "../types";
import { requireCrossAppAuth, hasCrossAppScope } from "../cross-app-auth";
import { resolveUserProfiles } from "../userProfileCache";
import {
  buildTransferPayload,
  exportFormatExt,
  insertTransferTodo,
  parseImportContent,
  serializeExport,
  supportsClaimedBy,
  type TransferTodo,
} from "../transfer";

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
      "SELECT id, user_id, name, sort_order, auto_renew, renew_time, timezone, last_renewed_at, split_completed, created_at FROM todo_sets WHERE team_id = ? ORDER BY sort_order ASC, created_at ASC",
    )
      .bind(teamId)
      .all();

    return c.json({
      sets: result.results.map((r) => ({
        id: r.id as string,
        userId: r.user_id as string,
        name: r.name as string,
        sortOrder: r.sort_order as number,
        autoRenew: r.auto_renew === 1,
        renewTime: r.renew_time as string,
        timezone: r.timezone as string,
        lastRenewedAt: (r.last_renewed_at as string) || null,
        splitCompleted: r.split_completed === 1,
        createdAt: r.created_at as string,
      })),
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

    const body = await c.req.json<{
      name?: string;
      autoRenew?: boolean;
      renewTime?: string;
      timezone?: string;
      splitCompleted?: boolean;
    }>();
    if (body.name !== undefined && !body.name.trim()) {
      return c.json({ error: "name must not be empty" }, 400);
    }

    const updates: string[] = [];
    const values: (string | number)[] = [];
    if (body.name !== undefined) {
      updates.push("name = ?");
      values.push(body.name.trim());
    }
    if (body.autoRenew !== undefined) {
      updates.push("auto_renew = ?");
      values.push(body.autoRenew ? 1 : 0);
    }
    if (body.renewTime !== undefined) {
      updates.push("renew_time = ?");
      values.push(body.renewTime);
    }
    if (body.timezone !== undefined) {
      updates.push("timezone = ?");
      values.push(body.timezone);
    }
    if (body.splitCompleted !== undefined) {
      updates.push("split_completed = ?");
      values.push(body.splitCompleted ? 1 : 0);
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
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    if (!(await hasPermission(c.env.DB, teamId, role, "view_todos", setId))) {
      return c.json({ error: "No permission to view todos" }, 403);
    }

    const claimSupported = await supportsClaimedBy(c.env.DB);

    const result = await c.env.DB.prepare(
      `SELECT id, user_id, parent_id, title, completed, sort_order, ${claimSupported ? "claimed_by" : "NULL AS claimed_by"}, created_at, updated_at FROM todos WHERE set_id = ? AND team_id = ? ORDER BY sort_order ASC, created_at ASC`,
    )
      .bind(setId, teamId)
      .all();

    const commentCounts = await c.env.DB.prepare(
      "SELECT todo_id, COUNT(*) as count FROM comments WHERE todo_id IN (SELECT id FROM todos WHERE set_id = ? AND team_id = ?) GROUP BY todo_id",
    )
      .bind(setId, teamId)
      .all();
    const countMap: Record<string, number> = {};
    for (const r of commentCounts.results) {
      countMap[r.todo_id as string] = r.count as number;
    }

    // Resolve claimed_by user IDs to display names via Prism (best-effort).
    const claimedIds = new Set(
      result.results
        .map((r) => r.claimed_by as string | null)
        .filter((id): id is string => !!id),
    );
    let nameMap: Record<string, string> = {};
    let avatarMap: Record<string, string> = {};
    if (claimedIds.size > 0) {
      const config = await getAppConfig(c.env.KV);
      const ids = isPersonalSpaceId(teamId, session.userId)
        ? new Set([session.userId])
        : claimedIds;
      ({ nameMap, avatarMap } = await resolveUserProfiles(
        c.env.KV,
        config,
        session,
        teamId,
        ids,
      ));
    }

    return c.json({
      todos: result.results.map((row) => {
        const claimedBy = (row.claimed_by as string) || null;
        return {
          id: row.id as string,
          userId: row.user_id as string,
          parentId: (row.parent_id as string) || null,
          title: row.title as string,
          completed: row.completed === 1,
          sortOrder: row.sort_order as number,
          commentCount: countMap[row.id as string] ?? 0,
          claimedBy,
          claimedByName: claimedBy ? (nameMap[claimedBy] ?? null) : null,
          claimedByAvatar: claimedBy ? (avatarMap[claimedBy] ?? null) : null,
          createdAt: row.created_at as string,
          updatedAt: row.updated_at as string,
        };
      }),
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

// ─────────────────────────────────────────────────────────────────────────────
// Sets — reorder (manage_sets scope)
// ─────────────────────────────────────────────────────────────────────────────

crossApp.post(
  "/api/cross-app/teams/:teamId/sets/reorder",
  requireCrossAppAuth("manage_sets"),
  async (c) => {
    const teamId = c.req.param("teamId");
    const role = getTeamRole(c.get("session"), teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
      return c.json({ error: "No permission to manage sets" }, 403);
    }

    const { items } = await c.req.json<{
      items: { id: string; sortOrder: number }[];
    }>();
    if (!items?.length) return c.json({ error: "No items" }, 400);

    await c.env.DB.batch(
      items.map(({ id, sortOrder }) =>
        c.env.DB.prepare(
          "UPDATE todo_sets SET sort_order = ?, updated_at = datetime('now') WHERE id = ? AND team_id = ?",
        ).bind(sortOrder, id, teamId),
      ),
    );

    return c.json({ ok: true });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Todos — reorder (reorder_todos scope)
// ─────────────────────────────────────────────────────────────────────────────

crossApp.post(
  "/api/cross-app/teams/:teamId/todos/reorder",
  requireCrossAppAuth("reorder_todos"),
  async (c) => {
    const teamId = c.req.param("teamId");
    const role = getTeamRole(c.get("session"), teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    if (!(await hasPermission(c.env.DB, teamId, role, "reorder_todos"))) {
      return c.json({ error: "No permission to reorder todos" }, 403);
    }

    const { items } = await c.req.json<{
      items: { id: string; sortOrder: number }[];
    }>();
    if (!items?.length) return c.json({ error: "No items" }, 400);

    await c.env.DB.batch(
      items.map(({ id, sortOrder }) =>
        c.env.DB.prepare(
          "UPDATE todos SET sort_order = ?, updated_at = datetime('now') WHERE id = ? AND team_id = ?",
        ).bind(sortOrder, id, teamId),
      ),
    );

    return c.json({ ok: true });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Todos — claim/unclaim (claim_todos scope)
//
// Toggles claim: if currently unclaimed → claims for the caller; if already
// claimed by the caller → releases; if claimed by someone else → 409.
// ─────────────────────────────────────────────────────────────────────────────

crossApp.post(
  "/api/cross-app/teams/:teamId/todos/:todoId/claim",
  requireCrossAppAuth("claim_todos"),
  async (c) => {
    const teamId = c.req.param("teamId");
    const todoId = c.req.param("todoId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    if (!(await supportsClaimedBy(c.env.DB))) {
      return c.json(
        { error: "Claim feature unavailable: database migration required" },
        503,
      );
    }

    const existing = await c.env.DB.prepare(
      "SELECT id, set_id, claimed_by FROM todos WHERE id = ? AND team_id = ?",
    )
      .bind(todoId, teamId)
      .first<{ id: string; set_id: string; claimed_by: string | null }>();
    if (!existing) return c.json({ error: "Not found" }, 404);

    if (
      !(await hasPermission(
        c.env.DB,
        teamId,
        role,
        "claim_todos",
        existing.set_id,
      ))
    ) {
      return c.json({ error: "No permission to claim todos" }, 403);
    }

    if (existing.claimed_by && existing.claimed_by !== session.userId) {
      return c.json({ error: "Already claimed by another user" }, 409);
    }

    const claimedBy =
      existing.claimed_by === session.userId ? null : session.userId;

    await c.env.DB.prepare(
      "UPDATE todos SET claimed_by = ?, updated_at = datetime('now') WHERE id = ? AND team_id = ?",
    )
      .bind(claimedBy, todoId, teamId)
      .run();

    const claimedByName = claimedBy
      ? session.displayName || session.username
      : null;
    const claimedByAvatar = claimedBy ? session.avatarUrl || null : null;

    return c.json({ ok: true, claimedBy, claimedByName, claimedByAvatar });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Sets — export (read_todos scope)
// ─────────────────────────────────────────────────────────────────────────────

crossApp.get(
  "/api/cross-app/teams/:teamId/sets/:setId/export",
  requireCrossAppAuth("read_todos"),
  async (c) => {
    const teamId = c.req.param("teamId");
    const setId = c.req.param("setId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    if (!(await hasPermission(c.env.DB, teamId, role, "view_todos", setId))) {
      return c.json({ error: "No permission to export this set" }, 403);
    }

    const format = (c.req.query("format") || "md").toLowerCase();
    const includeComments = c.req.query("includeComments") === "1";

    let nameMap: Record<string, string> = {};
    if (await supportsClaimedBy(c.env.DB)) {
      const claimedRows = await c.env.DB.prepare(
        "SELECT DISTINCT claimed_by FROM todos WHERE set_id = ? AND team_id = ? AND claimed_by IS NOT NULL",
      )
        .bind(setId, teamId)
        .all();
      const claimedIds = new Set(
        claimedRows.results.map((r) => r.claimed_by as string),
      );
      if (claimedIds.size > 0) {
        const config = await getAppConfig(c.env.KV);
        const ids = isPersonalSpaceId(teamId, session.userId)
          ? new Set([session.userId])
          : claimedIds;
        ({ nameMap } = await resolveUserProfiles(
          c.env.KV,
          config,
          session,
          teamId,
          ids,
        ));
      }
    }

    const payload = await buildTransferPayload(
      c.env.DB,
      teamId,
      setId,
      includeComments,
      nameMap,
    );
    if (!payload) return c.json({ error: "Set not found" }, 404);

    const content = serializeExport(format, payload);
    const ext = exportFormatExt(format);
    return c.json({
      format: ext,
      fileName: `${payload.set.name.replace(/[^a-zA-Z0-9-_]/g, "_")}.${ext}`,
      content,
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Sets — import into existing set (create_todos; replace mode also requires manage_sets)
// ─────────────────────────────────────────────────────────────────────────────

crossApp.post(
  "/api/cross-app/teams/:teamId/sets/:setId/import",
  requireCrossAppAuth(["create_todos", "write_todos"]),
  async (c) => {
    const teamId = c.req.param("teamId");
    const setId = c.req.param("setId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    if (!(await hasPermission(c.env.DB, teamId, role, "create_todos", setId))) {
      return c.json({ error: "No permission to import into this set" }, 403);
    }

    const body = await c.req.json<{
      format?: "md" | "json" | "yaml";
      content: string;
      mode?: "append" | "replace";
      includeComments?: boolean;
      insertAt?: "top" | "bottom";
    }>();
    if (!body.content?.trim())
      return c.json({ error: "Content is required" }, 400);

    const format = (body.format || "md").toLowerCase();
    const includeComments = body.includeComments ?? false;
    const mode = body.mode || "append";
    const insertAt = body.insertAt === "top" ? "top" : "bottom";

    if (mode === "replace") {
      // Replace mode wipes existing todos — gated by manage_sets scope and permission.
      if (!hasCrossAppScope(c, "manage_sets")) {
        return c.json(
          { error: "Replace mode requires manage_sets scope" },
          403,
        );
      }
      if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
        return c.json({ error: "No permission to replace set content" }, 403);
      }
      await c.env.DB.prepare(
        "DELETE FROM todos WHERE set_id = ? AND team_id = ?",
      )
        .bind(setId, teamId)
        .run();
    }

    let todosToImport: TransferTodo[] = [];
    try {
      todosToImport = parseImportContent(format, body.content).todos;
    } catch {
      return c.json({ error: "Failed to parse import content" }, 400);
    }

    if (insertAt === "top" && todosToImport.length > 0) {
      await c.env.DB.prepare(
        "UPDATE todos SET sort_order = sort_order + ? WHERE set_id = ? AND team_id = ? AND parent_id IS NULL",
      )
        .bind(todosToImport.length, setId, teamId)
        .run();
    }

    for (let i = 0; i < todosToImport.length; i++) {
      const todo = todosToImport[i];
      await insertTransferTodo(
        c.env.DB,
        teamId,
        setId,
        session.userId,
        session.username,
        todo,
        includeComments,
        undefined,
        insertAt === "top" ? i + 1 : undefined,
      );
    }

    return c.json({ ok: true, imported: todosToImport.length });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Sets — import as new set (manage_sets scope)
// ─────────────────────────────────────────────────────────────────────────────

crossApp.post(
  "/api/cross-app/teams/:teamId/sets/import",
  requireCrossAppAuth("manage_sets"),
  async (c) => {
    const teamId = c.req.param("teamId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
      return c.json({ error: "No permission to manage sets" }, 403);
    }

    const body = await c.req.json<{
      format?: "md" | "json" | "yaml";
      content: string;
      includeComments?: boolean;
      setId?: string;
      setName?: string;
    }>();
    if (!body.content?.trim())
      return c.json({ error: "Content is required" }, 400);

    const format = (body.format || "md").toLowerCase();
    const includeComments = body.includeComments ?? false;

    let parsed: { todos: TransferTodo[]; setId?: string; setName?: string };
    try {
      parsed = parseImportContent(format, body.content);
    } catch {
      return c.json({ error: "Failed to parse import content" }, 400);
    }

    const setName = (
      body.setName ||
      parsed.setName ||
      (format === "md" ? "Imported Set" : "Imported")
    ).trim();
    if (!setName) return c.json({ error: "Set name is required" }, 400);

    const setId =
      format === "md"
        ? crypto.randomUUID()
        : (body.setId || parsed.setId || crypto.randomUUID()).trim();
    if (!setId) return c.json({ error: "Set id is required" }, 400);

    const existing = await c.env.DB.prepare(
      "SELECT id FROM todo_sets WHERE id = ? AND team_id = ?",
    )
      .bind(setId, teamId)
      .first<{ id: string }>();
    if (existing) return c.json({ error: "Set id already exists" }, 409);

    const maxRow = await c.env.DB.prepare(
      "SELECT COALESCE(MAX(sort_order), 0) as m FROM todo_sets WHERE team_id = ?",
    )
      .bind(teamId)
      .first<{ m: number }>();
    const sortOrder = (maxRow?.m ?? 0) + 1;

    await c.env.DB.prepare(
      "INSERT INTO todo_sets (id, team_id, user_id, name, sort_order) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(setId, teamId, session.userId, setName, sortOrder)
      .run();

    for (const todo of parsed.todos) {
      await insertTransferTodo(
        c.env.DB,
        teamId,
        setId,
        session.userId,
        session.username,
        todo,
        includeComments,
      );
    }

    return c.json({
      ok: true,
      imported: parsed.todos.length,
      set: {
        id: setId,
        userId: session.userId,
        name: setName,
        sortOrder,
        autoRenew: false,
        renewTime: "00:00",
        timezone: "",
        lastRenewedAt: null,
        splitCompleted: false,
      },
    });
  },
);

export default crossApp;
