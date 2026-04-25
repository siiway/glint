import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { requireWorkbenchAuth } from "../workbenchAuth";
import { getTeamRole, isPersonalSpaceId } from "../auth";
import { resolveWorkbenchTeamId } from "../config";
import { listTodos, patchTodo } from "../handlers/todos";

const workbench = new Hono<{ Bindings: Bindings; Variables: Variables }>();

async function hasClaimedBy(db: D1Database): Promise<boolean> {
  const info = await db.prepare("PRAGMA table_info(todos)").all();
  return info.results.some((r) => r.name === "claimed_by");
}

/**
 * GET /api/workbench/teams/:teamId/overview
 * Aggregated stats for one team: sets count, todo counts, my claimed count.
 */
workbench.get(
  "/api/workbench/teams/:teamId/overview",
  requireWorkbenchAuth,
  async (c) => {
    const teamId = await resolveWorkbenchTeamId(
      c.env.KV,
      c.req.param("teamId"),
    );
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const claimSupported = await hasClaimedBy(c.env.DB);

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
  },
);

/**
 * GET /api/workbench/teams/:teamId/sets
 * All sets in the team with per-set todo counts.
 */
workbench.get(
  "/api/workbench/teams/:teamId/sets",
  requireWorkbenchAuth,
  async (c) => {
    const teamId = await resolveWorkbenchTeamId(
      c.env.KV,
      c.req.param("teamId"),
    );
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const [sets, counts] = await Promise.all([
      c.env.DB.prepare(
        "SELECT id, name, sort_order FROM todo_sets WHERE team_id = ? ORDER BY sort_order ASC, name ASC",
      )
        .bind(teamId)
        .all(),
      c.env.DB.prepare(
        `SELECT set_id,
              COUNT(*) as total,
              SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
       FROM todos WHERE team_id = ? AND parent_id IS NULL
       GROUP BY set_id`,
      )
        .bind(teamId)
        .all(),
    ]);

    const countMap: Record<string, { total: number; completed: number }> = {};
    for (const r of counts.results) {
      countMap[r.set_id as string] = {
        total: r.total as number,
        completed: r.completed as number,
      };
    }

    return c.json({
      role,
      sets: sets.results.map((row) => {
        const stats = countMap[row.id as string] ?? { total: 0, completed: 0 };
        return {
          id: row.id as string,
          name: row.name as string,
          sortOrder: row.sort_order as number,
          total: stats.total,
          completed: stats.completed,
          pending: stats.total - stats.completed,
        };
      }),
    });
  },
);

/**
 * GET /api/workbench/teams/:teamId/my-todos
 * Todos created by or claimed by the current user in this team (incomplete only).
 */
workbench.get(
  "/api/workbench/teams/:teamId/my-todos",
  requireWorkbenchAuth,
  async (c) => {
    const teamId = await resolveWorkbenchTeamId(
      c.env.KV,
      c.req.param("teamId"),
    );
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const claimSupported = await hasClaimedBy(c.env.DB);

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
  },
);

/**
 * GET /api/workbench/teams/:teamId/feed
 * Recent todo activity in the team (latest 20 updates, any status).
 */
workbench.get(
  "/api/workbench/teams/:teamId/feed",
  requireWorkbenchAuth,
  async (c) => {
    const teamId = await resolveWorkbenchTeamId(
      c.env.KV,
      c.req.param("teamId"),
    );
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
  },
);

/**
 * GET /api/workbench/teams/:teamId/sets/:setId/todos
 * Lists todos for a specific set. Delegates to the shared listTodos handler.
 */
workbench.get(
  "/api/workbench/teams/:teamId/sets/:setId/todos",
  requireWorkbenchAuth,
  listTodos,
);

/**
 * PATCH /api/workbench/teams/:teamId/todos/:todoId
 * Update a todo (title, completion, sort order). Delegates to the shared patchTodo handler.
 */
workbench.patch(
  "/api/workbench/teams/:teamId/todos/:todoId",
  requireWorkbenchAuth,
  patchTodo,
);

export default workbench;
