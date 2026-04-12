import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { requireAuth, getTeamRole } from "../auth";
import { ensureDefaultSet } from "../config";
import { hasPermission } from "../permissions";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  parseMarkdownChecklist,
  type MarkdownChecklistTodo,
} from "../../shared/markdownChecklist";

const sets = new Hono<{ Bindings: Bindings; Variables: Variables }>();

type TransferTodo = MarkdownChecklistTodo;

type TransferPayload = {
  version: 1;
  set: { id: string; name: string };
  todos: TransferTodo[];
};

function renderMarkdown(nodes: TransferTodo[], depth = 0): string {
  const lines: string[] = [];
  const pad = "  ".repeat(depth);
  for (const node of nodes) {
    lines.push(`${pad}- [${node.completed ? "x" : " "}] ${node.title}`);
    for (const comment of node.comments ?? []) {
      lines.push(`${pad}  > ${comment}`);
    }
    if (node.children?.length) {
      lines.push(renderMarkdown(node.children, depth + 1));
    }
  }
  return lines.filter(Boolean).join("\n");
}

async function buildTransferPayload(
  db: D1Database,
  teamId: string,
  setId: string,
  includeComments: boolean,
): Promise<TransferPayload | null> {
  const set = await db
    .prepare("SELECT id, name FROM todo_sets WHERE id = ? AND team_id = ?")
    .bind(setId, teamId)
    .first<{ id: string; name: string }>();
  if (!set) return null;

  const todoRows = await db
    .prepare(
      "SELECT id, parent_id, title, completed FROM todos WHERE set_id = ? AND team_id = ? ORDER BY sort_order ASC, created_at ASC",
    )
    .bind(setId, teamId)
    .all();

  const commentsMap: Record<string, string[]> = {};
  if (includeComments) {
    const commentRows = await db
      .prepare(
        "SELECT c.todo_id, c.body FROM comments c JOIN todos t ON t.id = c.todo_id WHERE t.set_id = ? AND t.team_id = ? ORDER BY c.created_at ASC",
      )
      .bind(setId, teamId)
      .all();
    for (const row of commentRows.results) {
      const todoId = row.todo_id as string;
      commentsMap[todoId] ??= [];
      commentsMap[todoId].push(row.body as string);
    }
  }

  const byId = new Map<string, TransferTodo>();
  const parentOf = new Map<string, string | null>();
  for (const row of todoRows.results) {
    const id = row.id as string;
    byId.set(id, {
      title: row.title as string,
      completed: row.completed === 1,
      comments: commentsMap[id],
    });
    parentOf.set(id, (row.parent_id as string) || null);
  }

  const roots: TransferTodo[] = [];
  for (const [id, todo] of byId) {
    const parentId = parentOf.get(id);
    if (!parentId) {
      roots.push(todo);
      continue;
    }
    const parent = byId.get(parentId);
    if (!parent) {
      roots.push(todo);
      continue;
    }
    parent.children ??= [];
    parent.children.push(todo);
  }

  return {
    version: 1,
    set: { id: set.id, name: set.name },
    todos: roots,
  };
}

async function insertTransferTodo(
  db: D1Database,
  teamId: string,
  setId: string,
  userId: string,
  username: string,
  node: TransferTodo,
  includeComments: boolean,
  parentId?: string,
  sortOrderOverride?: number,
) {
  let sortOrder = sortOrderOverride;
  if (sortOrder == null) {
    const maxRow = await db
      .prepare(
        `SELECT COALESCE(MAX(sort_order), 0) as m FROM todos WHERE ${
          parentId ? "parent_id = ?" : "set_id = ? AND parent_id IS NULL"
        } AND team_id = ?`,
      )
      .bind(parentId ?? setId, teamId)
      .first<{ m: number }>();
    sortOrder = (maxRow?.m ?? 0) + 1;
  }
  const id = crypto.randomUUID();

  await db
    .prepare(
      "INSERT INTO todos (id, set_id, team_id, user_id, parent_id, title, completed, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      id,
      setId,
      teamId,
      userId,
      parentId ?? null,
      node.title.trim(),
      node.completed ? 1 : 0,
      sortOrder,
    )
    .run();

  if (includeComments) {
    for (const body of node.comments ?? []) {
      if (!body.trim()) continue;
      await db
        .prepare(
          "INSERT INTO comments (id, todo_id, user_id, username, body) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(crypto.randomUUID(), id, userId, username, body)
        .run();
    }
  }

  for (const child of node.children ?? []) {
    await insertTransferTodo(
      db,
      teamId,
      setId,
      userId,
      username,
      child,
      includeComments,
      id,
    );
  }
}

function parseImportContent(
  format: string,
  content: string,
): { todos: TransferTodo[]; setId?: string; setName?: string } {
  if (format === "json") {
    const parsed = JSON.parse(content) as Partial<TransferPayload>;
    return {
      todos: parsed.todos ?? [],
      setId: parsed.set?.id,
      setName: parsed.set?.name,
    };
  }
  if (format === "yaml" || format === "yml") {
    const parsed = parseYaml(content) as Partial<TransferPayload>;
    return {
      todos: parsed.todos ?? [],
      setId: parsed.set?.id,
      setName: parsed.set?.name,
    };
  }
  return {
    todos: parseMarkdownChecklist(content),
  };
}

sets.get("/api/teams/:teamId/sets", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  await ensureDefaultSet(c.env.DB, c.env.KV, teamId, session.userId);

  const result = await c.env.DB.prepare(
    "SELECT id, user_id, name, sort_order, auto_renew, renew_time, timezone, last_renewed_at, created_at FROM todo_sets WHERE team_id = ? ORDER BY sort_order ASC",
  )
    .bind(teamId)
    .all();

  return c.json({
    sets: result.results.map((r) => ({
      id: r.id as string,
      userId: r.user_id as string,
      name: r.name as string,
      sortOrder: r.sort_order as number,
      autoRenew: r.auto_renew === 1,
      renewTime: r.renew_time as string,
      timezone: r.timezone as string,
      lastRenewedAt: (r.last_renewed_at as string) || null,
      createdAt: r.created_at as string,
    })),
    role,
  });
});

