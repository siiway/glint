/**
 * Helpers for exporting and importing todo sets across formats (markdown, JSON, YAML).
 * Shared by both the regular routes (sets.ts) and the cross-app routes.
 */

import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  parseMarkdownChecklist,
  type MarkdownChecklistTodo,
} from "../shared/markdownChecklist";

export type TransferTodo = MarkdownChecklistTodo;

export type TransferPayload = {
  version: 1;
  set: { id: string; name: string };
  todos: TransferTodo[];
};

const claimedBySupportCache = new WeakMap<D1Database, boolean>();
export async function supportsClaimedBy(db: D1Database): Promise<boolean> {
  const cached = claimedBySupportCache.get(db);
  if (cached !== undefined) return cached;
  const info = await db.prepare("PRAGMA table_info(todos)").all();
  const supported = info.results.some((r) => r.name === "claimed_by");
  claimedBySupportCache.set(db, supported);
  return supported;
}

export function renderMarkdown(nodes: TransferTodo[], depth = 0): string {
  const lines: string[] = [];
  const pad = "  ".repeat(depth);
  for (const node of nodes) {
    lines.push(`${pad}- [${node.completed ? "x" : " "}] ${node.title}`);
    if (node.claimedByName) {
      lines.push(`${pad}  > claimed: ${node.claimedByName}`);
    }
    for (const comment of node.comments ?? []) {
      lines.push(`${pad}  > ${comment}`);
    }
    if (node.children?.length) {
      lines.push(renderMarkdown(node.children, depth + 1));
    }
  }
  return lines.filter(Boolean).join("\n");
}

export async function buildTransferPayload(
  db: D1Database,
  teamId: string,
  setId: string,
  includeComments: boolean,
  nameMap: Record<string, string> = {},
): Promise<TransferPayload | null> {
  const set = await db
    .prepare("SELECT id, name FROM todo_sets WHERE id = ? AND team_id = ?")
    .bind(setId, teamId)
    .first<{ id: string; name: string }>();
  if (!set) return null;

  const claimSupported = await supportsClaimedBy(db);
  const todoRows = await db
    .prepare(
      `SELECT id, parent_id, title, completed${claimSupported ? ", claimed_by" : ""} FROM todos WHERE set_id = ? AND team_id = ? ORDER BY sort_order ASC, created_at ASC`,
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
    const claimedBy = claimSupported ? (row.claimed_by as string | null) : null;
    byId.set(id, {
      title: row.title as string,
      completed: row.completed === 1,
      claimedByName: claimedBy ? (nameMap[claimedBy] ?? undefined) : undefined,
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

export async function insertTransferTodo(
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

export function parseImportContent(
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

export function exportFormatExt(format: string): "json" | "yaml" | "md" {
  if (format === "json") return "json";
  if (format === "yaml" || format === "yml") return "yaml";
  return "md";
}

export function serializeExport(
  format: string,
  payload: TransferPayload,
): string {
  if (format === "json") return JSON.stringify(payload, null, 2);
  if (format === "yaml" || format === "yml") return stringifyYaml(payload);
  return renderMarkdown(payload.todos);
}
