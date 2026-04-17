import { Hono } from "hono";
import type { Bindings, Variables, PermissionKey } from "../types";
import { PERMISSION_KEYS } from "../types";
import { requireAuth, getTeamRole, getPrism, isPersonalSpaceId } from "../auth";
import { getAppConfig } from "../config";
import { hasPermission } from "../permissions";

const todos = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function broadcast(
  env: Bindings,
  teamId: string,
  event: Record<string, unknown>,
): void {
  if (!env.TODO_SYNC) return;
  try {
    const id = env.TODO_SYNC.idFromName(teamId);
    const stub = env.TODO_SYNC.get(id);
    void stub.fetch(
      new Request("https://do-internal/broadcast", {
        method: "POST",
        body: JSON.stringify(event),
        headers: { "Content-Type": "application/json" },
      }),
    );
  } catch {}
}

const claimedBySupportCache = new WeakMap<D1Database, boolean>();

async function supportsClaimedBy(db: D1Database): Promise<boolean> {
  const cached = claimedBySupportCache.get(db);
  if (cached !== undefined) return cached;
  const info = await db.prepare("PRAGMA table_info(todos)").all();
  const supported = info.results.some((r) => r.name === "claimed_by");
  claimedBySupportCache.set(db, supported);
  return supported;
}

todos.get("/api/teams/:teamId/sets/:setId/todos", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const setId = c.req.param("setId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "view_todos", setId))) {
    return c.json({ error: "No permission to view todos in this set" }, 403);
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

  const perms: Record<string, boolean> = {};
  for (const key of PERMISSION_KEYS) {
    perms[key] = await hasPermission(c.env.DB, teamId, role, key, setId);
  }

  // Resolve claimed_by user IDs to display names via Prism
  const claimedIds = new Set(
    result.results
      .map((r) => r.claimed_by as string | null)
      .filter((id): id is string => !!id),
  );
  const nameMap: Record<string, string> = {};
  const avatarMap: Record<string, string> = {};
  if (claimedIds.size > 0 && !isPersonalSpaceId(teamId, session.userId)) {
    try {
      const config = await getAppConfig(c.env.KV);
      const prism = getPrism(config);
      const { members } = await prism.teams.get(session.accessToken, teamId);
      for (const m of members) {
        if (claimedIds.has(m.user_id)) {
          nameMap[m.user_id] = m.display_name || m.username;
          if (m.avatar_url) avatarMap[m.user_id] = m.avatar_url;
        }
      }
    } catch {
      // Fallback: leave names unresolved
    }
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
        claimedByAvatar:
          claimedBy && avatarMap[claimedBy]
            ? `/api/auth/avatar?url=${encodeURIComponent(avatarMap[claimedBy])}`
            : null,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      };
    }),
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

  const newTodo = {
    id,
    userId: session.userId,
    parentId: parentId ?? null,
    title: title.trim(),
    completed: false,
    sortOrder,
    commentCount: 0,
    claimedBy: null,
    claimedByName: null,
    claimedByAvatar: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  broadcast(c.env, teamId, { type: "todo:created", setId, todo: newTodo });

  return c.json({ todo: newTodo }, 201);
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

  broadcast(c.env, teamId, {
    type: "todo:updated",
    setId: existing.set_id,
    todo: { id: todoId, ...body },
  });

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

  const { items, setId: reorderSetId } = await c.req.json<{
    items: { id: string; sortOrder: number }[];
    setId?: string;
  }>();
  if (!items?.length) return c.json({ error: "No items" }, 400);

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

  broadcast(c.env, teamId, {
    type: "todo:deleted",
    setId: existing.set_id,
    id: todoId,
  });

  return c.json({ ok: true });
});

todos.post("/api/teams/:teamId/todos/:id/claim", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const todoId = c.req.param("id");
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

  broadcast(c.env, teamId, {
    type: "todo:claimed",
    setId: existing.set_id,
    id: todoId,
    claimedBy,
    claimedByName,
    claimedByAvatar,
  });

  return c.json({ ok: true, claimedBy, claimedByName, claimedByAvatar });
});

export default todos;
