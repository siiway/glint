/**
 * Workbench-flavoured BFF routes — DEPRECATED.
 *
 * Historically Workbench had its own auth path (Bearer with no scope check)
 * and inline aggregation handlers. After the refactor, all logic lives in
 * worker/handlers/* and this file is a thin shim that wires the same handlers
 * to the workbench-bearer auth middleware.
 *
 * NEW INTEGRATIONS: use /api/cross-app/* with explicit Prism scopes
 * (`app:<glintClientId>:<scope>`). These routes are kept as a transitional
 * compatibility layer and will be removed once Workbench has migrated.
 *
 * Team-id translation: none. Workbench and Glint both speak Prism's team_id
 * directly (Glint stores it in todos.team_id / todo_sets.team_id; Workbench
 * gets the same id from prism.teams.oauthList).
 */

import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { requireWorkbenchAuth } from "../workbenchAuth";
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
  listSets,
  patchSet,
  reorderSets,
} from "../handlers/sets";
import { getOverview, getMyTodos, getFeed } from "../handlers/dashboard";
import {
  getPermissionsAll,
  getPermissionsMe,
  upsertPermissions,
  deletePermissions,
} from "../handlers/permissions";
import { getTeamRole } from "../auth";
import { handleSse, handleWsUpgrade } from "../realtime";

const workbench = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// ─── Dashboard aggregations ─────────────────────────────────────────────────
workbench.get(
  "/api/workbench/teams/:teamId/overview",
  requireWorkbenchAuth,
  getOverview,
);
workbench.get(
  "/api/workbench/teams/:teamId/my-todos",
  requireWorkbenchAuth,
  getMyTodos,
);
workbench.get(
  "/api/workbench/teams/:teamId/feed",
  requireWorkbenchAuth,
  getFeed,
);

// ─── Sets ───────────────────────────────────────────────────────────────────
workbench.get(
  "/api/workbench/teams/:teamId/sets",
  requireWorkbenchAuth,
  listSets,
);
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

// ─── Permissions ────────────────────────────────────────────────────────────
workbench.get(
  "/api/workbench/teams/:teamId/permissions/me",
  requireWorkbenchAuth,
  getPermissionsMe,
);
workbench.get(
  "/api/workbench/teams/:teamId/permissions",
  requireWorkbenchAuth,
  getPermissionsAll,
);
workbench.put(
  "/api/workbench/teams/:teamId/permissions",
  requireWorkbenchAuth,
  upsertPermissions,
);
workbench.delete(
  "/api/workbench/teams/:teamId/permissions",
  requireWorkbenchAuth,
  deletePermissions,
);

// ─── Todos ──────────────────────────────────────────────────────────────────
workbench.get(
  "/api/workbench/teams/:teamId/sets/:setId/todos",
  requireWorkbenchAuth,
  listTodos,
);
workbench.post(
  "/api/workbench/teams/:teamId/sets/:setId/todos",
  requireWorkbenchAuth,
  createTodo,
);
workbench.patch(
  "/api/workbench/teams/:teamId/todos/:todoId",
  requireWorkbenchAuth,
  patchTodo,
);
workbench.delete(
  "/api/workbench/teams/:teamId/todos/:todoId",
  requireWorkbenchAuth,
  deleteTodo,
);
workbench.post(
  "/api/workbench/teams/:teamId/todos/reorder",
  requireWorkbenchAuth,
  reorderTodos,
);
workbench.post(
  "/api/workbench/teams/:teamId/todos/:todoId/claim",
  requireWorkbenchAuth,
  claimTodo,
);

// ─── Comments ───────────────────────────────────────────────────────────────
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

// ─── Realtime ───────────────────────────────────────────────────────────────
workbench.all(
  "/api/workbench/teams/:teamId/sets/:setId/ws",
  requireWorkbenchAuth,
  async (c) => {
    const role = getTeamRole(c.get("session"), c.req.param("teamId")!);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);
    return handleWsUpgrade(c);
  },
);
workbench.get(
  "/api/workbench/teams/:teamId/sets/:setId/sse",
  requireWorkbenchAuth,
  async (c) => {
    const role = getTeamRole(c.get("session"), c.req.param("teamId")!);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);
    return handleSse(c);
  },
);

export default workbench;
