import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { requireAuth } from "../auth";
import {
  getPermissionsAll,
  getPermissionsMe,
  upsertPermissions,
  deletePermissions,
} from "../handlers/permissions";

const permissions = new Hono<{ Bindings: Bindings; Variables: Variables }>();

permissions.get("/api/teams/:teamId/permissions", requireAuth, getPermissionsAll);
permissions.get(
  "/api/teams/:teamId/permissions/me",
  requireAuth,
  getPermissionsMe,
);
permissions.put("/api/teams/:teamId/permissions", requireAuth, upsertPermissions);
permissions.delete(
  "/api/teams/:teamId/permissions",
  requireAuth,
  deletePermissions,
);

export default permissions;
