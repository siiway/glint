import type { AppConfig, TeamSettings } from "./types";
import { DEFAULT_APP_CONFIG, DEFAULT_SETTINGS } from "./types";

export function parseAllowedTeamIds(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Resolve which team(s) gate access to app-config administration (viewing /
 * changing app config, registering permissions). Prefers the dedicated
 * `owner_team_id`; falls back to `allowed_team_id` for backward compatibility
 * when it is not set.
 */
export function resolveOwnerTeamIds(config: AppConfig): string[] {
  const owners = parseAllowedTeamIds(config.owner_team_id);
  if (owners.length > 0) return owners;
  return parseAllowedTeamIds(config.allowed_team_id);
}

export async function getAppConfig(
  kv: KVNamespace,
  env?: { ALLOWED_TEAM_ID?: string },
): Promise<AppConfig> {
  const raw = await kv.get("config:app", "json");
  const base: AppConfig = {
    ...DEFAULT_APP_CONFIG,
    ...((raw as Partial<AppConfig> | null) ?? {}),
  };
  if (env?.ALLOWED_TEAM_ID?.trim()) {
    base.allowed_team_id = env.ALLOWED_TEAM_ID.trim();
    base.allowed_team_id_from_env = true;
  }
  return base;
}

export async function setAppConfig(
  kv: KVNamespace,
  patch: Partial<AppConfig>,
): Promise<AppConfig> {
  const current = await getAppConfig(kv);
  const updated = { ...current, ...patch };
  await kv.put("config:app", JSON.stringify(updated));
  return updated;
}

export async function getTeamSettings(
  kv: KVNamespace,
  teamId: string,
): Promise<TeamSettings> {
  const raw = await kv.get(`team_settings:${teamId}`, "json");
  return {
    ...DEFAULT_SETTINGS,
    ...((raw as Partial<TeamSettings> | null) ?? {}),
  };
}

export async function setTeamSettings(
  kv: KVNamespace,
  teamId: string,
  settings: Partial<TeamSettings>,
): Promise<TeamSettings> {
  const current = await getTeamSettings(kv, teamId);
  const updated = { ...current, ...settings };
  await kv.put(`team_settings:${teamId}`, JSON.stringify(updated));
  return updated;
}

export async function ensureDefaultSet(
  db: D1Database,
  kv: KVNamespace,
  teamId: string,
  userId: string,
): Promise<void> {
  const settings = await getTeamSettings(kv, teamId);
  const name = settings.default_set_name || "Not Grouped";
  const existing = await db
    .prepare("SELECT id FROM todo_sets WHERE team_id = ? AND name = ? LIMIT 1")
    .bind(teamId, name)
    .first();
  if (existing) return;
  await db
    .prepare(
      "INSERT INTO todo_sets (id, team_id, user_id, name, sort_order) VALUES (?, ?, ?, ?, 0)",
    )
    .bind(crypto.randomUUID(), teamId, userId, name)
    .run();
}
