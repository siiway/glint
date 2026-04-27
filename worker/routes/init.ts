import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { PrismError } from "@siiway/prism";
import type { Bindings, Variables, AppConfig, SessionData } from "../types";
import {
  getAppConfig,
  setAppConfig,
  getTeamSettings,
  parseAllowedTeamIds,
} from "../config";
import { getPrism, getTeamRole } from "../auth";
import { CROSS_APP_SCOPES } from "../crossAppScopes";

const init = new Hono<{ Bindings: Bindings; Variables: Variables }>();

init.get("/api/init/status", async (c) => {
  const configured = await c.env.KV.get("init:configured");
  return c.json({ configured: configured === "true" });
});

init.get("/api/init/branding", async (c) => {
  const config = await getAppConfig(c.env.KV, c.env);
  const allowedTeamIds = parseAllowedTeamIds(config.allowed_team_id);
  if (allowedTeamIds.length > 0) {
    const settings = await getTeamSettings(c.env.KV, allowedTeamIds[0]);
    return c.json({
      site_name: settings.site_name,
      site_logo_url: settings.site_logo_url,
    });
  }
  return c.json({ site_name: "Glint", site_logo_url: "" });
});

init.get("/api/init/config", async (c) => {
  const configured = await c.env.KV.get("init:configured");
  if (configured === "true") {
    const sessionId = getCookie(c, "session");
    if (!sessionId) return c.json({ error: "Unauthorized" }, 401);
    const cached = await c.env.KV.get(`session:${sessionId}`, "json");
    if (!cached) return c.json({ error: "Unauthorized" }, 401);
    const session = cached as SessionData;
    const config = await getAppConfig(c.env.KV, c.env);
    const allowedTeamIds = parseAllowedTeamIds(config.allowed_team_id);
    if (allowedTeamIds.length > 0) {
      const isOwnerInAllowedTeam = allowedTeamIds.some(
        (teamId) => getTeamRole(session, teamId) === "owner",
      );
      if (!isOwnerInAllowedTeam)
        return c.json({ error: "Only team owner can view app config" }, 403);
    }
  }
  const config = await getAppConfig(c.env.KV, c.env);
  const safeConfig = {
    ...config,
    prism_client_secret: config.prism_client_secret ? "**redacted**" : "",
  };
  return c.json({ config: safeConfig });
});

init.put("/api/init/config", async (c) => {
  const configured = await c.env.KV.get("init:configured");

  if (configured === "true") {
    const sessionId = getCookie(c, "session");
    if (!sessionId) return c.json({ error: "Unauthorized" }, 401);
    const cached = await c.env.KV.get(`session:${sessionId}`, "json");
    if (!cached) return c.json({ error: "Unauthorized" }, 401);
    const session = cached as SessionData;
    const config = await getAppConfig(c.env.KV, c.env);
    const allowedTeamIds = parseAllowedTeamIds(config.allowed_team_id);
    if (allowedTeamIds.length > 0) {
      const isOwnerInAllowedTeam = allowedTeamIds.some(
        (teamId) => getTeamRole(session, teamId) === "owner",
      );
      if (!isOwnerInAllowedTeam)
        return c.json({ error: "Only team owner can change app config" }, 403);
    }
  }

  const body = await c.req.json<Partial<AppConfig>>();
  const allowed: (keyof AppConfig)[] = [
    "prism_base_url",
    "prism_client_id",
    "prism_client_secret",
    "prism_redirect_uri",
    "use_pkce",
    ...(!c.env.ALLOWED_TEAM_ID?.trim()
      ? (["allowed_team_id"] as (keyof AppConfig)[])
      : []),
    "session_ttl",
    "action_bar_defaults",
    "user_profile_cache_ttl",
  ];
  const patch: Partial<AppConfig> = {};
  for (const key of allowed) {
    if (key in body) {
      if (key === "prism_client_secret" && body[key] === "**redacted**")
        continue;
      (patch as Record<string, unknown>)[key] = body[key];
    }
  }

  const updated = await setAppConfig(c.env.KV, patch);
  const safeUpdated = {
    ...updated,
    prism_client_secret: updated.prism_client_secret ? "**redacted**" : "",
  };
  return c.json({ config: safeUpdated });
});

