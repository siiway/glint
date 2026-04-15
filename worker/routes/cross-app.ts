/**
 * Cross-application API routes.
 *
 * Bearer-token-authenticated data endpoints for external apps calling Glint
 * on behalf of a user. Scope definitions and access rules are managed directly
 * in Prism — no registration in Glint required.
 */

import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { getTeamRole } from "../auth";
import { hasPermission } from "../permissions";
import { requireCrossAppAuth } from "../cross-app-auth";

const crossApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─────────────────────────────────────────────────────────────────────────────
// Data endpoints  (bearer token auth)
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/cross-app/teams/:teamId/sets
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

    return c.json({ sets: result.results.map((r) => ({ id: r.id, name: r.name })) });
  },
);

// GET /api/cross-app/teams/:teamId/sets/:setId/todos
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

// POST /api/cross-app/teams/:teamId/sets/:setId/todos
crossApp.post(
  "/api/cross-app/teams/:teamId/sets/:setId/todos",
  requireCrossAppAuth("write_todos"),
  async (c) => {
    const teamId = c.req.param("teamId");
    const setId = c.req.param("setId");
    const session = c.get("session");
    const role = getTeamRole(c.get("session"), teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    if (!(await hasPermission(c.env.DB, teamId, role, "create_todos"))) {
      return c.json({ error: "No permission to create todos" }, 403);
    }

    const { title, parentId } = await c.req.json<{
      title: string;
      parentId?: string;
    }>();
    if (!title?.trim()) return c.json({ error: "title is required" }, 400);

    // Verify set belongs to team
    const set = await c.env.DB.prepare(
      "SELECT id FROM todo_sets WHERE id = ? AND team_id = ?",
    )
      .bind(setId, teamId)
      .first();
    if (!set) return c.json({ error: "Set not found" }, 404);

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

// PATCH /api/cross-app/teams/:teamId/todos/:todoId
crossApp.patch(
  "/api/cross-app/teams/:teamId/todos/:todoId",
  requireCrossAppAuth("write_todos"),
  async (c) => {
    const teamId = c.req.param("teamId");
    const todoId = c.req.param("todoId");
    const session = c.get("session");
    const role = getTeamRole(c.get("session"), teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const todo = await c.env.DB.prepare(
      "SELECT user_id FROM todos WHERE id = ? AND team_id = ?",
    )
      .bind(todoId, teamId)
      .first<{ user_id: string }>();
    if (!todo) return c.json({ error: "Not found" }, 404);

    const isOwn = todo.user_id === session.userId;
    const patch = await c.req.json<{
      title?: string;
      completed?: boolean;
    }>();

    if (patch.title !== undefined) {
      const canEdit = isOwn
        ? await hasPermission(c.env.DB, teamId, role, "edit_own_todos")
        : await hasPermission(c.env.DB, teamId, role, "edit_any_todo");
      if (!canEdit) return c.json({ error: "No permission to edit this todo" }, 403);
      await c.env.DB.prepare(
        "UPDATE todos SET title = ?, updated_at = ? WHERE id = ? AND team_id = ?",
      )
        .bind(patch.title.trim(), new Date().toISOString(), todoId, teamId)
        .run();
    }

    if (patch.completed !== undefined) {
      await c.env.DB.prepare(
        "UPDATE todos SET completed = ?, updated_at = ? WHERE id = ? AND team_id = ?",
      )
        .bind(patch.completed ? 1 : 0, new Date().toISOString(), todoId, teamId)
        .run();
    }

    return c.json({ ok: true });
  },
);

// DELETE /api/cross-app/teams/:teamId/todos/:todoId
crossApp.delete(
  "/api/cross-app/teams/:teamId/todos/:todoId",
  requireCrossAppAuth("delete_todos"),
  async (c) => {
    const teamId = c.req.param("teamId");
    const todoId = c.req.param("todoId");
    const session = c.get("session");
    const role = getTeamRole(c.get("session"), teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const todo = await c.env.DB.prepare(
      "SELECT user_id FROM todos WHERE id = ? AND team_id = ?",
    )
      .bind(todoId, teamId)
      .first<{ user_id: string }>();
    if (!todo) return c.json({ error: "Not found" }, 404);

    const isOwn = todo.user_id === session.userId;
    const canDelete = isOwn
      ? await hasPermission(c.env.DB, teamId, role, "delete_own_todos")
      : await hasPermission(c.env.DB, teamId, role, "delete_any_todo");
    if (!canDelete) return c.json({ error: "No permission to delete this todo" }, 403);

    await c.env.DB.prepare(
      "DELETE FROM todos WHERE id = ? AND team_id = ?",
    )
      .bind(todoId, teamId)
      .run();

    return c.json({ ok: true });
  },
);

export default crossApp;
