/**
 * Shared handlers for todo-set endpoints.
 * Both routes/sets.ts (cookie-session auth) and routes/cross-app.ts (bearer-token auth)
 * delegate here. The handlers assume `c.get("session")` has been populated by
 * the appropriate auth middleware.
 */

import type { Context } from "hono";
import type { Bindings, Variables } from "../types";
import { getTeamRole, isPersonalSpaceId } from "../auth";
import { ensureDefaultSet, getAppConfig } from "../config";
import { hasPermission } from "../permissions";
import { resolveUserProfiles } from "../userProfileCache";
import {
  buildTransferPayload,
  exportFormatExt,
  insertTransferTodo,
  parseImportContent,
  serializeExport,
  supportsClaimedBy,
  type TransferTodo,
} from "../transfer";

type Ctx = Context<{ Bindings: Bindings; Variables: Variables }>;

function findDuplicateTitle(titles: string[]): string | null {
  const seen = new Set<string>();
  for (const title of titles) {
    if (seen.has(title)) return title;
    seen.add(title);
  }
  return null;
}

function findDuplicateTitleInSiblingLevels(nodes: TransferTodo[]): string | null {
  const siblingTitles = nodes.map((node) => node.title.trim());
  const duplicated = findDuplicateTitle(siblingTitles);
  if (duplicated) return duplicated;
  for (const node of nodes) {
    if (node.children?.length) {
      const childDuplicated = findDuplicateTitleInSiblingLevels(node.children);
      if (childDuplicated) return childDuplicated;
    }
  }
  return null;
}

export const listSets = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  await ensureDefaultSet(c.env.DB, c.env.KV, teamId, session.userId);

  const [result, counts] = await Promise.all([
    c.env.DB.prepare(
      "SELECT id, user_id, name, sort_order, auto_renew, renew_time, timezone, last_renewed_at, split_completed, created_at FROM todo_sets WHERE team_id = ? ORDER BY sort_order ASC",
    )
      .bind(teamId)
      .all(),
    c.env.DB.prepare(
      `SELECT set_id,
            COUNT(*) as total,
            SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
     FROM todos WHERE team_id = ? AND parent_id IS NULL
     GROUP BY set_id`,
    )
      .bind(teamId)
      .all(),
  ]);

  const countMap: Record<string, { total: number; completed: number }> = {};
  for (const r of counts.results) {
    countMap[r.set_id as string] = {
      total: r.total as number,
      completed: r.completed as number,
    };
  }

  return c.json({
    sets: result.results.map((r) => {
      const stats = countMap[r.id as string] ?? { total: 0, completed: 0 };
      return {
        id: r.id as string,
        userId: r.user_id as string,
        name: r.name as string,
        sortOrder: r.sort_order as number,
        autoRenew: r.auto_renew === 1,
        renewTime: r.renew_time as string,
        timezone: r.timezone as string,
        lastRenewedAt: (r.last_renewed_at as string) || null,
        splitCompleted: r.split_completed === 1,
        createdAt: r.created_at as string,
        total: stats.total,
        completed: stats.completed,
        pending: stats.total - stats.completed,
      };
    }),
    role,
  });
};

export const createSet = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
    return c.json({ error: "No permission to manage sets" }, 403);
  }

  const { name } = await c.req.json<{ name: string }>();
  const trimmedName = name?.trim();
  if (!trimmedName) return c.json({ error: "Name is required" }, 400);

  const duplicated = await c.env.DB.prepare(
    "SELECT id FROM todo_sets WHERE team_id = ? AND name = ?",
  )
    .bind(teamId, trimmedName)
    .first<{ id: string }>();
  if (duplicated) {
    return c.json({ error: "Todo list name already exists in this team" }, 409);
  }

  const maxRow = await c.env.DB.prepare(
    "SELECT COALESCE(MAX(sort_order), 0) as m FROM todo_sets WHERE team_id = ?",
  )
    .bind(teamId)
    .first<{ m: number }>();

  const id = crypto.randomUUID();
  const sortOrder = (maxRow?.m ?? 0) + 1;

  await c.env.DB.prepare(
    "INSERT INTO todo_sets (id, team_id, user_id, name, sort_order) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, teamId, session.userId, trimmedName, sortOrder)
    .run();

  return c.json(
    {
      set: {
        id,
        userId: session.userId,
        name: trimmedName,
        sortOrder,
        autoRenew: false,
        renewTime: "00:00",
        timezone: "",
        lastRenewedAt: null,
        splitCompleted: false,
        createdAt: new Date().toISOString(),
      },
    },
    201,
  );
};

async function setManageGate(c: Ctx, teamId: string, setId: string) {
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
    const existing = await c.env.DB.prepare(
      "SELECT user_id FROM todo_sets WHERE id = ? AND team_id = ?",
    )
      .bind(setId, teamId)
      .first<{ user_id: string }>();
    if (!existing || existing.user_id !== session.userId) {
      return c.json({ error: "No permission to manage sets" }, 403);
    }
  }
  return null;
}

