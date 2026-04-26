import { Hono } from "hono";
import { PERMISSION_KEYS, DEFAULT_PERMISSIONS } from "../types";
import type { Bindings, Variables } from "../types";
import { requireWorkbenchAuth } from "../workbenchAuth";
import { getTeamRole, isPersonalSpaceId } from "../auth";
import { resolveWorkbenchTeamId } from "../config";
import { hasPermission, getPermissions } from "../permissions";
import {
  claimTodo,
  createTodo,
  deleteTodo,
  listTodos,
  patchTodo,
  reorderTodos,
} from "../handlers/todos";
import {
  createComment,
  deleteComment,
  listComments,
} from "../handlers/comments";
import {
  createSet,
  deleteSet,
  patchSet,
  reorderSets,
} from "../handlers/sets";
import { handleSse, handleWsUpgrade } from "../realtime";

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
        "SELECT id, user_id, name, sort_order, auto_renew, renew_time, timezone, last_renewed_at, split_completed, created_at FROM todo_sets WHERE team_id = ? ORDER BY sort_order ASC, name ASC",
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
          userId: row.user_id as string,
          name: row.name as string,
          sortOrder: row.sort_order as number,
          autoRenew: row.auto_renew === 1,
          renewTime: (row.renew_time as string) ?? "00:00",
          timezone: (row.timezone as string) ?? "",
          lastRenewedAt: (row.last_renewed_at as string) || null,
          splitCompleted: row.split_completed === 1,
          createdAt: row.created_at as string,
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
 * POST   /api/workbench/teams/:teamId/sets                    create
 * PATCH  /api/workbench/teams/:teamId/sets/:setId             rename + advanced fields
 * DELETE /api/workbench/teams/:teamId/sets/:setId             delete
 * POST   /api/workbench/teams/:teamId/sets/reorder            sortOrder
 */
workbench.post(
  "/api/workbench/teams/:teamId/sets",
  requireWorkbenchAuth,
  createSet,
);
workbench.patch(
  "/api/workbench/teams/:teamId/sets/:setId",
  requireWorkbenchAuth,
  patchSet,
);
workbench.delete(
  "/api/workbench/teams/:teamId/sets/:setId",
  requireWorkbenchAuth,
  deleteSet,
);
workbench.post(
  "/api/workbench/teams/:teamId/sets/reorder",
  requireWorkbenchAuth,
  reorderSets,
);

/**
 * GET /api/workbench/teams/:teamId/permissions/me
 * Effective permission map for the calling user in this team (optionally for a set).
 */
