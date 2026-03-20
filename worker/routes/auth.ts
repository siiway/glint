import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Bindings, Variables, SessionData } from "../types";
import { getAppConfig } from "../config";
import { getPrism, fetchUserTeams } from "../auth";

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>();

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
      avatarUrl: session.avatarUrl,
      teams: session.teams,
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

auth.post("/api/auth/logout", async (c) => {
  const sessionId = getCookie(c, "session");
  if (sessionId) {
    await c.env.KV.delete(`session:${sessionId}`);
    deleteCookie(c, "session");
  }
  return c.json({ ok: true });
});

export default auth;
