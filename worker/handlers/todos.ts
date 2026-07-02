/**
 * Shared handlers for todo endpoints.
 * Both routes/todos.ts (cookie-session auth) and routes/cross-app.ts (bearer-token auth)
 * delegate here. Writes broadcast to the team's Durable Object.
 */

import type { Context } from "hono";
import { PERMISSION_KEYS } from "../types";
import type { Bindings, Variables, PermissionKey } from "../types";
import { getTeamRole } from "../auth";
import { getAppConfig } from "../config";
import { hasPermission } from "../permissions";
import { broadcast } from "../realtime";
import { resolveAssignees } from "../assignees";

type Ctx = Context<{ Bindings: Bindings; Variables: Variables }>;

export const listTodos = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const setId = c.req.param("setId")!;
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "view_todos", setId))) {
    return c.json({ error: "No permission to view todos in this set" }, 403);
  }

  const result = await c.env.DB.prepare(
    `SELECT id, user_id, parent_id, title, completed, sort_order, created_at, updated_at FROM todos WHERE set_id = ? AND team_id = ? ORDER BY sort_order ASC, created_at ASC`,
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

  const config = await getAppConfig(c.env.KV);
  const assigneeMap = await resolveAssignees(
    c.env.DB,
    c.env.KV,
    config,
    session,
    teamId,
    result.results.map((r) => r.id as string),
  );

  return c.json({
    todos: result.results.map((row) => {
      const id = row.id as string;
      return {
        id,
        userId: row.user_id as string,
        parentId: (row.parent_id as string) || null,
        title: row.title as string,
        completed: row.completed === 1,
        sortOrder: row.sort_order as number,
        commentCount: countMap[id] ?? 0,
        assignees: assigneeMap.get(id) ?? [],
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      };
    }),
    role,
    permissions: perms,
  });
};

export const createTodo = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const setId = c.req.param("setId")!;
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const { title, parentId } = await c.req.json<{
    title: string;
    parentId?: string;
  }>();
  const trimmedTitle = title?.trim();
  if (!trimmedTitle) return c.json({ error: "Title is required" }, 400);

  const permKey: PermissionKey = parentId ? "add_subtodos" : "create_todos";
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

  const normalizedParentId = parentId ?? null;
  const duplicated = await c.env.DB.prepare(
    "SELECT id FROM todos WHERE set_id = ? AND team_id = ? AND title = ? AND ((parent_id IS NULL AND ? IS NULL) OR parent_id = ?)",
  )
    .bind(setId, teamId, trimmedTitle, normalizedParentId, normalizedParentId)
    .first<{ id: string }>();
  if (duplicated) {
    return c.json(
      { error: "Todo item title already exists among sibling todos" },
      409,
    );
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
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    "INSERT INTO todos (id, set_id, team_id, user_id, parent_id, title, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      id,
      setId,
      teamId,
      session.userId,
      parentId ?? null,
      trimmedTitle,
      sortOrder,
      now,
      now,
    )
    .run();

  const newTodo = {
    id,
    userId: session.userId,
    parentId: parentId ?? null,
    title: trimmedTitle,
    completed: false,
    sortOrder,
    commentCount: 0,
    assignees: [],
    createdAt: now,
    updatedAt: now,
  };

  broadcast(c.env, teamId, { type: "todo:created", setId, todo: newTodo });
  return c.json({ todo: newTodo }, 201);
};

export const patchTodo = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const todoId = (c.req.param("id") ?? c.req.param("todoId"))!;
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const existing = await c.env.DB.prepare(
    "SELECT id, user_id, set_id, parent_id FROM todos WHERE id = ? AND team_id = ?",
  )
    .bind(todoId, teamId)
    .first<{
      id: string;
      user_id: string;
      set_id: string;
      parent_id: string | null;
    }>();
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
    const trimmedTitle = body.title.trim();
    if (!trimmedTitle) return c.json({ error: "Title is required" }, 400);
    const normalizedParentId = existing.parent_id ?? null;
    const duplicated = await c.env.DB.prepare(
      "SELECT id FROM todos WHERE set_id = ? AND team_id = ? AND title = ? AND id != ? AND ((parent_id IS NULL AND ? IS NULL) OR parent_id = ?)",
    )
      .bind(
        existing.set_id,
        teamId,
        trimmedTitle,
        todoId,
        normalizedParentId,
        normalizedParentId,
      )
      .first<{ id: string }>();
    if (duplicated) {
      return c.json(
        { error: "Todo item title already exists among sibling todos" },
        409,
      );
    }
    updates.push("title = ?");
    values.push(trimmedTitle);
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

  broadcast(c.env, teamId, {
    type: "todo:updated",
    setId: existing.set_id,
    todo: { id: todoId, ...body },
  });

  return c.json({ ok: true });
};

export const reorderTodos = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const { items, setId: reorderSetId } = await c.req.json<{
    items: { id: string; sortOrder: number }[];
    setId?: string;
  }>();
  if (!items?.length) return c.json({ error: "No items" }, 400);

  if (
    !(await hasPermission(
      c.env.DB,
      teamId,
      role,
      "reorder_todos",
      reorderSetId,
    ))
  ) {
    return c.json({ error: "No permission to reorder" }, 403);
  }

  await c.env.DB.batch(
    items.map(({ id, sortOrder }) =>
      c.env.DB.prepare(
        "UPDATE todos SET sort_order = ?, updated_at = datetime('now') WHERE id = ? AND team_id = ?",
      ).bind(sortOrder, id, teamId),
    ),
  );

  if (reorderSetId) {
    broadcast(c.env, teamId, {
      type: "todo:reordered",
      setId: reorderSetId,
      items,
    });
  }

  return c.json({ ok: true });
};

