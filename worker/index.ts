import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { PrismClient } from "@siiway/prism";

// ─── Types ───────────────────────────────────────────────────────────────────

type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
};

// ─── App Config (KV) ────────────────────────────────────────────────────────

type AppConfig = {
  prism_base_url: string;
  prism_client_id: string;
  prism_client_secret: string;
  prism_redirect_uri: string;
  use_pkce: boolean;
  allowed_team_id: string;
};

const DEFAULT_APP_CONFIG: AppConfig = {
  prism_base_url: "",
  prism_client_id: "",
  prism_client_secret: "",
  prism_redirect_uri: "",
  use_pkce: true,
  allowed_team_id: "",
};

async function getAppConfig(kv: KVNamespace): Promise<AppConfig> {
  const raw = await kv.get("config:app", "json");
  if (!raw) return { ...DEFAULT_APP_CONFIG };
  return { ...DEFAULT_APP_CONFIG, ...(raw as Partial<AppConfig>) };
}

async function setAppConfig(
  kv: KVNamespace,
  patch: Partial<AppConfig>,
): Promise<AppConfig> {
  const current = await getAppConfig(kv);
  const updated = { ...current, ...patch };
  await kv.put("config:app", JSON.stringify(updated));
  return updated;
}

type TeamRole = "owner" | "admin" | "member";

type TeamInfo = {
  id: string;
  name: string;
  role: TeamRole;
};

type SessionData = {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  accessToken: string;
  expiresAt: number;
  teams: TeamInfo[];
};

type Variables = {
  session: SessionData;
};

// ─── Permission keys ─────────────────────────────────────────────────────────
// These are all the granular permission keys in the system.
// Owner always has all permissions (hardcoded, never stored).
// Admin/member defaults are defined below; overrides are stored in DB.

const PERMISSION_KEYS = [
  // Global team-level
  "manage_settings", // Edit site name, logo, branding
  "manage_permissions", // Edit permission rules (owner-only by default)
  "manage_sets", // Create/rename/delete/reorder sets
  "create_todos", // Create new todos
  "edit_own_todos", // Edit own todos
  "edit_any_todo", // Edit anyone's todos
  "delete_own_todos", // Delete own todos
  "delete_any_todo", // Delete anyone's todos
  "complete_any_todo", // Toggle complete on anyone's todos
  "add_subtodos", // Add sub-todos
  "reorder_todos", // Reorder todos
  "comment", // Add comments
  "delete_own_comments", // Delete own comments
  "delete_any_comment", // Delete anyone's comments
  "view_todos", // View todos (can be restricted per-set)
] as const;

type PermissionKey = (typeof PERMISSION_KEYS)[number];

// Defaults: what admins and members can do out of the box
const DEFAULT_PERMISSIONS: Record<
  "admin" | "member",
  Record<PermissionKey, boolean>
> = {
  admin: {
    manage_settings: false,
    manage_permissions: false,
    manage_sets: true,
    create_todos: true,
    edit_own_todos: true,
    edit_any_todo: true,
    delete_own_todos: true,
    delete_any_todo: true,
    complete_any_todo: true,
    add_subtodos: true,
    reorder_todos: true,
    comment: true,
    delete_own_comments: true,
    delete_any_comment: true,
    view_todos: true,
  },
  member: {
    manage_settings: false,
    manage_permissions: false,
    manage_sets: false,
    create_todos: true,
    edit_own_todos: true,
    edit_any_todo: false,
    delete_own_todos: true,
    delete_any_todo: false,
    complete_any_todo: false,
    add_subtodos: true,
    reorder_todos: false,
    comment: true,
    delete_own_comments: true,
    delete_any_comment: false,
    view_todos: true,
  },
};

// ─── Team Settings (KV) ─────────────────────────────────────────────────────

type TeamSettings = {
  site_name: string;
  site_logo_url: string;
  accent_color: string;
  welcome_message: string;
  default_set_name: string;
  allow_member_create_sets: boolean;
};

