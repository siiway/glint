import { Hono } from "hono";
import type { Bindings, Variables, PermissionKey } from "../types";
import { PERMISSION_KEYS } from "../types";
import { requireAuth, getTeamRole } from "../auth";
import { hasPermission } from "../permissions";

const todos = new Hono<{ Bindings: Bindings; Variables: Variables }>();

todos.get("/api/teams/:teamId/sets/:setId/todos", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const setId = c.req.param("setId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "view_todos", setId))) {
    return c.json({ error: "No permission to view todos in this set" }, 403);
  }

  const result = await c.env.DB.prepare(
    "SELECT id, user_id, parent_id, title, completed, sort_order, created_at, updated_at FROM todos WHERE set_id = ? AND team_id = ? ORDER BY sort_order ASC, created_at ASC",
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

  const perms: Record<string, boolean> = {};
  for (const key of PERMISSION_KEYS) {
    perms[key] = await hasPermission(c.env.DB, teamId, role, key, setId);
  }

  return c.json({
    todos: result.results.map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      parentId: (row.parent_id as string) || null,
      title: row.title as string,
      completed: row.completed === 1,
      sortOrder: row.sort_order as number,
      commentCount: countMap[row.id as string] ?? 0,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    })),
    role,
    permissions: perms,
  });
});

todos.post("/api/teams/:teamId/sets/:setId/todos", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const setId = c.req.param("setId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const { title, parentId } = await c.req.json<{
    title: string;
    parentId?: string;
  }>();
  if (!title?.trim()) return c.json({ error: "Title is required" }, 400);

  const permKey: PermissionKey = parentId ? "add_subtodos" : "create_todos";
  if (!(await hasPermission(c.env.DB, teamId, role, permKey, setId))) {
    return c.json({ error: `No permission: ${permKey}` }, 403);
  }

  if (parentId) {
    const parent = await c.env.DB.prepare(
      "SELECT id FROM todos WHERE id = ? AND set_id = ? AND team_id = ?",
    )
      .bind(parentId, setId, teamId)
      .first();
    if (!parent) return c.json({ error: "Parent todo not found" }, 404);
  }

  const maxRow = await c.env.DB.prepare(
    `SELECT COALESCE(MAX(sort_order), 0) as m FROM todos WHERE ${
      parentId ? "parent_id = ?" : "set_id = ? AND parent_id IS NULL"
    } AND team_id = ?`,
  )
    .bind(parentId ?? setId, teamId)
    .first<{ m: number }>();

  const id = crypto.randomUUID();
  const sortOrder = (maxRow?.m ?? 0) + 1;

  await c.env.DB.prepare(
    "INSERT INTO todos (id, set_id, team_id, user_id, parent_id, title, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      id,
      setId,
      teamId,
      session.userId,
      parentId ?? null,
      title.trim(),
      sortOrder,
    )
    .run();

  return c.json(
    {
      todo: {
        id,
        userId: session.userId,
        parentId: parentId ?? null,
        title: title.trim(),
        completed: false,
        sortOrder,
        commentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
    201,
  );
});

todos.patch("/api/teams/:teamId/todos/:id", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const todoId = c.req.param("id");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const existing = await c.env.DB.prepare(
    "SELECT id, user_id, set_id FROM todos WHERE id = ? AND team_id = ?",
  )
    .bind(todoId, teamId)
    .first<{ id: string; user_id: string; set_id: string }>();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const isOwner = existing.user_id === session.userId;
  const body = await c.req.json<{
    title?: string;
    completed?: boolean;
    sortOrder?: number;
  }>();

  if (body.title !== undefined) {
    const perm: PermissionKey = isOwner ? "edit_own_todos" : "edit_any_todo";
    if (!(await hasPermission(c.env.DB, teamId, role, perm, existing.set_id))) {
      return c.json({ error: "No permission to edit" }, 403);
    }
  }
  if (body.completed !== undefined && !isOwner) {
    if (
      !(await hasPermission(
        c.env.DB,
        teamId,
        role,
        "complete_any_todo",
        existing.set_id,
      ))
    ) {
      return c.json({ error: "No permission to toggle completion" }, 403);
    }
  }
  if (body.sortOrder !== undefined) {
    if (
      !(await hasPermission(
        c.env.DB,
        teamId,
        role,
        "reorder_todos",
        existing.set_id,
      ))
    ) {
      return c.json({ error: "No permission to reorder" }, 403);
    }
  }

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (body.title !== undefined) {
    updates.push("title = ?");
    values.push(body.title.trim());
  }
  if (body.completed !== undefined) {
    updates.push("completed = ?");
    values.push(body.completed ? 1 : 0);
  }
  if (body.sortOrder !== undefined) {
    updates.push("sort_order = ?");
    values.push(body.sortOrder);
  }

  if (updates.length === 0) return c.json({ error: "No updates" }, 400);

  updates.push("updated_at = datetime('now')");
  values.push(todoId, teamId);

  await c.env.DB.prepare(
    `UPDATE todos SET ${updates.join(", ")} WHERE id = ? AND team_id = ?`,
  )
    .bind(...values)
    .run();

  return c.json({ ok: true });
});

todos.post("/api/teams/:teamId/todos/reorder", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "reorder_todos"))) {
    return c.json({ error: "No permission to reorder" }, 403);
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
});

todos.delete("/api/teams/:teamId/todos/:id", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const todoId = c.req.param("id");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const existing = await c.env.DB.prepare(
    "SELECT user_id, set_id FROM todos WHERE id = ? AND team_id = ?",
  )
    .bind(todoId, teamId)
    .first<{ user_id: string; set_id: string }>();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const isOwner = existing.user_id === session.userId;
  const perm: PermissionKey = isOwner ? "delete_own_todos" : "delete_any_todo";
  if (!(await hasPermission(c.env.DB, teamId, role, perm, existing.set_id))) {
    return c.json({ error: "No permission to delete" }, 403);
  }

  await c.env.DB.prepare("DELETE FROM todos WHERE id = ? AND team_id = ?")
    .bind(todoId, teamId)
    .run();

  return c.json({ ok: true });
});

export default todos;
