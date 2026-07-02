/**
 * Aggregated dashboard endpoints — overview / my-todos / feed.
 * Auth-mode-agnostic; the route file decides whether to wire these to cookie
 * auth, cross-app bearer auth, or any other middleware that populates session.
 */

import type { Context } from "hono";
import type { Bindings, Variables } from "../types";
import { getTeamRole, isPersonalSpaceId } from "../auth";
import { supportsAssignees } from "../assignees";

type Ctx = Context<{ Bindings: Bindings; Variables: Variables }>;

/**
 * GET overview — sets count, todo counts, count assigned to me.
 * Required permission: team membership (no specific permission key).
 */
export const getOverview = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const assigneesSupported = await supportsAssignees(c.env.DB);

  const [setsRow, totalRow, completedRow, assignedRow] = await Promise.all([
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
    assigneesSupported
      ? c.env.DB.prepare(
          `SELECT COUNT(*) as count FROM todo_assignees a
           JOIN todos t ON t.id = a.todo_id
           WHERE a.team_id = ? AND a.user_id = ? AND t.completed = 0`,
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
    assignedToMe: assignedRow?.count ?? 0,
  });
};

/**
 * GET my-todos — incomplete todos created by, or assigned to, the calling user.
 */
export const getMyTodos = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const assigneesSupported = await supportsAssignees(c.env.DB);

  const whereClause = assigneesSupported
    ? `AND (t.user_id = ? OR EXISTS (
         SELECT 1 FROM todo_assignees a
         WHERE a.todo_id = t.id AND a.user_id = ?
       ))`
    : `AND t.user_id = ?`;
  const binds = assigneesSupported
    ? [teamId, session.userId, session.userId]
    : [teamId, session.userId];

  const result = await c.env.DB.prepare(
    `SELECT t.id, t.set_id, t.user_id, t.title, t.completed,
          t.created_at, t.updated_at,
          s.name as set_name,
          ${assigneesSupported ? "EXISTS (SELECT 1 FROM todo_assignees a WHERE a.todo_id = t.id AND a.user_id = ?)" : "0"} as assigned_to_me
   FROM todos t
   LEFT JOIN todo_sets s ON s.id = t.set_id
   WHERE t.team_id = ? ${whereClause} AND t.completed = 0
   ORDER BY t.updated_at DESC
   LIMIT 50`,
  )
    .bind(...(assigneesSupported ? [session.userId, ...binds] : binds))
    .all();

  return c.json({
    todos: result.results.map((row) => ({
      id: row.id as string,
      setId: row.set_id as string,
      setName: (row.set_name as string) || null,
      userId: row.user_id as string,
      title: row.title as string,
      completed: row.completed === 1,
      isMyTodo: row.user_id === session.userId,
      isAssignedToMe: row.assigned_to_me === 1,
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
