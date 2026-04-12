import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Bindings, Variables, SessionData } from "../types";
import { getAppConfig, parseAllowedTeamIds } from "../config";
import { getPrism, fetchUserTeams } from "../auth";

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function toAvatarProxyUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return `/api/auth/avatar?url=${encodeURIComponent(url)}`;
}

auth.get("/api/auth/config", async (c) => {
  const config = await getAppConfig(c.env.KV);
  return c.json({
    baseUrl: config.prism_base_url,
    clientId: config.prism_client_id,
    redirectUri: config.prism_redirect_uri,
    usePkce: config.use_pkce,
  });
});

auth.get("/api/auth/me", async (c) => {
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
      avatarUrl: toAvatarProxyUrl(session.avatarUrl),
      teams: session.teams,
    },
  });
});

auth.get("/api/auth/avatar", async (c) => {
  const sessionId = getCookie(c, "session");
  if (!sessionId) return c.json({ error: "Unauthorized" }, 401);

  const cached = await c.env.KV.get(`session:${sessionId}`, "json");
  if (!cached) {
    deleteCookie(c, "session");
    return c.json({ error: "Unauthorized" }, 401);
  }

  const session = cached as SessionData;
  if (Date.now() > session.expiresAt) {
    await c.env.KV.delete(`session:${sessionId}`);
    deleteCookie(c, "session");
    return c.json({ error: "Unauthorized" }, 401);
  }

  const rawUrl = c.req.query("url");
  if (!rawUrl) return c.json({ error: "Missing url" }, 400);

  const config = await getAppConfig(c.env.KV);
  const prismHost = new URL(config.prism_base_url).host;

  let avatarUrl: URL;
  try {
    avatarUrl = new URL(rawUrl);
  } catch {
    return c.json({ error: "Invalid url" }, 400);
  }

  if (avatarUrl.host !== prismHost) {
    return c.json({ error: "Avatar host not allowed" }, 403);
  }

  const upstream = await fetch(avatarUrl.toString(), {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (!upstream.ok) {
    return c.json({ error: "Avatar fetch failed" }, upstream.status as 404 | 502);
  }

  const contentType = upstream.headers.get("content-type") || "image/png";
  const body = await upstream.arrayBuffer();
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
    },
  });
});

auth.post("/api/auth/callback", async (c) => {
  const { code, codeVerifier } = await c.req.json<{
    code: string;
    codeVerifier?: string;
  }>();

  const config = await getAppConfig(c.env.KV);
  const prism = getPrism(config);

  let tokens;
  try {
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

  const allowedTeamIds = parseAllowedTeamIds(config.allowed_team_id);
  if (
    allowedTeamIds.length > 0 &&
    !teams.some((t) => allowedTeamIds.includes(t.id))
  ) {
    return c.json(
      { error: "You are not a member of any allowed team" },
      403,
    );
  }

  const ttl = config.session_ttl || tokens.expires_in || 3600;

  const sessionId = crypto.randomUUID();
  const session: SessionData = {
    userId: userInfo.sub,
    username: userInfo.preferred_username || userInfo.name || userInfo.sub,
    displayName: userInfo.name,
    avatarUrl: userInfo.picture,
    accessToken: tokens.access_token,
    expiresAt: Date.now() + ttl * 1000,
    teams,
  };

  await c.env.KV.put(`session:${sessionId}`, JSON.stringify(session), {
    expirationTtl: ttl,
  });

  setCookie(c, "session", sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: ttl,
  });

  return c.json({
    user: {
      id: session.userId,
      username: session.username,
      displayName: session.displayName,
      avatarUrl: toAvatarProxyUrl(session.avatarUrl),
      teams: session.teams,
    },
  });
});

auth.post("/api/auth/logout", async (c) => {
  const sessionId = getCookie(c, "session");
  if (sessionId) {
    await c.env.KV.delete(`session:${sessionId}`);
    deleteCookie(c, "session");
  }
  return c.json({ ok: true });
});

export default auth;
