/**
 * Cross-app "who am I" endpoint — returns the calling user's identity and
 * team memberships, derived from the bearer-token session built by
 * requireCrossAppAuth.
 *
 * Note: native /api/auth/me is cookie-session aware (renews session, redacts
 * cookies on expiry) and lives in routes/auth.ts. It is intentionally NOT
 * shared with this handler.
 */

import type { Context } from "hono";
import type { Bindings, Variables } from "../types";

type Ctx = Context<{ Bindings: Bindings; Variables: Variables }>;

export const getCrossAppMe = async (c: Ctx): Promise<Response> => {
  const session = c.get("session");
  return c.json({
    user: {
      id: session.userId,
      username: session.username,
      displayName: session.displayName ?? session.username,
      avatarUrl: session.avatarUrl ?? null,
      teams: session.teams,
    },
    grantedScopes: c.get("crossAppScopes") ?? [],
  });
};
