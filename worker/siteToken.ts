import { getAppConfig } from "./config";
import { getPrism } from "./auth";
import type { Bindings } from "./types";

export const SITE_TOKEN_KV_KEY = "site:service_token";
const REFRESH_WINDOW_MS = 5 * 60 * 1000;

export type SiteTokenData = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt?: number;
  grantedBy: string;
  storedAt: number;
};

export async function getSiteToken(
  kv: KVNamespace,
): Promise<SiteTokenData | null> {
  return kv.get<SiteTokenData>(SITE_TOKEN_KV_KEY, "json");
}

export async function storeSiteToken(
  kv: KVNamespace,
  data: SiteTokenData,
): Promise<void> {
  await kv.put(SITE_TOKEN_KV_KEY, JSON.stringify(data));
}

export async function refreshSiteToken(
  kv: KVNamespace,
  env: Bindings,
): Promise<void> {
  const token = await getSiteToken(kv);
  if (!token?.refreshToken) return;

  if (
    token.accessTokenExpiresAt &&
    Date.now() < token.accessTokenExpiresAt - REFRESH_WINDOW_MS
  ) {
    return;
  }

  const config = await getAppConfig(kv, env);
  const prism = getPrism(config);

  try {
    const newTokens = await prism.refreshToken(token.refreshToken);
    await storeSiteToken(kv, {
      ...token,
      accessToken: newTokens.access_token,
      refreshToken: newTokens.refresh_token ?? token.refreshToken,
      accessTokenExpiresAt: newTokens.expires_in
        ? Date.now() + newTokens.expires_in * 1000
        : token.accessTokenExpiresAt,
    });
  } catch {
    // Refresh failed — leave the existing token in place.
  }
}
