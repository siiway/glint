import type { PermissionKey, TeamRole } from "./types";
import { DEFAULT_PERMISSIONS } from "./types";

export async function getPermissions(
  db: D1Database,
  teamId: string,
  scope: string = "global",
): Promise<Record<string, Record<PermissionKey, boolean>>> {
  const rows = await db
    .prepare(
      "SELECT role, permission, allowed FROM permissions WHERE team_id = ? AND scope = ?",
    )
    .bind(teamId, scope)
    .all();

  const result: Record<string, Record<string, boolean>> = {
    admin: { ...DEFAULT_PERMISSIONS.admin },
    member: { ...DEFAULT_PERMISSIONS.member },
  };

  for (const row of rows.results) {
    const role = row.role as string;
    const perm = row.permission as string;
    if (result[role] && perm in DEFAULT_PERMISSIONS.admin) {
      result[role][perm] = row.allowed === 1;
    }
  }

  return result as Record<string, Record<PermissionKey, boolean>>;
}

export async function hasPermission(
  db: D1Database,
  teamId: string,
  role: TeamRole,
  permission: PermissionKey,
  setId?: string,
): Promise<boolean> {
  if (role === "owner") return true;

  // Check per-set override first
  if (setId) {
    const setRow = await db
      .prepare(
        "SELECT allowed FROM permissions WHERE team_id = ? AND scope = ? AND role = ? AND permission = ?",
      )
      .bind(teamId, `set:${setId}`, role, permission)
      .first<{ allowed: number }>();
    if (setRow) return setRow.allowed === 1;
  }

  // Check global override
  const globalRow = await db
    .prepare(
      "SELECT allowed FROM permissions WHERE team_id = ? AND scope = 'global' AND role = ? AND permission = ?",
    )
    .bind(teamId, role, permission)
    .first<{ allowed: number }>();
  if (globalRow) return globalRow.allowed === 1;

  // Fall back to defaults
  return DEFAULT_PERMISSIONS[role]?.[permission] ?? false;
}
