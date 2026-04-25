/**
 * Bearer token auth middleware for the /api/workbench/* endpoints.
 * Accepts any valid Prism access token (no scope restrictions), resolves
 * team membership from KV cache or live Prism fetch, and sets session context.
 */

import { createMiddleware } from "hono/factory";
import type { Bindings, Variables, SessionData, TeamInfo } from "./types";
import { getAppConfig } from "./config";
import { getPrism, fetchUserTeams } from "./auth";
import { userTeamsKvKey, USER_TEAMS_KV_TTL } from "./cross-app-auth";

export const requireWorkbenchAuth = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables;
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const token = authHeader.slice(7);

  const config = await getAppConfig(c.env.KV, c.env);
  const prism = getPrism(config);

  let info: Awaited<ReturnType<typeof prism.introspectToken>>;
  try {
    info = await prism.introspectToken(token);
  } catch {
    return c.json({ error: "Token introspection failed" }, 401);
  }
  if (!info.active || !info.sub) {
    return c.json({ error: "Token inactive or invalid" }, 401);
  }

  const userId = info.sub;

  let teams: TeamInfo[];
  const kvCached = await c.env.KV.get(userTeamsKvKey(userId), "json");
  if (kvCached) {
    teams = kvCached as TeamInfo[];
  } else {
    teams = await fetchUserTeams(prism, token);
    if (teams.length > 0) {
      await c.env.KV.put(userTeamsKvKey(userId), JSON.stringify(teams), {
        expirationTtl: USER_TEAMS_KV_TTL,
      });
    }
  }

  const session: SessionData = {
    userId,
    username: info.username ?? userId,
    accessToken: token,
    expiresAt: (info.exp ?? 0) * 1000,
    teams,
  };
  c.set("session", session);

  await next();
});