export const moveTodo = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const todoId = (c.req.param("id") ?? c.req.param("todoId"))!;
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const body = await c.req.json<{
    targetSetId: string;
    insertAt?: "top" | "bottom";
  }>();
  const targetSetId = body.targetSetId;
  const insertAt = body.insertAt === "top" ? "top" : "bottom";
  if (!targetSetId) return c.json({ error: "targetSetId is required" }, 400);

  const existing = await c.env.DB.prepare(
    "SELECT id, user_id, set_id, parent_id, title FROM todos WHERE id = ? AND team_id = ?",
  )
    .bind(todoId, teamId)
    .first<{
      id: string;
      user_id: string;
      set_id: string;
      parent_id: string | null;
      title: string;
    }>();
  if (!existing) return c.json({ error: "Not found" }, 404);

  // Moving a todo to another set is a remove-from-source + add-to-target, so the
  // user must be able to edit the todo in its current set and create todos in
  // the target set.
  const isOwner = existing.user_id === session.userId;
  const editPerm: PermissionKey = isOwner ? "edit_own_todos" : "edit_any_todo";
  if (
    !(await hasPermission(c.env.DB, teamId, role, editPerm, existing.set_id))
  ) {
    return c.json({ error: "No permission to move this todo" }, 403);
  }
  if (
    !(await hasPermission(c.env.DB, teamId, role, "create_todos", targetSetId))
  ) {
    return c.json(
      { error: "No permission to add todos to the target set" },
      403,
    );
  }

  const targetSet = await c.env.DB.prepare(
    "SELECT id FROM todo_sets WHERE id = ? AND team_id = ?",
  )
    .bind(targetSetId, teamId)
    .first();
  if (!targetSet) return c.json({ error: "Target set not found" }, 404);

  // The moved todo becomes a root in the target set, so its title must be
  // unique among the target set's root todos.
  const duplicated = await c.env.DB.prepare(
    "SELECT id FROM todos WHERE set_id = ? AND team_id = ? AND parent_id IS NULL AND title = ? AND id != ?",
  )
    .bind(targetSetId, teamId, existing.title, todoId)
    .first<{ id: string }>();
  if (duplicated) {
    return c.json(
      { error: "Todo item title already exists among sibling todos" },
      409,
    );
  }

  // Collect the moved todo and all of its descendants so the whole subtree moves
  // together while keeping its internal parent/child relationships.
  const sourceRows = await c.env.DB.prepare(
    "SELECT id, parent_id FROM todos WHERE set_id = ? AND team_id = ?",
  )
    .bind(existing.set_id, teamId)
    .all();
  const childrenByParent = new Map<string, string[]>();
  for (const r of sourceRows.results) {
    const pid = (r.parent_id as string) || "";
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
    childrenByParent.get(pid)!.push(r.id as string);
  }
  const subtreeIds: string[] = [];
  const stack = [todoId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    subtreeIds.push(current);
    for (const childId of childrenByParent.get(current) ?? []) {
      stack.push(childId);
    }
  }

  let newSortOrder: number;
  if (insertAt === "top") {
    await c.env.DB.prepare(
      "UPDATE todos SET sort_order = sort_order + 1 WHERE set_id = ? AND team_id = ? AND parent_id IS NULL",
    )
      .bind(targetSetId, teamId)
      .run();
    newSortOrder = 1;
  } else {
    const maxRow = await c.env.DB.prepare(
      "SELECT COALESCE(MAX(sort_order), 0) as m FROM todos WHERE set_id = ? AND team_id = ? AND parent_id IS NULL",
    )
      .bind(targetSetId, teamId)
      .first<{ m: number }>();
    newSortOrder = (maxRow?.m ?? 0) + 1;
  }

  const statements = subtreeIds.map((id) =>
    c.env.DB.prepare(
      "UPDATE todos SET set_id = ?, updated_at = datetime('now') WHERE id = ? AND team_id = ?",
    ).bind(targetSetId, id, teamId),
  );
  statements.push(
    c.env.DB.prepare(
      "UPDATE todos SET parent_id = NULL, sort_order = ?, updated_at = datetime('now') WHERE id = ? AND team_id = ?",
    ).bind(newSortOrder, todoId, teamId),
  );
  await c.env.DB.batch(statements);

  // Notify viewers of the source set (subtree removed) and the target set (new
  // content). The Durable Object delivers each broadcast only to clients
  // subscribed to that broadcast's setId, so we emit one per affected set.
  broadcast(c.env, teamId, {
    type: "todo:moved",
    setId: existing.set_id,
    id: todoId,
    fromSetId: existing.set_id,
    toSetId: targetSetId,
  });
  if (existing.set_id !== targetSetId) {
    broadcast(c.env, teamId, {
      type: "todo:moved",
      setId: targetSetId,
      id: todoId,
      fromSetId: existing.set_id,
      toSetId: targetSetId,
    });
  }

  return c.json({ ok: true });
};

export const deleteTodo = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const todoId = (c.req.param("id") ?? c.req.param("todoId"))!;
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

  broadcast(c.env, teamId, {
    type: "todo:deleted",
    setId: existing.set_id,
    id: todoId,
  });

  return c.json({ ok: true });
};
