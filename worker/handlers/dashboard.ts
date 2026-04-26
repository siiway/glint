/**
 * Aggregated dashboard endpoints — overview / my-todos / feed.
 * Auth-mode-agnostic; the route file decides whether to wire these to cookie
 * auth, cross-app bearer auth, or any other middleware that populates session.
 */

import type { Context } from "hono";
import type { Bindings, Variables } from "../types";
import { getTeamRole, isPersonalSpaceId } from "../auth";
import { supportsClaimedBy } from "../transfer";

type Ctx = Context<{ Bindings: Bindings; Variables: Variables }>;

/**
 * GET overview — sets count, todo counts, my claimed count.
 * Required permission: team membership (no specific permission key).
 */
export const getOverview = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const claimSupported = await supportsClaimedBy(c.env.DB);

  const [setsRow, totalRow, completedRow, claimedRow] = await Promise.all([
    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM todo_sets WHERE team_id = ?",
    )
      .bind(teamId)
      .first<{ count: number }>(),
    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM todos WHERE team_id = ? AND parent_id IS NULL",
    )
      .bind(teamId)
      .first<{ count: number }>(),
    c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM todos WHERE team_id = ? AND parent_id IS NULL AND completed = 1",
    )
      .bind(teamId)
      .first<{ count: number }>(),
    claimSupported
      ? c.env.DB.prepare(
          "SELECT COUNT(*) as count FROM todos WHERE team_id = ? AND claimed_by = ? AND completed = 0",
        )
          .bind(teamId, session.userId)
          .first<{ count: number }>()
      : Promise.resolve({ count: 0 }),
  ]);

  const total = totalRow?.count ?? 0;
  const completed = completedRow?.count ?? 0;

  return c.json({
    sets: setsRow?.count ?? 0,
    total,
    completed,
    pending: total - completed,
    claimedByMe: claimedRow?.count ?? 0,
  });
};

/**
 * GET my-todos — incomplete todos created by, or claimed by, the calling user.
 */
export const getMyTodos = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const claimSupported = await supportsClaimedBy(c.env.DB);

  const claimClause = claimSupported
    ? `AND (t.user_id = ? OR t.claimed_by = ?)`
    : `AND t.user_id = ?`;
  const binds = claimSupported
    ? [teamId, session.userId, session.userId]
    : [teamId, session.userId];

  const result = await c.env.DB.prepare(
    `SELECT t.id, t.set_id, t.user_id, t.title, t.completed,
          ${claimSupported ? "t.claimed_by," : "NULL as claimed_by,"}
          t.created_at, t.updated_at,
          s.name as set_name
   FROM todos t
   LEFT JOIN todo_sets s ON s.id = t.set_id
   WHERE t.team_id = ? ${claimClause} AND t.completed = 0
   ORDER BY t.updated_at DESC
   LIMIT 50`,
  )
    .bind(...binds)
    .all();

  return c.json({
    todos: result.results.map((row) => ({
      id: row.id as string,
      setId: row.set_id as string,
      setName: (row.set_name as string) || null,
      userId: row.user_id as string,
      title: row.title as string,
      completed: row.completed === 1,
      claimedBy: (row.claimed_by as string) || null,
      isMyTodo: row.user_id === session.userId,
      isClaimedByMe: row.claimed_by === session.userId,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    })),
  });
};

/**
 * GET feed — latest 20 todos by updated_at (any status).
 * Membership check is relaxed for personal spaces (the user IS the team).
 */
export const getFeed = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const session = c.get("session");
  if (!isPersonalSpaceId(teamId, session.userId)) {
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);
  }

  const result = await c.env.DB.prepare(
    `SELECT t.id, t.title, t.completed, t.user_id, t.updated_at,
          s.id as set_id, s.name as set_name
   FROM todos t
   LEFT JOIN todo_sets s ON s.id = t.set_id
   WHERE t.team_id = ?
   ORDER BY t.updated_at DESC
   LIMIT 20`,
  )
    .bind(teamId)
    .all();

  return c.json({
    items: result.results.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      completed: row.completed === 1,
      userId: row.user_id as string,
      setId: (row.set_id as string) || null,
      setName: (row.set_name as string) || null,
      updatedAt: row.updated_at as string,
    })),
  });
};
