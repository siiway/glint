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
import { userTeamsKvKey, USER_TEAMS_KV_TTL } from "../cross-app-auth";

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
      avatarUrl: activeSession.avatarUrl,
      teams: activeSession.teams,
      isAppToken: activeSession.isAppToken ?? false,
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

  // Detect whether this token was issued to an external app rather than to Glint.
  let isAppToken = false;
  try {
    const info = await prism.introspectToken(tokens.access_token);
    if (info.client_id && info.client_id !== config.prism_client_id) {
      isAppToken = true;
    }
  } catch {
    // If introspection fails, leave isAppToken false — don't block login.
  }

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
    isAppToken,
  };

  await c.env.KV.put(`session:${sessionId}`, JSON.stringify(session), {
    expirationTtl: ttl,
  });

  // Cache team membership for cross-app bearer token auth (no teams:read scope needed).
  await c.env.KV.put(userTeamsKvKey(session.userId), JSON.stringify(teams), {
    expirationTtl: USER_TEAMS_KV_TTL,
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
      avatarUrl: session.avatarUrl,
      teams: session.teams,
      isAppToken: session.isAppToken ?? false,
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
