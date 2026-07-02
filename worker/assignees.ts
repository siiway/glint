/**
 * Helpers for the multi-assignee feature.
 *
 * A todo can be assigned to several team members. Assignments live in the
 * `todo_assignees` join table (added in migration 0010). This module provides:
 *   - runtime feature detection (works even if the migration hasn't run yet)
 *   - profile resolution for a batch of todos
 *   - team-member listing for the assignee picker
 *   - per-user "Assigned to me" expand/collapse state persistence (KV)
 */

import type { AppConfig, Assignee, SessionData } from "./types";
import { getPrism, isPersonalSpaceId } from "./auth";
import { resolveUserProfiles } from "./userProfileCache";

const assigneesSupportCache = new WeakMap<D1Database, boolean>();

/** True when the todo_assignees table exists (migration 0010 applied). */
export async function supportsAssignees(db: D1Database): Promise<boolean> {
  const cached = assigneesSupportCache.get(db);
  if (cached !== undefined) return cached;
  const info = await db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'todo_assignees'",
    )
    .all();
  const supported = info.results.length > 0;
  assigneesSupportCache.set(db, supported);
  return supported;
}

/**
 * Resolves assignees for a batch of todos, keyed by todo id. Profile fields
 * (name / username / avatar) are resolved through the shared KV-backed cache.
 * Returns an empty map when the feature isn't available.
 */
export async function resolveAssignees(
  db: D1Database,
  kv: KVNamespace,
  config: AppConfig,
  session: SessionData,
  teamId: string,
  todoIds: string[],
): Promise<Map<string, Assignee[]>> {
  const map = new Map<string, Assignee[]>();
  if (todoIds.length === 0) return map;
  if (!(await supportsAssignees(db))) return map;

  // Chunk the IN(...) list to stay well under SQLite's bound-variable limit.
  const rows: { todo_id: string; user_id: string }[] = [];
  const CHUNK = 400;
  for (let i = 0; i < todoIds.length; i += CHUNK) {
    const chunk = todoIds.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => "?").join(",");
    const res = await db
      .prepare(
        `SELECT todo_id, user_id FROM todo_assignees WHERE team_id = ? AND todo_id IN (${placeholders}) ORDER BY created_at ASC`,
      )
      .bind(teamId, ...chunk)
      .all();
    for (const r of res.results) {
      rows.push({
        todo_id: r.todo_id as string,
        user_id: r.user_id as string,
      });
    }
  }
  if (rows.length === 0) return map;

  const userIds = new Set(rows.map((r) => r.user_id));
  const ids = isPersonalSpaceId(teamId, session.userId)
    ? new Set([session.userId])
    : userIds;
  const { nameMap, usernameMap, avatarMap } = await resolveUserProfiles(
    kv,
    config,
    session,
    teamId,
    ids,
  );

  for (const r of rows) {
    const list = map.get(r.todo_id) ?? [];
    list.push({
      userId: r.user_id,
      name: nameMap[r.user_id] ?? null,
      username: usernameMap[r.user_id] ?? null,
      avatarUrl: avatarMap[r.user_id] ?? null,
    });
    map.set(r.todo_id, list);
  }
  return map;
}

export type TeamMember = {
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
};

/**
 * Lists the members a todo can be assigned to within a team. Personal spaces
 * resolve to just the calling user; team spaces fetch from Prism.
 */
export async function getAssignableMembers(
  config: AppConfig,
  session: SessionData,
  teamId: string,
): Promise<TeamMember[]> {
  if (isPersonalSpaceId(teamId, session.userId)) {
    return [
      {
        userId: session.userId,
        name: session.displayName || session.username,
        username: session.username,
        avatarUrl: session.avatarUrl ?? null,
      },
    ];
  }

  try {
    const prism = getPrism(config);
    const { members } = await prism.teams.get(session.accessToken, teamId);
    return members.map((m) => ({
      userId: m.user_id,
      name: m.display_name || m.username,
      username: m.username,
      avatarUrl: m.avatar_url ?? null,
    }));
  } catch {
    // Token may lack teams:read, or Prism unreachable. Fall back to just the
    // caller so self-assignment still works.
    return [
      {
        userId: session.userId,
        name: session.displayName || session.username,
        username: session.username,
        avatarUrl: session.avatarUrl ?? null,
      },
    ];
  }
}

// ─── "Assigned to me" list expand/collapse state ────────────────────────────
// Stored per user in KV as a map of setId → expanded(boolean). Missing entries
// default to expanded (MS To Do style). Only collapsed lists really need to be
// remembered but we store the full map for simplicity.

const ASSIGNED_EXPAND_PREFIX = "assigned_expand:";

export async function getAssignedExpand(
  kv: KVNamespace,
  userId: string,
): Promise<Record<string, boolean>> {
  const raw = await kv.get<Record<string, boolean>>(
    ASSIGNED_EXPAND_PREFIX + userId,
    "json",
  );
  return raw ?? {};
}

export async function updateAssignedExpand(
  kv: KVNamespace,
  userId: string,
  setId: string,
  expanded: boolean,
): Promise<void> {
  const current = await getAssignedExpand(kv, userId);
  current[setId] = expanded;
  await kv.put(ASSIGNED_EXPAND_PREFIX + userId, JSON.stringify(current));
}
