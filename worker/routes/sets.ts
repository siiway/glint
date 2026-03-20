import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { requireAuth, getTeamRole } from "../auth";
import { ensureDefaultSet } from "../config";
import { hasPermission } from "../permissions";

const sets = new Hono<{ Bindings: Bindings; Variables: Variables }>();

sets.get("/api/teams/:teamId/sets", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  await ensureDefaultSet(c.env.DB, c.env.KV, teamId, session.userId);

  const result = await c.env.DB.prepare(
    "SELECT id, user_id, name, sort_order, auto_renew, renew_time, timezone, last_renewed_at, created_at FROM todo_sets WHERE team_id = ? ORDER BY sort_order ASC",
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
      createdAt: r.created_at as string,
    })),
    role,
  });
});

sets.post("/api/teams/:teamId/sets", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
    return c.json({ error: "No permission to manage sets" }, 403);
  }

  const { name } = await c.req.json<{ name: string }>();
  if (!name?.trim()) return c.json({ error: "Name is required" }, 400);

  const maxRow = await c.env.DB.prepare(
    "SELECT COALESCE(MAX(sort_order), 0) as m FROM todo_sets WHERE team_id = ?",
  )
    .bind(teamId)
    .first<{ m: number }>();

  const id = crypto.randomUUID();
  const sortOrder = (maxRow?.m ?? 0) + 1;

  await c.env.DB.prepare(
    "INSERT INTO todo_sets (id, team_id, user_id, name, sort_order) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, teamId, session.userId, name.trim(), sortOrder)
    .run();

  return c.json(
    {
      set: {
        id,
        userId: session.userId,
        name: name.trim(),
        sortOrder,
        autoRenew: false,
        renewTime: "00:00",
        timezone: "",
        lastRenewedAt: null,
        createdAt: new Date().toISOString(),
      },
    },
    201,
  );
});

sets.patch("/api/teams/:teamId/sets/:setId", requireAuth, async (c) => {
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
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  const body = await c.req.json<{
    name?: string;
    autoRenew?: boolean;
    renewTime?: string;
    timezone?: string;
  }>();

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (body.name !== undefined) {
    if (!body.name.trim()) return c.json({ error: "Name is required" }, 400);
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

  if (updates.length === 0) return c.json({ error: "No updates" }, 400);

  updates.push("updated_at = datetime('now')");
  values.push(setId, teamId);

  await c.env.DB.prepare(
    `UPDATE todo_sets SET ${updates.join(", ")} WHERE id = ? AND team_id = ?`,
  )
    .bind(...values)
    .run();

  return c.json({ ok: true });
});

sets.delete("/api/teams/:teamId/sets/:setId", requireAuth, async (c) => {
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
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  await c.env.DB.prepare("DELETE FROM todo_sets WHERE id = ? AND team_id = ?")
    .bind(setId, teamId)
    .run();

  return c.json({ ok: true });
});

sets.post("/api/teams/:teamId/sets/reorder", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
    return c.json({ error: "No permission" }, 403);
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
});

export default sets;