workbench.get(
  "/api/workbench/teams/:teamId/permissions/me",
  requireWorkbenchAuth,
  async (c) => {
    const teamId = await resolveWorkbenchTeamId(
      c.env.KV,
      c.req.param("teamId"),
    );
    const setId = c.req.query("setId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const effective: Record<string, boolean> = {};
    for (const key of PERMISSION_KEYS) {
      effective[key] = await hasPermission(c.env.DB, teamId, role, key, setId);
    }
    return c.json({ permissions: effective, role });
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
 * POST /api/workbench/teams/:teamId/sets/:setId/todos
 * Create a todo (or sub-todo when body.parentId is set).
 */
workbench.post(
  "/api/workbench/teams/:teamId/sets/:setId/todos",
  requireWorkbenchAuth,
  createTodo,
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

/**
 * DELETE /api/workbench/teams/:teamId/todos/:todoId
 */
workbench.delete(
  "/api/workbench/teams/:teamId/todos/:todoId",
  requireWorkbenchAuth,
  deleteTodo,
);

/**
 * POST /api/workbench/teams/:teamId/todos/reorder
 * Body: { items: [{id, sortOrder}], setId? }
 */
workbench.post(
  "/api/workbench/teams/:teamId/todos/reorder",
  requireWorkbenchAuth,
  reorderTodos,
);

/**
 * POST /api/workbench/teams/:teamId/todos/:todoId/claim
 * Toggle claim/release for the calling user.
 */
workbench.post(
  "/api/workbench/teams/:teamId/todos/:todoId/claim",
  requireWorkbenchAuth,
  claimTodo,
);

/**
 * GET    /api/workbench/teams/:teamId/todos/:todoId/comments
 * POST   /api/workbench/teams/:teamId/todos/:todoId/comments
 * DELETE /api/workbench/teams/:teamId/todos/:todoId/comments/:commentId
 */
workbench.get(
  "/api/workbench/teams/:teamId/todos/:todoId/comments",
  requireWorkbenchAuth,
  listComments,
);
workbench.post(
  "/api/workbench/teams/:teamId/todos/:todoId/comments",
  requireWorkbenchAuth,
  createComment,
);
workbench.delete(
  "/api/workbench/teams/:teamId/todos/:todoId/comments/:commentId",
  requireWorkbenchAuth,
  deleteComment,
);

/**
 * Realtime endpoints (membership-gated):
 *   ALL /api/workbench/teams/:teamId/sets/:setId/ws
 *   GET /api/workbench/teams/:teamId/sets/:setId/sse
 */
workbench.all(
  "/api/workbench/teams/:teamId/sets/:setId/ws",
  requireWorkbenchAuth,
  async (c) => {
    const teamId = await resolveWorkbenchTeamId(
      c.env.KV,
      c.req.param("teamId"),
    );
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);
    return handleWsUpgrade(c);
  },
);
workbench.get(
  "/api/workbench/teams/:teamId/sets/:setId/sse",
  requireWorkbenchAuth,
  async (c) => {
    const teamId = await resolveWorkbenchTeamId(
      c.env.KV,
      c.req.param("teamId"),
    );
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);
    return handleSse(c);
  },
);

/**
 * Permissions admin (mirrors /api/teams/:teamId/permissions for Bearer auth).
 *   GET    list global + per-set permissions for the team
 *   PUT    upsert one or more permission rows
 *   DELETE drop a scope's overrides (defaults back to DEFAULT_PERMISSIONS)
 */
workbench.get(
  "/api/workbench/teams/:teamId/permissions",
  requireWorkbenchAuth,
  async (c) => {
    const teamId = await resolveWorkbenchTeamId(
      c.env.KV,
      c.req.param("teamId"),
    );
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const globalPerms = await getPermissions(c.env.DB, teamId, "global");

    const setRows = await c.env.DB.prepare(
      "SELECT scope, role, permission, allowed FROM permissions WHERE team_id = ? AND scope != 'global'",
    )
      .bind(teamId)
      .all();

    const setOverrides: Record<
      string,
      Record<string, Record<string, boolean>>
    > = {};
    for (const row of setRows.results) {
      const scope = row.scope as string;
      const setId = scope.replace("set:", "");
      const r = row.role as string;
      const perm = row.permission as string;
      if (!setOverrides[setId]) setOverrides[setId] = {};
      if (!setOverrides[setId][r]) setOverrides[setId][r] = {};
      setOverrides[setId][r][perm] = row.allowed === 1;
    }

    return c.json({
      keys: PERMISSION_KEYS,
      defaults: DEFAULT_PERMISSIONS,
      global: globalPerms,
      sets: setOverrides,
      role,
    });
  },
);
workbench.put(
  "/api/workbench/teams/:teamId/permissions",
  requireWorkbenchAuth,
  async (c) => {
    const teamId = await resolveWorkbenchTeamId(
      c.env.KV,
      c.req.param("teamId"),
    );
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    if (!(await hasPermission(c.env.DB, teamId, role, "manage_permissions"))) {
      return c.json({ error: "No permission to manage permissions" }, 403);
    }

    const { scope, permissions: perms } = await c.req.json<{
      scope: string;
      permissions: {
        role: "admin" | "member";
        permission: string;
        allowed: boolean;
      }[];
    }>();

    if (!scope || !perms?.length) {
      return c.json({ error: "scope and permissions required" }, 400);
    }
    if (scope !== "global" && !scope.startsWith("set:")) {
      return c.json({ error: "Invalid scope" }, 400);
    }
    if (role !== "owner" && role !== "co-owner") {
      const forbidden = perms.filter(
        (p) => p.permission === "manage_permissions" && p.allowed,
      );
      if (forbidden.length > 0) {
        return c.json(
          { error: "Only owners and co-owners can grant manage_permissions" },
          403,
        );
      }
    }

    const stmts = perms.map((p) =>
      c.env.DB.prepare(
        `INSERT INTO permissions (id, team_id, scope, role, permission, allowed)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(team_id, scope, role, permission)
         DO UPDATE SET allowed = ?, updated_at = datetime('now')`,
      ).bind(
        crypto.randomUUID(),
        teamId,
        scope,
        p.role,
        p.permission,
        p.allowed ? 1 : 0,
        p.allowed ? 1 : 0,
      ),
    );
    await c.env.DB.batch(stmts);
    return c.json({ ok: true });
  },
);
workbench.delete(
  "/api/workbench/teams/:teamId/permissions",
  requireWorkbenchAuth,
  async (c) => {
    const teamId = await resolveWorkbenchTeamId(
      c.env.KV,
      c.req.param("teamId"),
    );
    const scope = c.req.query("scope") || "global";
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    if (!(await hasPermission(c.env.DB, teamId, role, "manage_permissions"))) {
      return c.json({ error: "No permission to manage permissions" }, 403);
    }

    await c.env.DB.prepare(
      "DELETE FROM permissions WHERE team_id = ? AND scope = ?",
    )
      .bind(teamId, scope)
      .run();
    return c.json({ ok: true });
  },
);

export default workbench;