sets.post("/api/teams/:teamId/sets", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
    return c.json({ error: "No permission to manage sets" }, 403);
  }

  const { name } = await c.req.json<{ name: string }>();
  if (!name?.trim()) return c.json({ error: "Name is required" }, 400);

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
    .bind(id, teamId, session.userId, name.trim(), sortOrder)
    .run();

  return c.json(
    {
      set: {
        id,
        userId: session.userId,
        name: name.trim(),
        sortOrder,
        autoRenew: false,
        renewTime: "00:00",
        timezone: "",
        lastRenewedAt: null,
        createdAt: new Date().toISOString(),
      },
    },
    201,
  );
});

sets.patch("/api/teams/:teamId/sets/:setId", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const setId = c.req.param("setId");
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
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  const body = await c.req.json<{
    name?: string;
    autoRenew?: boolean;
    renewTime?: string;
    timezone?: string;
  }>();

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (body.name !== undefined) {
    if (!body.name.trim()) return c.json({ error: "Name is required" }, 400);
    updates.push("name = ?");
    values.push(body.name.trim());
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

  if (updates.length === 0) return c.json({ error: "No updates" }, 400);

  updates.push("updated_at = datetime('now')");
  values.push(setId, teamId);

  await c.env.DB.prepare(
    `UPDATE todo_sets SET ${updates.join(", ")} WHERE id = ? AND team_id = ?`,
  )
    .bind(...values)
    .run();

  return c.json({ ok: true });
});

sets.delete("/api/teams/:teamId/sets/:setId", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const setId = c.req.param("setId");
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
      return c.json({ error: "Forbidden" }, 403);
    }
  }

  await c.env.DB.prepare("DELETE FROM todo_sets WHERE id = ? AND team_id = ?")
    .bind(setId, teamId)
    .run();

  return c.json({ ok: true });
});

sets.post("/api/teams/:teamId/sets/reorder", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
    return c.json({ error: "No permission" }, 403);
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
});

sets.get("/api/teams/:teamId/sets/:setId/export", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const setId = c.req.param("setId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  if (!(await hasPermission(c.env.DB, teamId, role, "view_todos", setId))) {
    return c.json({ error: "No permission to export this set" }, 403);
  }

  const format = (c.req.query("format") || "md").toLowerCase();
  const includeComments = c.req.query("includeComments") === "1";
  const payload = await buildTransferPayload(
    c.env.DB,
    teamId,
    setId,
    includeComments,
  );
  if (!payload) return c.json({ error: "Set not found" }, 404);

  const content =
    format === "json"
      ? JSON.stringify(payload, null, 2)
      : format === "yaml" || format === "yml"
        ? stringifyYaml(payload)
        : renderMarkdown(payload.todos);

  const ext = format === "json" ? "json" : format === "yaml" ? "yaml" : "md";
  return c.json({
    format: ext,
    fileName: `${payload.set.name.replace(/[^a-zA-Z0-9-_]/g, "_")}.${ext}`,
    content,
  });
});

sets.post("/api/teams/:teamId/sets/:setId/import", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const setId = c.req.param("setId");
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
  if (!body.content?.trim()) return c.json({ error: "Content is required" }, 400);

  const format = (body.format || "md").toLowerCase();
  const includeComments = body.includeComments ?? false;
  const mode = body.mode || "append";
  const insertAt = body.insertAt === "top" ? "top" : "bottom";

  if (mode === "replace") {
    if (!(await hasPermission(c.env.DB, teamId, role, "manage_sets"))) {
      return c.json({ error: "No permission to replace set content" }, 403);
    }
    await c.env.DB.prepare("DELETE FROM todos WHERE set_id = ? AND team_id = ?")
      .bind(setId, teamId)
      .run();
  }

  let todosToImport: TransferTodo[] = [];
  try {
    todosToImport = parseImportContent(format, body.content).todos;
  } catch {
    return c.json({ error: "Failed to parse import content" }, 400);
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
});

sets.post("/api/teams/:teamId/sets/import", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
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
  if (!body.content?.trim()) return c.json({ error: "Content is required" }, 400);

  const format = (body.format || "md").toLowerCase();
  const includeComments = body.includeComments ?? false;

  let parsed: { todos: TransferTodo[]; setId?: string; setName?: string };
  try {
    parsed = parseImportContent(format, body.content);
  } catch {
    return c.json({ error: "Failed to parse import content" }, 400);
  }

  const setName =
    (body.setName || parsed.setName || (format === "md" ? "Imported Set" : "Imported"))
      .trim();
  if (!setName) return c.json({ error: "Set name is required" }, 400);

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
        createdAt: new Date().toISOString(),
      },
    },
    201,
  );
});

export default sets;