export const patchSet = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const setId = c.req.param("setId")!;
  const denied = await setManageGate(c, teamId, setId);
  if (denied) return denied;

  const body = await c.req.json<{
    name?: string;
    autoRenew?: boolean;
    renewTime?: string;
    timezone?: string;
    splitCompleted?: boolean;
  }>();

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (body.name !== undefined) {
    const trimmedName = body.name.trim();
    if (!trimmedName) return c.json({ error: "Name is required" }, 400);
    const duplicated = await c.env.DB.prepare(
      "SELECT id FROM todo_sets WHERE team_id = ? AND name = ? AND id != ?",
    )
      .bind(teamId, trimmedName, setId)
      .first<{ id: string }>();
    if (duplicated) {
      return c.json({ error: "Todo list name already exists in this team" }, 409);
    }
    updates.push("name = ?");
    values.push(trimmedName);
  }
  if (body.autoRenew !== undefined) {
    updates.push("auto_renew = ?");
    values.push(body.autoRenew ? 1 : 0);
  }
  if (body.renewTime !== undefined) {
    updates.push("renew_time = ?");
    values.push(body.renewTime);
  }
  if (body.timezone !== undefined) {
    updates.push("timezone = ?");
    values.push(body.timezone);
  }
  if (body.splitCompleted !== undefined) {
    updates.push("split_completed = ?");
    values.push(body.splitCompleted ? 1 : 0);
  }
  if (updates.length === 0) return c.json({ error: "No updates" }, 400);

  updates.push("updated_at = datetime('now')");
  values.push(setId, teamId);

  await c.env.DB.prepare(
    `UPDATE todo_sets SET ${updates.join(", ")} WHERE id = ? AND team_id = ?`,
  )
    .bind(...values)
    .run();

  return c.json({ ok: true });
};

export const deleteSet = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const setId = c.req.param("setId")!;
  const denied = await setManageGate(c, teamId, setId);
  if (denied) return denied;

  await c.env.DB.prepare("DELETE FROM todo_sets WHERE id = ? AND team_id = ?")
    .bind(setId, teamId)
    .run();

  return c.json({ ok: true });
};

export const reorderSets = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
    return c.json({ error: "No permission to manage sets" }, 403);
  }

  const { items } = await c.req.json<{
    items: { id: string; sortOrder: number }[];
  }>();
  if (!items?.length) return c.json({ error: "No items" }, 400);

  await c.env.DB.batch(
    items.map(({ id, sortOrder }) =>
      c.env.DB.prepare(
        "UPDATE todo_sets SET sort_order = ?, updated_at = datetime('now') WHERE id = ? AND team_id = ?",
      ).bind(sortOrder, id, teamId),
    ),
  );
  return c.json({ ok: true });
};

export const exportSet = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const setId = c.req.param("setId")!;
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "view_todos", setId))) {
    return c.json({ error: "No permission to export this set" }, 403);
  }

  const format = (c.req.query("format") || "md").toLowerCase();
  const includeComments = c.req.query("includeComments") === "1";

  let nameMap: Record<string, string> = {};
  if (await supportsClaimedBy(c.env.DB)) {
    const claimedRows = await c.env.DB.prepare(
      "SELECT DISTINCT claimed_by FROM todos WHERE set_id = ? AND team_id = ? AND claimed_by IS NOT NULL",
    )
      .bind(setId, teamId)
      .all();
    const claimedIds = new Set(
      claimedRows.results.map((r) => r.claimed_by as string),
    );
    if (claimedIds.size > 0) {
      const config = await getAppConfig(c.env.KV);
      const ids = isPersonalSpaceId(teamId, session.userId)
        ? new Set([session.userId])
        : claimedIds;
      ({ nameMap } = await resolveUserProfiles(
        c.env.KV,
        config,
        session,
        teamId,
        ids,
      ));
    }
  }

  const payload = await buildTransferPayload(
    c.env.DB,
    teamId,
    setId,
    includeComments,
    nameMap,
  );
  if (!payload) return c.json({ error: "Set not found" }, 404);

  const content = serializeExport(format, payload);
  const ext = exportFormatExt(format);
  return c.json({
    format: ext,
    fileName: `${payload.set.name.replace(/[^a-zA-Z0-9-_]/g, "_")}.${ext}`,
    content,
  });
};

