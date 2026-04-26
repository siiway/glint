/**
 * Cross-application API routes.
 *
 * Bearer-token-authenticated data endpoints for external apps calling Glint
 * on behalf of a user. Scope definitions and access rules are managed directly
 * in Prism — no registration in Glint required.
 *
 * Most handlers are shared with the cookie-authenticated /api/* routes via
 * the worker/handlers/* modules. The crossAppRoute helper attaches the
 * `requireCrossAppAuth(scope)` middleware and prefixes paths with /api/cross-app.
 *
 * Scope → Glint permission mapping:
 *   read_todos      → view_todos                              (GET sets, todos, comments, export, realtime)
 *   create_todos    → create_todos / add_subtodos             (POST todo, import-into-set)
 *   edit_todos      → edit_own_todos / edit_any_todo          (PATCH todo title)
 *   complete_todos  → complete_any_todo                       (PATCH todo completion)
 *   delete_todos    → delete_own_todos / delete_any_todo      (DELETE todo)
 *   reorder_todos   → reorder_todos                           (POST todos/reorder, PATCH todo sortOrder)
 *   claim_todos     → claim_todos                             (POST todos/:id/claim)
 *   manage_sets     → manage_sets                             (POST/PATCH/DELETE set, reorder, import)
 *   read_settings   → (team membership only)                  (GET settings)
 *   manage_settings → manage_settings                         (PATCH settings)
 *   comment         → comment                                 (POST comment)
 *   delete_comments → delete_own_comments / delete_any_comment (DELETE comment)
 *   write_todos     → legacy catch-all for create/edit/complete
 */

import { Hono } from "hono";
import type { Context } from "hono";
import type { Bindings, Variables } from "../types";
import { getTeamRole } from "../auth";
import { hasCrossAppScope } from "../cross-app-auth";
import { crossAppRoute } from "../crossAppRoute";
import {
  createSet,
  deleteSet,
  exportSet,
  importIntoSet,
  importNewSet,
  listSets,
  patchSet,
  reorderSets,
} from "../handlers/sets";
import {
  claimTodo,
  createTodo,
  deleteTodo,
  listTodos,
  reorderTodos,
} from "../handlers/todos";
import {
  createComment,
  deleteComment,
  listComments,
} from "../handlers/comments";
import { getSettings, patchSettings } from "../handlers/settings";
import { getCrossAppMe } from "../handlers/me";
import { handleSse, handleWsUpgrade } from "../realtime";
import { patchTodo } from "../handlers/todos";
import { getOverview, getMyTodos, getFeed } from "../handlers/dashboard";
import {
  getPermissionsMe,
  getPermissionsAll,
  upsertPermissions,
  deletePermissions,
} from "../handlers/permissions";

const crossApp = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const route = crossAppRoute(crossApp);

type Ctx = Context<{ Bindings: Bindings; Variables: Variables }>;

// ─── Identity ───────────────────────────────────────────────────────────────
// `read_todos` is the lowest-friction scope already used by every integration;
// we reuse it as the gate for /me so apps don't need an extra scope just to
// resolve the calling user.
route.get("/me", "read_todos", getCrossAppMe);

// ─── Sets ───────────────────────────────────────────────────────────────────
route.get("/teams/:teamId/sets", "read_todos", listSets);
route.post("/teams/:teamId/sets", "manage_sets", createSet);
route.patch("/teams/:teamId/sets/:setId", "manage_sets", patchSet);
route.delete("/teams/:teamId/sets/:setId", "manage_sets", deleteSet);
route.post("/teams/:teamId/sets/reorder", "manage_sets", reorderSets);
route.get("/teams/:teamId/sets/:setId/export", "read_todos", exportSet);
route.post(
  "/teams/:teamId/sets/:setId/import",
  ["create_todos", "write_todos"],
  importIntoSet,
);
route.post("/teams/:teamId/sets/import", "manage_sets", importNewSet);

