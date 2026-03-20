import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { PERMISSION_KEYS, DEFAULT_PERMISSIONS } from "../types";
import { requireAuth, getTeamRole } from "../auth";
import { getPermissions, hasPermission } from "../permissions";

const permissions = new Hono<{ Bindings: Bindings; Variables: Variables }>();

permissions.get("/api/teams/:teamId/permissions", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
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
});

permissions.get("/api/teams/:teamId/permissions/me", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const setId = c.req.query("setId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const effective: Record<string, boolean> = {};
  for (const key of PERMISSION_KEYS) {
    effective[key] = await hasPermission(c.env.DB, teamId, role, key, setId);
  }

  return c.json({ permissions: effective, role });
});

permissions.put("/api/teams/:teamId/permissions", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const canEdit = await hasPermission(
    c.env.DB,
    teamId,
    role,
    "manage_permissions",
  );
  if (!canEdit)
    return c.json({ error: "No permission to manage permissions" }, 403);

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

  if (role !== "owner") {
    const forbidden = perms.filter(
      (p) => p.permission === "manage_permissions" && p.allowed,
    );
    if (forbidden.length > 0) {
      return c.json({ error: "Only owners can grant manage_permissions" }, 403);
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
});

permissions.delete("/api/teams/:teamId/permissions", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const scope = c.req.query("scope") || "global";
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const canEdit = await hasPermission(
    c.env.DB,
    teamId,
    role,
    "manage_permissions",
  );
  if (!canEdit)
    return c.json({ error: "No permission to manage permissions" }, 403);

  await c.env.DB.prepare(
    "DELETE FROM permissions WHERE team_id = ? AND scope = ?",
  )
    .bind(teamId, scope)
    .run();

  return c.json({ ok: true });
});

export default permissions;
