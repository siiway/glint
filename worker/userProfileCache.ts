import type { AppConfig, SessionData } from "./types";
import { getPrism } from "./auth";

type CachedProfile = {
  name: string;
  username?: string | null;
  avatarUrl: string | null;
};

const KV_PREFIX = "user_profile:";
const DEFAULT_TTL = 86400;

/**
 * Resolves a set of user IDs to display names and avatar URLs.
 * Results are cached in KV for `config.user_profile_cache_ttl` seconds (default 1 day).
 * The current user is always seeded from the session without a KV or Prism call.
 * For team spaces, uncached IDs trigger a single Prism teams.get() call which also
 * refreshes all other team members in the cache.
 */
export async function resolveUserProfiles(
  kv: KVNamespace,
  config: AppConfig,
  session: SessionData,
  teamId: string,
  userIds: Set<string>,
): Promise<{
  nameMap: Record<string, string>;
  usernameMap: Record<string, string>;
  avatarMap: Record<string, string>;
}> {
  const nameMap: Record<string, string> = {};
  const usernameMap: Record<string, string> = {};
  const avatarMap: Record<string, string> = {};

  if (userIds.size === 0) return { nameMap, usernameMap, avatarMap };

  const ttl = config.user_profile_cache_ttl ?? DEFAULT_TTL;

  // Always resolve the current user from the session — no KV or Prism call needed.
  if (userIds.has(session.userId)) {
    nameMap[session.userId] = session.displayName || session.username;
    usernameMap[session.userId] = session.username;
    if (session.avatarUrl) avatarMap[session.userId] = session.avatarUrl;
  }

  const remaining = new Set([...userIds].filter((id) => id !== session.userId));
  if (remaining.size === 0) return { nameMap, usernameMap, avatarMap };

  // Check KV cache for all remaining IDs in parallel.
  const cacheResults = await Promise.all(
    [...remaining].map((id) =>
      kv.get<CachedProfile>(KV_PREFIX + id, "json").then((v) => ({ id, v })),
    ),
  );

  const missIds = new Set<string>();
  for (const { id, v } of cacheResults) {
    if (v) {
      nameMap[id] = v.name;
      if (v.username) usernameMap[id] = v.username;
      if (v.avatarUrl) avatarMap[id] = v.avatarUrl;
    } else {
      missIds.add(id);
    }
  }

  if (missIds.size === 0) return { nameMap, usernameMap, avatarMap };

  // Fetch from Prism for cache misses.
  // teams.get() batch-resolves team members and refreshes team-member cache.
  // IDs not present in the team may remain unresolved.
  try {
    const prism = getPrism(config);
    const { members } = await prism.teams.get(session.accessToken, teamId);

    const puts: Promise<void>[] = [];
    for (const m of members) {
      const name = m.display_name || m.username;
      const username = m.username;
      const avatarUrl: string | null = m.avatar_url ?? null;

      if (ttl > 0) {
        puts.push(
          kv.put(
            KV_PREFIX + m.user_id,
            JSON.stringify({
              name,
              username,
              avatarUrl,
            } satisfies CachedProfile),
            { expirationTtl: ttl },
          ),
        );
      }

      if (userIds.has(m.user_id)) {
        nameMap[m.user_id] = name;
        usernameMap[m.user_id] = username;
        if (avatarUrl) avatarMap[m.user_id] = avatarUrl;
      }
    }

    await Promise.all(puts);
  } catch (error) {
    // teams.get() failed or token lacks teams:read.
    void error;
  }

  return { nameMap, usernameMap, avatarMap };
}
