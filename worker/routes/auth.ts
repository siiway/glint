import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Bindings, Variables, SessionData } from "../types";
import { getAppConfig, parseAllowedTeamIds } from "../config";
import {
  getPrism,
  fetchUserTeams,
  resolveSessionTtl,
  renewSessionIfExpiring,
  SESSION_MIN_TTL_SECONDS,
} from "../auth";

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function toAvatarProxyUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return `/api/auth/avatar?url=${encodeURIComponent(url)}`;
}

function isAllowedAvatarPath(pathname: string): boolean {
  const lowered = pathname.toLowerCase();
  return /(^|\/)avatars?(\/|$)/.test(lowered);
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

  const { session: activeSession, renewed } = await renewSessionIfExpiring(
    c.env.KV,
    sessionId,
    session,
  );
  if (renewed) {
    setCookie(c, "session", sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: SESSION_MIN_TTL_SECONDS,
    });
  }

  return c.json({
    user: {
      id: activeSession.userId,
      username: activeSession.username,
      displayName: activeSession.displayName,
      avatarUrl: toAvatarProxyUrl(activeSession.avatarUrl),
      teams: activeSession.teams.map((t) => ({
        ...t,
        avatarUrl: toAvatarProxyUrl(t.avatarUrl),
      })),
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

  const { session: activeSession, renewed } = await renewSessionIfExpiring(
    c.env.KV,
    sessionId,
    session,
  );
  if (renewed) {
    setCookie(c, "session", sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      path: "/",
      maxAge: SESSION_MIN_TTL_SECONDS,
    });
  }

  const rawUrl = c.req.query("url");
  if (!rawUrl) return c.json({ error: "Missing url" }, 400);

  let avatarUrl: URL;
  try {
    avatarUrl = new URL(rawUrl);
  } catch {
    return c.json({ error: "Invalid url" }, 400);
  }

  const config = await getAppConfig(c.env.KV);
  const prismOrigin = new URL(config.prism_base_url).origin;
  if (avatarUrl.origin !== prismOrigin) {
    return c.json({ error: "Avatar host not allowed" }, 403);
  }

  const sessionAvatar = activeSession.avatarUrl;
  const exactSessionAvatar = sessionAvatar === avatarUrl.toString();
  if (!exactSessionAvatar && !isAllowedAvatarPath(avatarUrl.pathname)) {
    return c.json({ error: "Avatar path not allowed" }, 403);
  }

  const upstream = await fetch(avatarUrl.toString(), {
    headers: activeSession.accessToken
      ? { Authorization: `Bearer ${activeSession.accessToken}` }
      : undefined,
  });
  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: "Avatar fetch failed" }), {
      status: upstream.status,
      headers: {
        "content-type": "application/json",
      },
    });
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

  const config = await getAppConfig(c.env.KV, c.env);
  const prism = getPrism(config);

  let tokens;
  try {
    tokens = await prism.exchangeCode(code, codeVerifier ?? "");
  } catch (e) {
    console.error("exchangeCode failed:", e);
    return c.json({ error: "Token exchange failed" }, 401);
  }

  const userInfo = await prism.getUserInfo(tokens.access_token);
  const teams = await fetchUserTeams(prism, tokens.access_token);

  const allowedTeamIds = parseAllowedTeamIds(config.allowed_team_id);
  if (
    allowedTeamIds.length > 0 &&
    !teams.some((t) => allowedTeamIds.includes(t.id))
  ) {
    return c.json({ error: "You are not a member of any allowed team" }, 403);
  }

  const ttl = resolveSessionTtl(config.session_ttl, tokens.expires_in);

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
