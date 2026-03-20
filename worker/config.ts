import type { AppConfig, TeamSettings } from "./types";
import { DEFAULT_APP_CONFIG, DEFAULT_SETTINGS } from "./types";

export async function getAppConfig(kv: KVNamespace): Promise<AppConfig> {
  const raw = await kv.get("config:app", "json");
  if (!raw) return { ...DEFAULT_APP_CONFIG };
  return { ...DEFAULT_APP_CONFIG, ...(raw as Partial<AppConfig>) };
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
  if (!raw) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...(raw as Partial<TeamSettings>) };
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
