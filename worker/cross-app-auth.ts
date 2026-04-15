/**
 * Middleware for cross-application bearer token authentication.
 *
 * Uses token introspection (per the Prism docs) to verify the token and
 * confirm the required cross-app scope, then resolves team membership via:
 *   1. KV cache (populated on normal Glint login — fast path, no extra call)
 *   2. Live Prism fetch via teams.oauthList (requires teams:read scope in the
 *      bearer token — works for users who have never logged in to Glint)
 *
 * This means no prior Glint login is required; App B users can call Glint's
 * API as long as their token either carries teams:read or they have a cached
 * session from a previous Glint login.
 */

import { createMiddleware } from "hono/factory";
import type { Bindings, Variables, SessionData, TeamInfo } from "./types";
import { getAppConfig } from "./config";
import { getPrism, fetchUserTeams } from "./auth";

export const USER_TEAMS_KV_PREFIX = "user-teams:";
export const USER_TEAMS_KV_TTL = 3600; // 1 hour

export function userTeamsKvKey(userId: string) {
  return `${USER_TEAMS_KV_PREFIX}${userId}`;
}

export function requireCrossAppAuth(innerScope: string) {
  return createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
    async (c, next) => {
      const authHeader = c.req.header("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      const token = authHeader.slice(7);

      const config = await getAppConfig(c.env.KV, c.env);
      const prism = getPrism(config);
      const requiredScope = `app:${config.prism_client_id}:${innerScope}`;

      // 1. Introspect the token — Prism verifies it is active and returns claims.
      const info = await prism.introspectToken(token);
      if (!info.active) {
        return c.json({ error: "Token inactive or expired" }, 401);
      }

      // 2. Confirm the required cross-app scope is granted.
      const grantedScopes = (info.scope ?? "").split(" ");
      if (!grantedScopes.includes(requiredScope)) {
        return c.json({ error: `Missing required scope: ${requiredScope}` }, 403);
      }

      const userId = info.sub!;

      // 3. Resolve team membership.
      //    Fast path: KV cache (populated on normal Glint login).
      //    Fallback:  live fetch from Prism if the bearer token has teams:read.
      let teams: TeamInfo[];
      const kvCached = await c.env.KV.get(userTeamsKvKey(userId), "json");
      if (kvCached) {
        teams = kvCached as TeamInfo[];
      } else {
        // Attempt live fetch — succeeds if the token carries teams:read scope.
        const fetched = await fetchUserTeams(prism, token);
        if (fetched.length === 0 && !grantedScopes.includes("teams:read")) {
          return c.json(
            {
              error:
                "Team membership is unavailable: add teams:read to the bearer token scope, or the user must log in to Glint at least once.",
            },
            403,
          );
        }
        teams = fetched;
        // Cache for subsequent requests so we avoid repeated Prism calls.
        await c.env.KV.put(userTeamsKvKey(userId), JSON.stringify(teams), {
          expirationTtl: USER_TEAMS_KV_TTL,
        });
      }

      // 4. Build a synthetic session so existing auth helpers work unchanged.
      const session: SessionData = {
        userId,
        username: info.username ?? userId,
        accessToken: token,
        expiresAt: (info.exp ?? 0) * 1000,
        teams,
      };
      c.set("session", session);

      await next();
    },
  );
}