const DEFAULT_SETTINGS: TeamSettings = {
  site_name: "Glint",
  site_logo_url: "",
  accent_color: "",
  welcome_message: "",
  default_set_name: "Not Grouped",
  allow_member_create_sets: false,
};

async function getTeamSettings(
  kv: KVNamespace,
  teamId: string,
): Promise<TeamSettings> {
  const raw = await kv.get(`team_settings:${teamId}`, "json");
  if (!raw) return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...(raw as Partial<TeamSettings>) };
}

async function setTeamSettings(
  kv: KVNamespace,
  teamId: string,
  settings: Partial<TeamSettings>,
): Promise<TeamSettings> {
  const current = await getTeamSettings(kv, teamId);
  const updated = { ...current, ...settings };
  await kv.put(`team_settings:${teamId}`, JSON.stringify(updated));
  return updated;
}

// ─── Permission helpers ──────────────────────────────────────────────────────

async function getPermissions(
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

async function hasPermission(
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

// ─── Prism / Auth helpers ────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function getPrism(config: AppConfig) {
  return new PrismClient({
    baseUrl: config.prism_base_url,
    clientId: config.prism_client_id,
    clientSecret: config.prism_client_secret || undefined,
    redirectUri: config.prism_redirect_uri,
    scopes: ["openid", "profile", "email", "teams:read"],
  });
}

async function fetchUserTeams(
  prism: PrismClient,
  accessToken: string,
): Promise<TeamInfo[]> {
  try {
    const teams = await prism.teams.oauthList(accessToken);
    return teams.map((t) => ({
      id: t.id,
      name: t.name,
      role: (t.role as TeamRole) ?? "member",
    }));
  } catch {
    return [];
  }
}

const requireAuth = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables;
}>(async (c, next) => {
  const sessionId = getCookie(c, "session");
  if (!sessionId) return c.json({ error: "Unauthorized" }, 401);

  const cached = await c.env.KV.get(`session:${sessionId}`, "json");
  if (!cached) {
    deleteCookie(c, "session");
    return c.json({ error: "Session expired" }, 401);
  }

  const session = cached as SessionData;
  if (Date.now() > session.expiresAt) {
    await c.env.KV.delete(`session:${sessionId}`);
    deleteCookie(c, "session");
    return c.json({ error: "Session expired" }, 401);
  }

  c.set("session", session);
  await next();
});

function getTeamRole(session: SessionData, teamId: string): TeamRole | null {
  return session.teams.find((t) => t.id === teamId)?.role ?? null;
}

