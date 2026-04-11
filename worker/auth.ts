import { getCookie, deleteCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { PrismClient } from "@siiway/prism";
import type {
  Bindings,
  Variables,
  AppConfig,
  SessionData,
  TeamInfo,
  TeamRole,
} from "./types";

export const PERSONAL_SPACE_PREFIX = "personal:";

export function getPersonalSpaceId(userId: string): string {
  return `${PERSONAL_SPACE_PREFIX}${userId}`;
}

export function isPersonalSpaceId(spaceId: string, userId: string): boolean {
  return spaceId === getPersonalSpaceId(userId);
}

export function getPrism(config: AppConfig) {
  return new PrismClient({
    baseUrl: config.prism_base_url,
    clientId: config.prism_client_id,
    clientSecret: config.prism_client_secret || undefined,
    redirectUri: config.prism_redirect_uri,
    scopes: ["openid", "profile", "email", "teams:read"],
  });
}

export async function fetchUserTeams(
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

export const requireAuth = createMiddleware<{
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

export function getTeamRole(
  session: SessionData,
  teamId: string,
): TeamRole | null {
  if (isPersonalSpaceId(teamId, session.userId)) return "owner";
  return session.teams.find((t) => t.id === teamId)?.role ?? null;
}
