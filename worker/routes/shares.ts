import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { requireAuth, getTeamRole } from "../auth";
import { hasPermission } from "../permissions";

const shares = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Authenticated endpoints (manage share links) ────────────────────────────

shares.get("/api/teams/:teamId/sets/:setId/share", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const setId = c.req.param("setId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const row = await c.env.DB.prepare(
    "SELECT id, token, created_by, created_at FROM share_links WHERE set_id = ? AND team_id = ?",
  )
    .bind(setId, teamId)
    .first<{
      id: string;
      token: string;
      created_by: string;
      created_at: string;
    }>();

  return c.json({ share: row ?? null });
});

shares.post("/api/teams/:teamId/sets/:setId/share", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const setId = c.req.param("setId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
    return c.json({ error: "No permission to manage sets" }, 403);
  }

  // Check if share link already exists
  const existing = await c.env.DB.prepare(
    "SELECT token FROM share_links WHERE set_id = ? AND team_id = ?",
  )
    .bind(setId, teamId)
    .first<{ token: string }>();

  if (existing) {
    return c.json({ token: existing.token });
  }

  const id = crypto.randomUUID();
  const token = crypto.randomUUID().replace(/-/g, "");

  await c.env.DB.prepare(
    "INSERT INTO share_links (id, set_id, team_id, token, created_by) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, setId, teamId, token, session.userId)
    .run();

  return c.json({ token }, 201);
});

shares.delete(
  "/api/teams/:teamId/sets/:setId/share",
  requireAuth,
  async (c) => {
    const teamId = c.req.param("teamId");
    const setId = c.req.param("setId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
      return c.json({ error: "No permission to manage sets" }, 403);
    }

    await c.env.DB.prepare(
      "DELETE FROM share_links WHERE set_id = ? AND team_id = ?",
    )
      .bind(setId, teamId)
      .run();

    return c.json({ ok: true });
  },
);

// ─── Public endpoints (no auth required) ─────────────────────────────────────

async function resolveShareToken(
  db: D1Database,
  token: string,
): Promise<{ set_id: string; team_id: string } | null> {
  return db
    .prepare("SELECT set_id, team_id FROM share_links WHERE token = ?")
    .bind(token)
    .first<{ set_id: string; team_id: string }>();
}

shares.get("/api/shared/:token", async (c) => {
  const token = c.req.param("token");
  const link = await resolveShareToken(c.env.DB, token);
  if (!link) return c.json({ error: "Share link not found" }, 404);

  const set = await c.env.DB.prepare(
    "SELECT id, name FROM todo_sets WHERE id = ? AND team_id = ?",
  )
    .bind(link.set_id, link.team_id)
    .first<{ id: string; name: string }>();

  if (!set) return c.json({ error: "Set not found" }, 404);

  const result = await c.env.DB.prepare(
    "SELECT id, user_id, parent_id, title, completed, sort_order, created_at, updated_at FROM todos WHERE set_id = ? AND team_id = ? ORDER BY sort_order ASC, created_at ASC",
  )
    .bind(link.set_id, link.team_id)
    .all();

  const commentCounts = await c.env.DB.prepare(
    "SELECT todo_id, COUNT(*) as count FROM comments WHERE todo_id IN (SELECT id FROM todos WHERE set_id = ? AND team_id = ?) GROUP BY todo_id",
  )
    .bind(link.set_id, link.team_id)
    .all();

  const countMap: Record<string, number> = {};
  for (const r of commentCounts.results) {
    countMap[r.todo_id as string] = r.count as number;
  }

  return c.json({
    set: { id: set.id, name: set.name },
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
  });
});

shares.post("/api/shared/:token/todos", async (c) => {
  const token = c.req.param("token");
  const link = await resolveShareToken(c.env.DB, token);
  if (!link) return c.json({ error: "Share link not found" }, 404);

  const { title, parentId } = await c.req.json<{
    title: string;
    parentId?: string;
  }>();
  if (!title?.trim()) return c.json({ error: "Title is required" }, 400);

  if (parentId) {
    const parent = await c.env.DB.prepare(
      "SELECT id FROM todos WHERE id = ? AND set_id = ? AND team_id = ?",
    )
      .bind(parentId, link.set_id, link.team_id)
      .first();
    if (!parent) return c.json({ error: "Parent todo not found" }, 404);
  }

  const maxRow = await c.env.DB.prepare(
    `SELECT COALESCE(MAX(sort_order), 0) as m FROM todos WHERE ${
      parentId ? "parent_id = ?" : "set_id = ? AND parent_id IS NULL"
    } AND team_id = ?`,
  )
    .bind(parentId ?? link.set_id, link.team_id)
    .first<{ m: number }>();

  const id = crypto.randomUUID();
  const sortOrder = (maxRow?.m ?? 0) + 1;

  await c.env.DB.prepare(
    "INSERT INTO todos (id, set_id, team_id, user_id, parent_id, title, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      id,
      link.set_id,
      link.team_id,
      "shared",
      parentId ?? null,
      title.trim(),
      sortOrder,
    )
    .run();

  return c.json(
    {
      todo: {
        id,
        userId: "shared",
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

shares.patch("/api/shared/:token/todos/:id", async (c) => {
  const token = c.req.param("token");
  const todoId = c.req.param("id");
  const link = await resolveShareToken(c.env.DB, token);
  if (!link) return c.json({ error: "Share link not found" }, 404);

  const existing = await c.env.DB.prepare(
    "SELECT id FROM todos WHERE id = ? AND set_id = ? AND team_id = ?",
  )
    .bind(todoId, link.set_id, link.team_id)
    .first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const body = await c.req.json<{
    title?: string;
    completed?: boolean;
    sortOrder?: number;
  }>();

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
  values.push(todoId, link.team_id);

  await c.env.DB.prepare(
    `UPDATE todos SET ${updates.join(", ")} WHERE id = ? AND team_id = ?`,
  )
    .bind(...values)
    .run();

  return c.json({ ok: true });
});

shares.delete("/api/shared/:token/todos/:id", async (c) => {
  const token = c.req.param("token");
  const todoId = c.req.param("id");
  const link = await resolveShareToken(c.env.DB, token);
  if (!link) return c.json({ error: "Share link not found" }, 404);

  const existing = await c.env.DB.prepare(
    "SELECT id FROM todos WHERE id = ? AND set_id = ? AND team_id = ?",
  )
    .bind(todoId, link.set_id, link.team_id)
    .first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  await c.env.DB.prepare("DELETE FROM todos WHERE id = ? AND team_id = ?")
    .bind(todoId, link.team_id)
    .run();

  return c.json({ ok: true });
});

shares.post("/api/shared/:token/todos/reorder", async (c) => {
  const token = c.req.param("token");
  const link = await resolveShareToken(c.env.DB, token);
  if (!link) return c.json({ error: "Share link not found" }, 404);

  const { items } = await c.req.json<{
    items: { id: string; sortOrder: number }[];
  }>();
  if (!items?.length) return c.json({ error: "No items" }, 400);

  await c.env.DB.batch(
    items.map(({ id, sortOrder }) =>
      c.env.DB.prepare(
        "UPDATE todos SET sort_order = ?, updated_at = datetime('now') WHERE id = ? AND team_id = ?",
      ).bind(sortOrder, id, link.team_id),
    ),
  );
  return c.json({ ok: true });
});

export default shares;
