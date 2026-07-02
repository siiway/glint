/**
 * Shared handlers for todo assignment endpoints.
 * Wired to both cookie-session auth (routes/todos.ts) and cross-app bearer
 * auth (routes/cross-app.ts). Writes broadcast to the team's Durable Object.
 */

import type { Context } from "hono";
import type { Bindings, Variables } from "../types";
import { getTeamRole, getPersonalSpaceId, isPersonalSpaceId } from "../auth";
import { getAppConfig } from "../config";
import { hasPermission } from "../permissions";
import { broadcast } from "../realtime";
import {
  supportsAssignees,
  resolveAssignees,
  getAssignableMembers,
  getAssignedExpand,
  updateAssignedExpand,
} from "../assignees";

type Ctx = Context<{ Bindings: Bindings; Variables: Variables }>;

/**
 * GET /teams/:teamId/members — list members that todos can be assigned to.
 * Requires team membership only.
 */
export const listMembers = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const config = await getAppConfig(c.env.KV, c.env);
  const members = await getAssignableMembers(config, session, teamId);
  return c.json({ members });
};

/**
 * PUT /teams/:teamId/todos/:id/assignees — replace the full assignee set.
 * Body: { userIds: string[] }. Requires the assign_todos permission.
 */
export const setAssignees = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const todoId = (c.req.param("id") ?? c.req.param("todoId"))!;
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await supportsAssignees(c.env.DB))) {
    return c.json(
      { error: "Assignment feature unavailable: database migration required" },
      503,
    );
  }

  const existing = await c.env.DB.prepare(
    "SELECT id, set_id FROM todos WHERE id = ? AND team_id = ?",
  )
    .bind(todoId, teamId)
    .first<{ id: string; set_id: string }>();
  if (!existing) return c.json({ error: "Not found" }, 404);

  if (
    !(await hasPermission(c.env.DB, teamId, role, "assign_todos", existing.set_id))
  ) {
    return c.json({ error: "No permission to assign todos" }, 403);
  }

  const body = await c.req
    .json<{ userIds?: string[] }>()
    .catch(() => ({ userIds: [] as string[] }));
  const requested: string[] = Array.isArray(body.userIds) ? body.userIds : [];

  // Only allow assigning real team members. Fetch the roster once and filter.
  const config = await getAppConfig(c.env.KV, c.env);
  const members = await getAssignableMembers(config, session, teamId);
  const memberIds = new Set(members.map((m) => m.userId));
  const validIds = [...new Set(requested)].filter((id) => memberIds.has(id));

  const now = new Date().toISOString();
  const statements = [
    c.env.DB.prepare(
      "DELETE FROM todo_assignees WHERE todo_id = ? AND team_id = ?",
    ).bind(todoId, teamId),
    ...validIds.map((uid) =>
      c.env.DB.prepare(
        "INSERT OR IGNORE INTO todo_assignees (todo_id, user_id, team_id, assigned_by, created_at) VALUES (?, ?, ?, ?, ?)",
      ).bind(todoId, uid, teamId, session.userId, now),
    ),
  ];
  await c.env.DB.batch(statements);
  await c.env.DB.prepare(
    "UPDATE todos SET updated_at = datetime('now') WHERE id = ? AND team_id = ?",
  )
    .bind(todoId, teamId)
    .run();

  const resolved = await resolveAssignees(
    c.env.DB,
    c.env.KV,
    config,
    session,
    teamId,
    [todoId],
  );
  const assignees = resolved.get(todoId) ?? [];

  broadcast(c.env, teamId, {
    type: "todo:assigned",
    setId: existing.set_id,
    id: todoId,
    assignees,
  });

  return c.json({ ok: true, assignees });
};

/**
 * GET /teams/:teamId/assigned-to-me — incomplete todos assigned to the caller
 * in this workspace, grouped by todo list. Used by the pinned "Assigned to me"
 * category. Completed todos are omitted (assignment is kept but hidden).
 */