init.post("/api/init/setup", async (c) => {
  const already = await c.env.KV.get("init:configured");
  if (already === "true") return c.json({ error: "Already configured" }, 400);

  const body = await c.req
    .json<{ config?: Partial<AppConfig> }>()
    .catch(() => ({ config: undefined }));
  if (body.config) {
    await setAppConfig(c.env.KV, body.config);
  }

  const statements = [
    `CREATE TABLE IF NOT EXISTS todo_sets (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order REAL NOT NULL DEFAULT 0,
      auto_renew INTEGER NOT NULL DEFAULT 0,
      renew_time TEXT NOT NULL DEFAULT '00:00',
      timezone TEXT NOT NULL DEFAULT '',
      last_renewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_todo_sets_team ON todo_sets(team_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_todo_sets_team_name_unique ON todo_sets(team_id, name)`,
    `CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL REFERENCES todo_sets(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      parent_id TEXT REFERENCES todos(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      claimed_by TEXT DEFAULT NULL,
      sort_order REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_todos_set ON todos(set_id)`,
    `CREATE INDEX IF NOT EXISTS idx_todos_team ON todos(team_id)`,
    `CREATE INDEX IF NOT EXISTS idx_todos_parent ON todos(parent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_todos_set_sort ON todos(set_id, sort_order)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_todos_set_title_unique ON todos(set_id, title)`,
    `CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      todo_id TEXT NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_comments_todo ON comments(todo_id)`,
    `CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'global',
      role TEXT NOT NULL CHECK (role IN ('co-owner', 'admin', 'member')),
      permission TEXT NOT NULL,
      allowed INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(team_id, scope, role, permission)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_permissions_team ON permissions(team_id)`,
    `CREATE INDEX IF NOT EXISTS idx_permissions_team_scope ON permissions(team_id, scope)`,
  ];

  for (const sql of statements) {
    await c.env.DB.prepare(sql).run();
  }

  await c.env.KV.put("init:configured", "true");
  return c.json({ ok: true });
});

/**
 * Register Glint's exported cross-app OAuth scopes with Prism so the consent
 * screen shows friendly titles/descriptions when other apps request them.
 *
 * Authenticates as the Glint OAuth app itself (HTTP Basic with client
 * credentials), so the configured app must have a client secret and
 * `allow_self_register_permissions` enabled in Prism.
 */
init.post("/api/init/register-permissions", async (c) => {
  const sessionId = getCookie(c, "session");
  if (!sessionId) return c.json({ error: "Unauthorized" }, 401);
  const cached = await c.env.KV.get(`session:${sessionId}`, "json");
  if (!cached) return c.json({ error: "Unauthorized" }, 401);
  const session = cached as SessionData;

  const config = await getAppConfig(c.env.KV, c.env);
  const allowedTeamIds = parseAllowedTeamIds(config.allowed_team_id);
  if (allowedTeamIds.length > 0) {
    const isOwner = allowedTeamIds.some(
      (teamId) => getTeamRole(session, teamId) === "owner",
    );
    if (!isOwner)
      return c.json({ error: "Only team owner can register permissions" }, 403);
  }

  if (!config.prism_client_secret) {
    return c.json(
      {
        error:
          "A client secret is required to register permissions as the app. Configure one in App Config (or disable PKCE).",
      },
      400,
    );
  }
  if (!config.prism_client_id) {
    return c.json({ error: "Prism client ID is not configured." }, 400);
  }

  const prism = getPrism(config);
  const results: {
    scope: string;
    ok: boolean;
    error?: string;
  }[] = [];

  for (const def of CROSS_APP_SCOPES) {
    try {
      await prism.appScopePermissions.upsertDefinition(
        session.accessToken,
        config.prism_client_id,
        def,
      );
      results.push({ scope: def.scope, ok: true });
    } catch (err) {
      const message =
        err instanceof PrismError
          ? `${err.message}${err.code ? ` (${err.code})` : ""}`
          : err instanceof Error
            ? err.message
            : "Unknown error";
      results.push({ scope: def.scope, ok: false, error: message });
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  return c.json({
    registered: results.length - failed,
    failed,
    total: results.length,
    results,
  });
});

export default init;
