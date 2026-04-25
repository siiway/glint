/**
 * Middleware for cross-application bearer token authentication.
 *
 * Uses token introspection (per the Prism docs) to verify the token and
 * confirm at least one of the required cross-app scopes is granted, then
 * resolves team membership via:
 *   1. KV cache (populated on normal Glint login — fast path, no extra call)
 *   2. Live Prism fetch via teams.oauthList (requires teams:read scope in the
 *      bearer token — works for users who have never logged in to Glint)
 *
 * This means no prior Glint login is required; App B users can call Glint's
 * API as long as their token either carries teams:read or they have a cached
 * session from a previous Glint login.
 *
 * Scope names (defined in Prism as app:<glint_client_id>:<inner>):
 *   read_todos      — list sets and read todos
 *   create_todos    — create new todos
 *   edit_todos      — edit todo titles
 *   complete_todos  — toggle todo completion
 *   delete_todos    — delete todos
 *   reorder_todos   — change todo sort order
 *   claim_todos     — claim/unclaim todos
 *   write_todos     — legacy catch-all: accepted wherever create/edit/complete is needed
 *   manage_sets     — create/rename/delete/reorder/configure sets, bulk import/export
 *   comment         — post comments
 *   delete_comments — delete comments
 *   read_settings   — read team settings
 *   manage_settings — manage team settings
 */

import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import type { Bindings, Variables, SessionData, TeamInfo } from "./types";
import { getAppConfig } from "./config";
import { getPrism, fetchUserTeams } from "./auth";

export const USER_TEAMS_KV_PREFIX = "user-teams:";
export const USER_TEAMS_KV_TTL = 3600; // 1 hour

export function userTeamsKvKey(userId: string) {
  return `${USER_TEAMS_KV_PREFIX}${userId}`;
}

/**
 * Returns true if the cross-app bearer token was granted any of the specified
 * inner scopes. Call this inside route handlers after requireCrossAppAuth has
 * already run and populated crossAppScopes in context.
 */
export function hasCrossAppScope(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
  ...innerScopes: string[]
): boolean {
  const granted = c.get("crossAppScopes") ?? [];
  return innerScopes.some((s) => granted.includes(s));
}

/**
 * Middleware that requires a valid cross-app bearer token carrying at least one
 * of the given inner scopes (e.g. "read_todos", ["edit_todos", "write_todos"]).
 */
export function requireCrossAppAuth(innerScope: string | string[]) {
  return createMiddleware<{ Bindings: Bindings; Variables: Variables }>(
    async (c, next) => {
      const authHeader = c.req.header("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return c.json({ error: "Unauthorized" }, 401);
      }
      const token = authHeader.slice(7);

      const config = await getAppConfig(c.env.KV, c.env);
      const prism = getPrism(config);

      const innerScopes = Array.isArray(innerScope) ? innerScope : [innerScope];
      const requiredScopes = innerScopes.map(
        (s) => `app:${config.prism_client_id}:${s}`,
      );

      // 1. Introspect the token — Prism verifies it is active and returns claims.
      const info = await prism.introspectToken(token);
      if (!info.active) {
        return c.json({ error: "Token inactive or expired" }, 401);
      }

      // 2. Confirm at least one of the required cross-app scopes is granted.
      const grantedScopes = (info.scope ?? "").split(" ");
      if (!requiredScopes.some((s) => grantedScopes.includes(s))) {
        return c.json(
          {
            error: `Missing required scope. Token must include one of: ${innerScopes.join(", ")}`,
          },
          403,
        );
      }

      const userId = info.sub!;

      // 3. Store the inner scopes (without the app:clientId: prefix) in context
      //    so individual route handlers can check fine-grained scope requirements.
      const appPrefix = `app:${config.prism_client_id}:`;
      const grantedInnerScopes = grantedScopes
        .filter((s) => s.startsWith(appPrefix))
        .map((s) => s.slice(appPrefix.length));
      c.set("crossAppScopes", grantedInnerScopes);

      // 4. Resolve team membership.
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

      // 5. Build a synthetic session so existing auth helpers work unchanged.
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