// ─── Todos ──────────────────────────────────────────────────────────────────
route.get("/teams/:teamId/sets/:setId/todos", "read_todos", listTodos);
route.post(
  "/teams/:teamId/sets/:setId/todos",
  ["create_todos", "write_todos"],
  createTodo,
);
route.post("/teams/:teamId/todos/reorder", "reorder_todos", reorderTodos);
route.delete("/teams/:teamId/todos/:todoId", "delete_todos", deleteTodo);
route.post("/teams/:teamId/todos/:todoId/claim", "claim_todos", claimTodo);

// PATCH todo: scope-per-field gate. The shared handler already checks Glint
// permissions; we only add the cross-app scope-per-field gate on top.
route.patch(
  "/teams/:teamId/todos/:todoId",
  ["edit_todos", "complete_todos", "reorder_todos", "write_todos"],
  async (c: Ctx) => {
    const body = (await c.req.json()) as {
      title?: string;
      completed?: boolean;
      sortOrder?: number;
    };

    if (
      body.title !== undefined &&
      !hasCrossAppScope(c, "edit_todos", "write_todos")
    ) {
      return c.json(
        { error: "Missing required scope: edit_todos or write_todos" },
        403,
      );
    }
    if (
      body.completed !== undefined &&
      !hasCrossAppScope(c, "complete_todos", "write_todos")
    ) {
      return c.json(
        { error: "Missing required scope: complete_todos or write_todos" },
        403,
      );
    }
    if (body.sortOrder !== undefined && !hasCrossAppScope(c, "reorder_todos")) {
      return c.json({ error: "Missing required scope: reorder_todos" }, 403);
    }

    return patchTodo(c);
  },
);

// ─── Comments ───────────────────────────────────────────────────────────────
route.get("/teams/:teamId/todos/:todoId/comments", "read_todos", listComments);
route.post("/teams/:teamId/todos/:todoId/comments", "comment", createComment);
route.delete(
  "/teams/:teamId/todos/:todoId/comments/:commentId",
  "delete_comments",
  deleteComment,
);

// ─── Settings ───────────────────────────────────────────────────────────────
route.get("/teams/:teamId/settings", "read_settings", getSettings);
route.patch("/teams/:teamId/settings", "manage_settings", patchSettings);

// ─── Dashboard (workbench-style aggregations) ───────────────────────────────
// All three reuse `read_todos` since they're aggregated views over the same
// data class as listTodos / listSets.
route.get("/teams/:teamId/overview", "read_todos", getOverview);
route.get("/teams/:teamId/my-todos", "read_todos", getMyTodos);
route.get("/teams/:teamId/feed", "read_todos", getFeed);

// ─── Permissions ────────────────────────────────────────────────────────────
// Reading effective permissions for the calling user uses the lowest-friction
// scope; reading or writing the full matrix requires `manage_permissions`.
route.get("/teams/:teamId/permissions/me", "read_todos", getPermissionsMe);
route.get("/teams/:teamId/permissions", "manage_permissions", getPermissionsAll);
route.put("/teams/:teamId/permissions", "manage_permissions", upsertPermissions);
route.delete(
  "/teams/:teamId/permissions",
  "manage_permissions",
  deletePermissions,
);

// ─── Realtime ───────────────────────────────────────────────────────────────
// Both endpoints require team membership. WebSocket upgrades from non-browser
// clients can carry the Authorization header normally.
route.all("/teams/:teamId/sets/:setId/ws", "read_todos", async (c: Ctx) => {
  const role = getTeamRole(c.get("session"), c.req.param("teamId")!);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);
  return handleWsUpgrade(c);
});
route.get("/teams/:teamId/sets/:setId/sse", "read_todos", async (c: Ctx) => {
  const role = getTeamRole(c.get("session"), c.req.param("teamId")!);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);
  return handleSse(c);
});

export default crossApp;