async function ensureDefaultSet(
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

// ─── Init/Setup ──────────────────────────────────────────────────────────────

app.get("/api/init/status", async (c) => {
  const configured = await c.env.KV.get("init:configured");
  return c.json({ configured: configured === "true" });
});

// Public branding endpoint (no auth)
app.get("/api/init/branding", async (c) => {
  const config = await getAppConfig(c.env.KV);
  if (config.allowed_team_id) {
    const settings = await getTeamSettings(c.env.KV, config.allowed_team_id);
    return c.json({
      site_name: settings.site_name,
      site_logo_url: settings.site_logo_url,
    });
  }
  return c.json({ site_name: "Glint", site_logo_url: "" });
});

// Get app config (public, needed by init page)
app.get("/api/init/config", async (c) => {
  const config = await getAppConfig(c.env.KV);
  return c.json({ config });
});

// Save app config (owner-only once configured, or anyone during init)
app.put("/api/init/config", async (c) => {
  const configured = await c.env.KV.get("init:configured");

  if (configured === "true") {
    // After init, only authenticated owners can change config
    const sessionId = getCookie(c, "session");
    if (!sessionId) return c.json({ error: "Unauthorized" }, 401);
    const cached = await c.env.KV.get(`session:${sessionId}`, "json");
    if (!cached) return c.json({ error: "Unauthorized" }, 401);
    const session = cached as SessionData;
    const config = await getAppConfig(c.env.KV);
    if (config.allowed_team_id) {
      const role = getTeamRole(session, config.allowed_team_id);
      if (role !== "owner")
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
    "allowed_team_id",
  ];
  const patch: Partial<AppConfig> = {};
  for (const key of allowed) {
    if (key in body) (patch as Record<string, unknown>)[key] = body[key];
  }

  const updated = await setAppConfig(c.env.KV, patch);
  return c.json({ config: updated });
});

app.post("/api/init/setup", async (c) => {
  const already = await c.env.KV.get("init:configured");
  if (already === "true") return c.json({ error: "Already configured" }, 400);

  // Accept optional app config in the setup request
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_todo_sets_team ON todo_sets(team_id)`,
    `CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL REFERENCES todo_sets(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      parent_id TEXT REFERENCES todos(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      sort_order REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_todos_set ON todos(set_id)`,
    `CREATE INDEX IF NOT EXISTS idx_todos_team ON todos(team_id)`,
    `CREATE INDEX IF NOT EXISTS idx_todos_parent ON todos(parent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_todos_set_sort ON todos(set_id, sort_order)`,
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
      role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
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

// ─── Auth ────────────────────────────────────────────────────────────────────

app.get("/api/auth/config", async (c) => {
  const config = await getAppConfig(c.env.KV);
  return c.json({
    baseUrl: config.prism_base_url,
    clientId: config.prism_client_id,
    redirectUri: config.prism_redirect_uri,
    usePkce: config.use_pkce,
  });
});

app.get("/api/auth/me", async (c) => {
  const sessionId = getCookie(c, "session");
  if (!sessionId) return c.json({ user: null });

  const cached = await c.env.KV.get(`session:${sessionId}`, "json");
  if (!cached) {
    deleteCookie(c, "session");
    return c.json({ user: null });
  }

  const session = cached as SessionData;
  if (Date.now() > session.expiresAt) {
    await c.env.KV.delete(`session:${sessionId}`);
    deleteCookie(c, "session");
    return c.json({ user: null });
  }

  return c.json({
    user: {
      id: session.userId,
      username: session.username,
      displayName: session.displayName,
      avatarUrl: session.avatarUrl,
      teams: session.teams,
    },
  });
});

app.post("/api/auth/callback", async (c) => {
  const { code, codeVerifier } = await c.req.json<{
    code: string;
    codeVerifier?: string;
  }>();

  const config = await getAppConfig(c.env.KV);
  const prism = getPrism(config);

  let tokens;
  try {
    // PKCE flow sends codeVerifier; confidential client flow does not
    tokens = await prism.exchangeCode(code, codeVerifier ?? "");
  } catch (e) {
    console.error("exchangeCode failed:", e);
    return c.json(
      { error: e instanceof Error ? e.message : "Token exchange failed" },
      401,
    );
  }

  const userInfo = await prism.getUserInfo(tokens.access_token);
  const teams = await fetchUserTeams(prism, tokens.access_token);

  if (
    config.allowed_team_id &&
    !teams.some((t) => t.id === config.allowed_team_id)
  ) {
    return c.json({ error: "You are not a member of the allowed team" }, 403);
  }

  const sessionId = crypto.randomUUID();
  const session: SessionData = {
    userId: userInfo.sub,
    username: userInfo.preferred_username || userInfo.name || userInfo.sub,
    displayName: userInfo.name,
    avatarUrl: userInfo.picture,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
    teams,
  };

  await c.env.KV.put(`session:${sessionId}`, JSON.stringify(session), {
    expirationTtl: tokens.expires_in || 3600,
  });

  setCookie(c, "session", sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: tokens.expires_in || 3600,
  });

  return c.json({
    user: {
      id: session.userId,
      username: session.username,
      displayName: session.displayName,
      avatarUrl: session.avatarUrl,
      teams: session.teams,
    },
  });
});

app.post("/api/auth/logout", async (c) => {
  const sessionId = getCookie(c, "session");
  if (sessionId) {
    await c.env.KV.delete(`session:${sessionId}`);
    deleteCookie(c, "session");
  }
  return c.json({ ok: true });
});

// ─── Team Settings ───────────────────────────────────────────────────────────

app.get("/api/teams/:teamId/settings", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const settings = await getTeamSettings(c.env.KV, teamId);
  return c.json({ settings });
});

app.patch("/api/teams/:teamId/settings", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const canEdit = await hasPermission(
    c.env.DB,
    teamId,
    role,
    "manage_settings",
  );
  if (!canEdit)
    return c.json({ error: "No permission to manage settings" }, 403);

  const body = await c.req.json<Partial<TeamSettings>>();

  // Validate — only allow known keys
  const allowed: (keyof TeamSettings)[] = [
    "site_name",
    "site_logo_url",
    "accent_color",
    "welcome_message",
    "default_set_name",
    "allow_member_create_sets",
  ];

  const patch: Partial<TeamSettings> = {};
  for (const key of allowed) {
    if (key in body) {
      (patch as Record<string, unknown>)[key] = body[key];
    }
  }

  const settings = await setTeamSettings(c.env.KV, teamId, patch);
  return c.json({ settings });
});

// ─── Permissions ─────────────────────────────────────────────────────────────

// Get all permissions for a team (global + all set overrides)
app.get("/api/teams/:teamId/permissions", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  // All members can read permissions (to know what they can do)
  const globalPerms = await getPermissions(c.env.DB, teamId, "global");

  // Get all set-level overrides
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

// Get effective permissions for current user in a specific context
app.get("/api/teams/:teamId/permissions/me", requireAuth, async (c) => {
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

// Update permissions (owner only, or admin with manage_permissions)
app.put("/api/teams/:teamId/permissions", requireAuth, async (c) => {
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

  const { scope, permissions } = await c.req.json<{
    scope: string; // "global" or "set:<setId>"
    permissions: {
      role: "admin" | "member";
      permission: string;
      allowed: boolean;
    }[];
  }>();

  if (!scope || !permissions?.length) {
    return c.json({ error: "scope and permissions required" }, 400);
  }

  // Validate scope format
  if (scope !== "global" && !scope.startsWith("set:")) {
    return c.json({ error: "Invalid scope" }, 400);
  }

  // Non-owners cannot grant manage_permissions
  if (role !== "owner") {
    const forbidden = permissions.filter(
      (p) => p.permission === "manage_permissions" && p.allowed,
    );
    if (forbidden.length > 0) {
      return c.json({ error: "Only owners can grant manage_permissions" }, 403);
    }
  }

  const stmts = permissions.map((p) =>
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

// Reset permissions for a scope (delete overrides, revert to defaults)
app.delete("/api/teams/:teamId/permissions", requireAuth, async (c) => {
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

// ─── Todo Sets ───────────────────────────────────────────────────────────────

app.get("/api/teams/:teamId/sets", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  await ensureDefaultSet(c.env.DB, c.env.KV, teamId, session.userId);

  const result = await c.env.DB.prepare(
    "SELECT id, user_id, name, sort_order, created_at FROM todo_sets WHERE team_id = ? ORDER BY sort_order ASC",
  )
    .bind(teamId)
    .all();

  return c.json({
    sets: result.results.map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      name: r.name as string,
      sortOrder: r.sort_order as number,
      createdAt: r.created_at as string,
    })),
    role,
  });
});

app.post("/api/teams/:teamId/sets", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
    return c.json({ error: "No permission to manage sets" }, 403);
  }

  const { name } = await c.req.json<{ name: string }>();
  if (!name?.trim()) return c.json({ error: "Name is required" }, 400);

  const maxRow = await c.env.DB.prepare(
    "SELECT COALESCE(MAX(sort_order), 0) as m FROM todo_sets WHERE team_id = ?",
  )
    .bind(teamId)
    .first<{ m: number }>();

  const id = crypto.randomUUID();
  const sortOrder = (maxRow?.m ?? 0) + 1;

  await c.env.DB.prepare(
    "INSERT INTO todo_sets (id, team_id, user_id, name, sort_order) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, teamId, session.userId, name.trim(), sortOrder)
    .run();

  return c.json(
    {
      set: {
        id,
        userId: session.userId,
        name: name.trim(),
        sortOrder,
        createdAt: new Date().toISOString(),
      },
    },
    201,
  );
});

app.patch("/api/teams/:teamId/sets/:setId", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const setId = c.req.param("setId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
    const existing = await c.env.DB.prepare(
      "SELECT user_id FROM todo_sets WHERE id = ? AND team_id = ?",
    )
      .bind(setId, teamId)
      .first<{ user_id: string }>();
    if (!existing || existing.user_id !== session.userId) {
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  const { name } = await c.req.json<{ name: string }>();
  if (!name?.trim()) return c.json({ error: "Name is required" }, 400);

  await c.env.DB.prepare(
    "UPDATE todo_sets SET name = ?, updated_at = datetime('now') WHERE id = ? AND team_id = ?",
  )
    .bind(name.trim(), setId, teamId)
    .run();

  return c.json({ ok: true });
});

app.delete("/api/teams/:teamId/sets/:setId", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const setId = c.req.param("setId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
    const existing = await c.env.DB.prepare(
      "SELECT user_id FROM todo_sets WHERE id = ? AND team_id = ?",
    )
      .bind(setId, teamId)
      .first<{ user_id: string }>();
    if (!existing || existing.user_id !== session.userId) {
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  await c.env.DB.prepare("DELETE FROM todo_sets WHERE id = ? AND team_id = ?")
    .bind(setId, teamId)
    .run();

  return c.json({ ok: true });
});

app.post("/api/teams/:teamId/sets/reorder", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
    return c.json({ error: "No permission" }, 403);
  }

  const { items } = await c.req.json<{
    items: { id: string; sortOrder: number }[];
  }>();
  if (!items?.length) return c.json({ error: "No items" }, 400);

  await c.env.DB.batch(
    items.map(({ id, sortOrder }) =>
      c.env.DB.prepare(
        "UPDATE todo_sets SET sort_order = ?, updated_at = datetime('now') WHERE id = ? AND team_id = ?",
      ).bind(sortOrder, id, teamId),
    ),
  );
  return c.json({ ok: true });
});

// ─── Todos ───────────────────────────────────────────────────────────────────

app.get("/api/teams/:teamId/sets/:setId/todos", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const setId = c.req.param("setId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "view_todos", setId))) {
    return c.json({ error: "No permission to view todos in this set" }, 403);
  }

  const result = await c.env.DB.prepare(
    "SELECT id, user_id, parent_id, title, completed, sort_order, created_at, updated_at FROM todos WHERE set_id = ? AND team_id = ? ORDER BY sort_order ASC, created_at ASC",
  )
    .bind(setId, teamId)
    .all();

  const commentCounts = await c.env.DB.prepare(
    "SELECT todo_id, COUNT(*) as count FROM comments WHERE todo_id IN (SELECT id FROM todos WHERE set_id = ? AND team_id = ?) GROUP BY todo_id",
  )
    .bind(setId, teamId)
    .all();

  const countMap: Record<string, number> = {};
  for (const r of commentCounts.results) {
    countMap[r.todo_id as string] = r.count as number;
  }

  // Fetch effective permissions for this user in this set
  const perms: Record<string, boolean> = {};
  for (const key of PERMISSION_KEYS) {
    perms[key] = await hasPermission(c.env.DB, teamId, role, key, setId);
  }

  return c.json({
    todos: result.results.map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      parentId: (row.parent_id as string) || null,
      title: row.title as string,
      completed: row.completed === 1,
      sortOrder: row.sort_order as number,
      commentCount: countMap[row.id as string] ?? 0,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    })),
    role,
    permissions: perms,
  });
});

app.post("/api/teams/:teamId/sets/:setId/todos", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const setId = c.req.param("setId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const { title, parentId } = await c.req.json<{
    title: string;
    parentId?: string;
  }>();
  if (!title?.trim()) return c.json({ error: "Title is required" }, 400);

  // Check permission: creating a sub-todo requires add_subtodos, else create_todos
  const permKey: PermissionKey = parentId ? "add_subtodos" : "create_todos";
  if (!(await hasPermission(c.env.DB, teamId, role, permKey, setId))) {
    return c.json({ error: `No permission: ${permKey}` }, 403);
  }

  if (parentId) {
    const parent = await c.env.DB.prepare(
      "SELECT id FROM todos WHERE id = ? AND set_id = ? AND team_id = ?",
    )
      .bind(parentId, setId, teamId)
      .first();
    if (!parent) return c.json({ error: "Parent todo not found" }, 404);
  }

  const maxRow = await c.env.DB.prepare(
    `SELECT COALESCE(MAX(sort_order), 0) as m FROM todos WHERE ${
      parentId ? "parent_id = ?" : "set_id = ? AND parent_id IS NULL"
    } AND team_id = ?`,
  )
    .bind(parentId ?? setId, teamId)
    .first<{ m: number }>();

  const id = crypto.randomUUID();
  const sortOrder = (maxRow?.m ?? 0) + 1;

  await c.env.DB.prepare(
    "INSERT INTO todos (id, set_id, team_id, user_id, parent_id, title, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      id,
      setId,
      teamId,
      session.userId,
      parentId ?? null,
      title.trim(),
      sortOrder,
    )
    .run();

  return c.json(
    {
      todo: {
        id,
        userId: session.userId,
        parentId: parentId ?? null,
        title: title.trim(),
        completed: false,
        sortOrder,
        commentCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
    201,
  );
});

app.patch("/api/teams/:teamId/todos/:id", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const todoId = c.req.param("id");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const existing = await c.env.DB.prepare(
    "SELECT id, user_id, set_id FROM todos WHERE id = ? AND team_id = ?",
  )
    .bind(todoId, teamId)
    .first<{ id: string; user_id: string; set_id: string }>();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const isOwner = existing.user_id === session.userId;
  const body = await c.req.json<{
    title?: string;
    completed?: boolean;
    sortOrder?: number;
  }>();

  // Permission checks
  if (body.title !== undefined) {
    const perm: PermissionKey = isOwner ? "edit_own_todos" : "edit_any_todo";
    if (!(await hasPermission(c.env.DB, teamId, role, perm, existing.set_id))) {
      return c.json({ error: "No permission to edit" }, 403);
    }
  }
  if (body.completed !== undefined && !isOwner) {
    if (
      !(await hasPermission(
        c.env.DB,
        teamId,
        role,
        "complete_any_todo",
        existing.set_id,
      ))
    ) {
      return c.json({ error: "No permission to toggle completion" }, 403);
    }
  }
  if (body.sortOrder !== undefined) {
    if (
      !(await hasPermission(
        c.env.DB,
        teamId,
        role,
        "reorder_todos",
        existing.set_id,
      ))
    ) {
      return c.json({ error: "No permission to reorder" }, 403);
    }
  }

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (body.title !== undefined) {
    updates.push("title = ?");
    values.push(body.title.trim());
  }
  if (body.completed !== undefined) {
    updates.push("completed = ?");
    values.push(body.completed ? 1 : 0);
  }
  if (body.sortOrder !== undefined) {
    updates.push("sort_order = ?");
    values.push(body.sortOrder);
  }

  if (updates.length === 0) return c.json({ error: "No updates" }, 400);

  updates.push("updated_at = datetime('now')");
  values.push(todoId, teamId);

  await c.env.DB.prepare(
    `UPDATE todos SET ${updates.join(", ")} WHERE id = ? AND team_id = ?`,
  )
    .bind(...values)
    .run();

  return c.json({ ok: true });
});

app.post("/api/teams/:teamId/todos/reorder", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "reorder_todos"))) {
    return c.json({ error: "No permission to reorder" }, 403);
  }

  const { items } = await c.req.json<{
    items: { id: string; sortOrder: number }[];
  }>();
  if (!items?.length) return c.json({ error: "No items" }, 400);

  await c.env.DB.batch(
    items.map(({ id, sortOrder }) =>
      c.env.DB.prepare(
        "UPDATE todos SET sort_order = ?, updated_at = datetime('now') WHERE id = ? AND team_id = ?",
      ).bind(sortOrder, id, teamId),
    ),
  );
  return c.json({ ok: true });
});

app.delete("/api/teams/:teamId/todos/:id", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const todoId = c.req.param("id");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const existing = await c.env.DB.prepare(
    "SELECT user_id, set_id FROM todos WHERE id = ? AND team_id = ?",
  )
    .bind(todoId, teamId)
    .first<{ user_id: string; set_id: string }>();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const isOwner = existing.user_id === session.userId;
  const perm: PermissionKey = isOwner ? "delete_own_todos" : "delete_any_todo";
  if (!(await hasPermission(c.env.DB, teamId, role, perm, existing.set_id))) {
    return c.json({ error: "No permission to delete" }, 403);
  }

  await c.env.DB.prepare("DELETE FROM todos WHERE id = ? AND team_id = ?")
    .bind(todoId, teamId)
    .run();

  return c.json({ ok: true });
});

// ─── Comments ────────────────────────────────────────────────────────────────

app.get("/api/teams/:teamId/todos/:todoId/comments", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const todoId = c.req.param("todoId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const todo = await c.env.DB.prepare(
    "SELECT id FROM todos WHERE id = ? AND team_id = ?",
  )
    .bind(todoId, teamId)
    .first();
  if (!todo) return c.json({ error: "Todo not found" }, 404);

  const result = await c.env.DB.prepare(
    "SELECT id, user_id, username, body, created_at FROM comments WHERE todo_id = ? ORDER BY created_at ASC",
  )
    .bind(todoId)
    .all();

  return c.json({
    comments: result.results.map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      username: r.username as string,
      body: r.body as string,
      createdAt: r.created_at as string,
    })),
  });
});

app.post(
  "/api/teams/:teamId/todos/:todoId/comments",
  requireAuth,
  async (c) => {
    const teamId = c.req.param("teamId");
    const todoId = c.req.param("todoId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const todo = await c.env.DB.prepare(
      "SELECT id, set_id FROM todos WHERE id = ? AND team_id = ?",
    )
      .bind(todoId, teamId)
      .first<{ id: string; set_id: string }>();
    if (!todo) return c.json({ error: "Todo not found" }, 404);

    if (
      !(await hasPermission(c.env.DB, teamId, role, "comment", todo.set_id))
    ) {
      return c.json({ error: "No permission to comment" }, 403);
    }

    const { body } = await c.req.json<{ body: string }>();
    if (!body?.trim()) return c.json({ error: "Body is required" }, 400);

    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO comments (id, todo_id, user_id, username, body) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(id, todoId, session.userId, session.username, body.trim())
      .run();

    return c.json(
      {
        comment: {
          id,
          userId: session.userId,
          username: session.username,
          body: body.trim(),
          createdAt: new Date().toISOString(),
        },
      },
      201,
    );
  },
);

app.delete(
  "/api/teams/:teamId/todos/:todoId/comments/:commentId",
  requireAuth,
  async (c) => {
    const teamId = c.req.param("teamId");
    const todoId = c.req.param("todoId");
    const commentId = c.req.param("commentId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const existing = await c.env.DB.prepare(
      "SELECT user_id FROM comments WHERE id = ? AND todo_id = ?",
    )
      .bind(commentId, todoId)
      .first<{ user_id: string }>();
    if (!existing) return c.json({ error: "Not found" }, 404);

    const isOwner = existing.user_id === session.userId;
    const todo = await c.env.DB.prepare(
      "SELECT set_id FROM todos WHERE id = ? AND team_id = ?",
    )
      .bind(todoId, teamId)
      .first<{ set_id: string }>();

    const perm: PermissionKey = isOwner
      ? "delete_own_comments"
      : "delete_any_comment";
    if (!(await hasPermission(c.env.DB, teamId, role, perm, todo?.set_id))) {
      return c.json({ error: "No permission to delete comment" }, 403);
    }

    await c.env.DB.prepare("DELETE FROM comments WHERE id = ?")
      .bind(commentId)
      .run();
    return c.json({ ok: true });
  },
);

export default app;