export const importIntoSet = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const setId = c.req.param("setId")!;
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "create_todos", setId))) {
    return c.json({ error: "No permission to import into this set" }, 403);
  }

  const body = await c.req.json<{
    format?: "md" | "json" | "yaml";
    content: string;
    mode?: "append" | "replace";
    includeComments?: boolean;
    insertAt?: "top" | "bottom";
  }>();
  if (!body.content?.trim())
    return c.json({ error: "Content is required" }, 400);

  const format = (body.format || "md").toLowerCase();
  const includeComments = body.includeComments ?? false;
  const mode = body.mode || "append";
  const insertAt = body.insertAt === "top" ? "top" : "bottom";

  let todosToImport: TransferTodo[] = [];
  try {
    todosToImport = parseImportContent(format, body.content).todos;
  } catch {
    return c.json({ error: "Failed to parse import content" }, 400);
  }

  const duplicatedTitle = findDuplicateTitleInSiblingLevels(todosToImport);
  if (duplicatedTitle) {
    return c.json(
      {
        error: `Todo item title already exists among sibling todos: ${duplicatedTitle}`,
      },
      409,
    );
  }

  if (mode === "replace") {
    if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
      return c.json({ error: "No permission to replace set content" }, 403);
    }
    await c.env.DB.prepare("DELETE FROM todos WHERE set_id = ? AND team_id = ?")
      .bind(setId, teamId)
      .run();
  } else if (todosToImport.length > 0) {
    const existingRows = await c.env.DB.prepare(
      "SELECT title FROM todos WHERE set_id = ? AND team_id = ? AND parent_id IS NULL",
    )
      .bind(setId, teamId)
      .all();
    const existingTitles = new Set(
      existingRows.results.map((row) => row.title as string),
    );
    const conflictedTitle = todosToImport
      .map((todo) => todo.title.trim())
      .find((title) =>
      existingTitles.has(title),
      );
    if (conflictedTitle) {
      return c.json(
        {
          error: `Todo item title already exists among sibling todos: ${conflictedTitle}`,
        },
        409,
      );
    }
  }

  if (insertAt === "top" && todosToImport.length > 0) {
    await c.env.DB.prepare(
      "UPDATE todos SET sort_order = sort_order + ? WHERE set_id = ? AND team_id = ? AND parent_id IS NULL",
    )
      .bind(todosToImport.length, setId, teamId)
      .run();
  }

  for (let i = 0; i < todosToImport.length; i++) {
    const todo = todosToImport[i];
    await insertTransferTodo(
      c.env.DB,
      teamId,
      setId,
      session.userId,
      session.username,
      todo,
      includeComments,
      undefined,
      insertAt === "top" ? i + 1 : undefined,
    );
  }

  return c.json({ ok: true, imported: todosToImport.length });
};

export const importNewSet = async (c: Ctx): Promise<Response> => {
  const teamId = c.req.param("teamId")!;
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
    return c.json({ error: "No permission to manage sets" }, 403);
  }

  const body = await c.req.json<{
    format?: "md" | "json" | "yaml";
    content: string;
    includeComments?: boolean;
    setId?: string;
    setName?: string;
  }>();
  if (!body.content?.trim())
    return c.json({ error: "Content is required" }, 400);

  const format = (body.format || "md").toLowerCase();
  const includeComments = body.includeComments ?? false;

  let parsed: { todos: TransferTodo[]; setId?: string; setName?: string };
  try {
    parsed = parseImportContent(format, body.content);
  } catch {
    return c.json({ error: "Failed to parse import content" }, 400);
  }

  const setName = (
    body.setName ||
    parsed.setName ||
    (format === "md" ? "Imported Set" : "Imported")
  ).trim();
  if (!setName) return c.json({ error: "Set name is required" }, 400);

  const duplicatedSetName = await c.env.DB.prepare(
    "SELECT id FROM todo_sets WHERE team_id = ? AND name = ?",
  )
    .bind(teamId, setName)
    .first<{ id: string }>();
  if (duplicatedSetName) {
    return c.json({ error: "Todo list name already exists in this team" }, 409);
  }

  const setId =
    format === "md"
      ? crypto.randomUUID()
      : (body.setId || parsed.setId || crypto.randomUUID()).trim();
  if (!setId) return c.json({ error: "Set id is required" }, 400);

  const existing = await c.env.DB.prepare(
    "SELECT id FROM todo_sets WHERE id = ? AND team_id = ?",
  )
    .bind(setId, teamId)
    .first<{ id: string }>();
  if (existing) return c.json({ error: "Set id already exists" }, 409);

  const duplicatedTitle = findDuplicateTitleInSiblingLevels(parsed.todos);
  if (duplicatedTitle) {
    return c.json(
      {
        error: `Todo item title already exists among sibling todos: ${duplicatedTitle}`,
      },
      409,
    );
  }

  const maxRow = await c.env.DB.prepare(
    "SELECT COALESCE(MAX(sort_order), 0) as m FROM todo_sets WHERE team_id = ?",
  )
    .bind(teamId)
    .first<{ m: number }>();
  const sortOrder = (maxRow?.m ?? 0) + 1;

  await c.env.DB.prepare(
    "INSERT INTO todo_sets (id, team_id, user_id, name, sort_order) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(setId, teamId, session.userId, setName, sortOrder)
    .run();

  for (const todo of parsed.todos) {
    await insertTransferTodo(
      c.env.DB,
      teamId,
      setId,
      session.userId,
      session.username,
      todo,
      includeComments,
    );
  }

  return c.json(
    {
      ok: true,
      imported: parsed.todos.length,
      set: {
        id: setId,
        userId: session.userId,
        name: setName,
        sortOrder,
        autoRenew: false,
        renewTime: "00:00",
        timezone: "",
        lastRenewedAt: null,
        splitCompleted: false,
        createdAt: new Date().toISOString(),
      },
    },
    201,
  );
};