export const getAssignedToMe = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const expand = await getAssignedExpand(c.env.KV, session.userId);

  if (!(await supportsAssignees(c.env.DB))) {
    return c.json({ groups: [], expand });
  }

  const result = await c.env.DB.prepare(
    `SELECT t.id, t.set_id, t.parent_id, t.title, t.completed, t.sort_order,
            t.created_at, t.updated_at,
            s.name AS set_name, s.sort_order AS set_sort
     FROM todo_assignees a
     JOIN todos t ON t.id = a.todo_id
     LEFT JOIN todo_sets s ON s.id = t.set_id
     WHERE a.team_id = ? AND a.user_id = ? AND t.completed = 0
     ORDER BY s.sort_order ASC, t.sort_order ASC, t.created_at ASC`,
  )
    .bind(teamId, session.userId)
    .all();

  const groupsMap = new Map<
    string,
    {
      setId: string;
      setName: string | null;
      todos: {
        id: string;
        setId: string;
        parentId: string | null;
        title: string;
        completed: boolean;
        createdAt: string;
        updatedAt: string;
      }[];
    }
  >();

  for (const row of result.results) {
    const setId = row.set_id as string;
    if (!groupsMap.has(setId)) {
      groupsMap.set(setId, {
        setId,
        setName: (row.set_name as string) || null,
        todos: [],
      });
    }
    groupsMap.get(setId)!.todos.push({
      id: row.id as string,
      setId,
      parentId: (row.parent_id as string) || null,
      title: row.title as string,
      completed: row.completed === 1,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    });
  }

  return c.json({ groups: [...groupsMap.values()], expand });
};

/**
 * POST /teams/:teamId/assigned-expand — persist expand/collapse state for a
 * list in the "Assigned to me" view. Designed for navigator.sendBeacon, so the
 * body may arrive as a JSON blob; failures are swallowed and always 200.
 */
export const setAssignedExpandState = async (c: Ctx): Promise<Response> => {
  const session = c.get("session");
  try {
    const body = await c.req.json<{ setId?: string; expanded?: boolean }>();
    if (body.setId && typeof body.expanded === "boolean") {
      await updateAssignedExpand(
        c.env.KV,
        session.userId,
        body.setId,
        body.expanded,
      );
    }
  } catch {
    // Beacon payloads are best-effort; never fail the request.
  }
  return c.json({ ok: true });
};

/**
 * GET /cross-app/assigned-to-me — every incomplete todo assigned to the caller
 * across all their workspaces, grouped by workspace. Exposed so derived apps
 * can build a cross-workspace "my work" view.
 */
export const getAssignedToMeAll = async (c: Ctx): Promise<Response> => {
  const session = c.get("session");

  if (!(await supportsAssignees(c.env.DB))) {
    return c.json({ workspaces: [] });
  }

  const result = await c.env.DB.prepare(
    `SELECT a.team_id, t.id, t.set_id, t.parent_id, t.title, t.updated_at,
            s.name AS set_name
     FROM todo_assignees a
     JOIN todos t ON t.id = a.todo_id
     LEFT JOIN todo_sets s ON s.id = t.set_id
     WHERE a.user_id = ? AND t.completed = 0
     ORDER BY t.updated_at DESC`,
  )
    .bind(session.userId)
    .all();

  const personalId = getPersonalSpaceId(session.userId);
  const teamNames = new Map(session.teams.map((tm) => [tm.id, tm.name]));

  const workspaces = new Map<
    string,
    {
      teamId: string;
      name: string;
      kind: "personal" | "team";
      todos: {
        id: string;
        setId: string;
        setName: string | null;
        parentId: string | null;
        title: string;
        updatedAt: string;
      }[];
    }
  >();

  for (const row of result.results) {
    const teamId = row.team_id as string;
    if (!workspaces.has(teamId)) {
      const isPersonal = isPersonalSpaceId(teamId, session.userId) || teamId === personalId;
      workspaces.set(teamId, {
        teamId,
        name: isPersonal
          ? session.displayName || session.username
          : (teamNames.get(teamId) ?? teamId),
        kind: isPersonal ? "personal" : "team",
        todos: [],
      });
    }
    workspaces.get(teamId)!.todos.push({
      id: row.id as string,
      setId: row.set_id as string,
      setName: (row.set_name as string) || null,
      parentId: (row.parent_id as string) || null,
      title: row.title as string,
      updatedAt: row.updated_at as string,
    });
  }

  return c.json({ workspaces: [...workspaces.values()] });
};
