import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { requireAuth, getTeamRole } from "../auth";
import { hasPermission } from "../permissions";
import {
  renderBadge,
  progressColor,
  renderTodoList,
  type TodoItem,
} from "../badge";

const shares = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const claimedBySupportCache = new WeakMap<D1Database, boolean>();

async function supportsClaimedBy(db: D1Database): Promise<boolean> {
  const cached = claimedBySupportCache.get(db);
  if (cached !== undefined) return cached;
  const info = await db.prepare("PRAGMA table_info(todos)").all();
  const supported = info.results.some((r) => r.name === "claimed_by");
  claimedBySupportCache.set(db, supported);
  return supported;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type ShareRow = {
  id: string;
  set_id: string;
  team_id: string;
  token: string;
  name: string;
  can_view: number;
  can_create: number;
  can_edit: number;
  can_complete: number;
  can_delete: number;
  can_comment: number;
  can_reorder: number;
  allowed_emails: string;
  created_by: string;
  created_at: string;
};

function mapShareRow(r: ShareRow, setName?: string) {
  return {
    id: r.id,
    setId: r.set_id,
    setName,
    token: r.token,
    name: r.name,
    canView: r.can_view === 1,
    canCreate: r.can_create === 1,
    canEdit: r.can_edit === 1,
    canComplete: r.can_complete === 1,
    canDelete: r.can_delete === 1,
    canComment: r.can_comment === 1,
    canReorder: r.can_reorder === 1,
    allowedEmails: r.allowed_emails,
    createdBy: r.created_by,
    createdAt: r.created_at,
  };
}

// ─── Authenticated: list links for a set ─────────────────────────────────────

shares.get(
  "/api/teams/:teamId/sets/:setId/share-links",
  requireAuth,
  async (c) => {
    const teamId = c.req.param("teamId");
    const setId = c.req.param("setId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    const result = await c.env.DB.prepare(
      "SELECT * FROM share_links WHERE set_id = ? AND team_id = ? ORDER BY created_at ASC",
    )
      .bind(setId, teamId)
      .all();

    return c.json({
      links: result.results.map((r) => mapShareRow(r as unknown as ShareRow)),
    });
  },
);

// ─── Authenticated: list ALL links for team (admin panel) ────────────────────

shares.get("/api/teams/:teamId/share-links", requireAuth, async (c) => {
  const teamId = c.req.param("teamId");
  const session = c.get("session");
  const role = getTeamRole(session, teamId);
  if (!role) return c.json({ error: "Not a member of this team" }, 403);

  const result = await c.env.DB.prepare(
    `SELECT sl.*, ts.name as set_name FROM share_links sl
     LEFT JOIN todo_sets ts ON sl.set_id = ts.id
     WHERE sl.team_id = ? ORDER BY sl.created_at ASC`,
  )
    .bind(teamId)
    .all();

  return c.json({
    links: result.results.map((r) => {
      const setName = r.set_name as string;
      return mapShareRow(r as unknown as ShareRow, setName);
    }),
  });
});

// ─── Authenticated: create link ──────────────────────────────────────────────

shares.post(
  "/api/teams/:teamId/sets/:setId/share-links",
  requireAuth,
  async (c) => {
    const teamId = c.req.param("teamId");
    const setId = c.req.param("setId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    if (!(await hasPermission(c.env.DB, teamId, role, "manage_set_links"))) {
      return c.json({ error: "No permission to manage set links" }, 403);
    }

    const body = await c.req.json<{
      name?: string;
      canView?: boolean;
      canCreate?: boolean;
      canEdit?: boolean;
      canComplete?: boolean;
      canDelete?: boolean;
      canComment?: boolean;
      canReorder?: boolean;
      allowedEmails?: string;
    }>();

    const id = crypto.randomUUID();
    const token = crypto.randomUUID().replace(/-/g, "");

    await c.env.DB.prepare(
      `INSERT INTO share_links (id, set_id, team_id, token, name, can_view, can_create, can_edit, can_complete, can_delete, can_comment, can_reorder, allowed_emails, created_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
      .bind(
        id,
        setId,
        teamId,
        token,
        body.name ?? "",
        body.canView !== false ? 1 : 0,
        body.canCreate ? 1 : 0,
        body.canEdit ? 1 : 0,
        body.canComplete ? 1 : 0,
        body.canDelete ? 1 : 0,
        body.canComment ? 1 : 0,
        body.canReorder ? 1 : 0,
        body.allowedEmails ?? "",
        session.userId,
      )
      .run();

    return c.json(
      {
        link: {
          id,
          setId,
          token,
          name: body.name ?? "",
          canView: body.canView !== false,
          canCreate: body.canCreate ?? false,
          canEdit: body.canEdit ?? false,
          canComplete: body.canComplete ?? false,
          canDelete: body.canDelete ?? false,
          canComment: body.canComment ?? false,
          canReorder: body.canReorder ?? false,
          allowedEmails: body.allowedEmails ?? "",
          createdBy: session.userId,
          createdAt: new Date().toISOString(),
        },
      },
      201,
    );
  },
);

// ─── Authenticated: update link ──────────────────────────────────────────────

shares.patch(
  "/api/teams/:teamId/share-links/:linkId",
  requireAuth,
  async (c) => {
    const teamId = c.req.param("teamId");
    const linkId = c.req.param("linkId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    if (!(await hasPermission(c.env.DB, teamId, role, "manage_set_links"))) {
      return c.json({ error: "No permission to manage set links" }, 403);
    }

    const body = await c.req.json<{
      name?: string;
      canView?: boolean;
      canCreate?: boolean;
      canEdit?: boolean;
      canComplete?: boolean;
      canDelete?: boolean;
      canComment?: boolean;
      canReorder?: boolean;
      allowedEmails?: string;
    }>();

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (body.name !== undefined) {
      updates.push("name = ?");
      values.push(body.name);
    }
    if (body.canView !== undefined) {
      updates.push("can_view = ?");
      values.push(body.canView ? 1 : 0);
    }
    if (body.canCreate !== undefined) {
      updates.push("can_create = ?");
      values.push(body.canCreate ? 1 : 0);
    }
    if (body.canEdit !== undefined) {
      updates.push("can_edit = ?");
      values.push(body.canEdit ? 1 : 0);
    }
    if (body.canComplete !== undefined) {
      updates.push("can_complete = ?");
      values.push(body.canComplete ? 1 : 0);
    }
    if (body.canDelete !== undefined) {
      updates.push("can_delete = ?");
      values.push(body.canDelete ? 1 : 0);
    }
    if (body.canComment !== undefined) {
      updates.push("can_comment = ?");
      values.push(body.canComment ? 1 : 0);
    }
    if (body.canReorder !== undefined) {
      updates.push("can_reorder = ?");
      values.push(body.canReorder ? 1 : 0);
    }
    if (body.allowedEmails !== undefined) {
      updates.push("allowed_emails = ?");
      values.push(body.allowedEmails);
    }

    if (updates.length === 0) return c.json({ error: "No updates" }, 400);

    updates.push("updated_at = datetime('now')");
    values.push(linkId, teamId);

    await c.env.DB.prepare(
      `UPDATE share_links SET ${updates.join(", ")} WHERE id = ? AND team_id = ?`,
    )
      .bind(...values)
      .run();

    return c.json({ ok: true });
  },
);

// ─── Authenticated: delete link ──────────────────────────────────────────────

shares.delete(
  "/api/teams/:teamId/share-links/:linkId",
  requireAuth,
  async (c) => {
    const teamId = c.req.param("teamId");
    const linkId = c.req.param("linkId");
    const session = c.get("session");
    const role = getTeamRole(session, teamId);
    if (!role) return c.json({ error: "Not a member of this team" }, 403);

    if (!(await hasPermission(c.env.DB, teamId, role, "manage_set_links"))) {
      return c.json({ error: "No permission to manage set links" }, 403);
    }

    await c.env.DB.prepare(
      "DELETE FROM share_links WHERE id = ? AND team_id = ?",
    )
      .bind(linkId, teamId)
      .run();

    return c.json({ ok: true });
  },
);

// ─── Public endpoints ────────────────────────────────────────────────────────

type ResolvedLink = {
  id: string;
  set_id: string;
  team_id: string;
  can_view: number;
  can_create: number;
  can_edit: number;
  can_complete: number;
  can_delete: number;
  can_comment: number;
  can_reorder: number;
  allowed_emails: string;
};

async function resolveShareToken(
  db: D1Database,
  token: string,
): Promise<ResolvedLink | null> {
  return db
    .prepare(
      "SELECT id, set_id, team_id, can_view, can_create, can_edit, can_complete, can_delete, can_comment, can_reorder, allowed_emails FROM share_links WHERE token = ?",
    )
    .bind(token)
    .first<ResolvedLink>();
}

function checkEmailAccess(link: ResolvedLink, email: string | null): boolean {
  if (!link.allowed_emails) return true; // no restriction
  if (!email) return false; // restriction exists but no email provided
  const allowed = link.allowed_emails
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

shares.get("/api/shared/:token", async (c) => {
  const token = c.req.param("token");
  const email = c.req.query("email") ?? null;
  const link = await resolveShareToken(c.env.DB, token);
  if (!link) return c.json({ error: "Share link not found" }, 404);

  if (!checkEmailAccess(link, email)) {
    return c.json({ error: "Access denied", requiresEmail: true }, 403);
  }

  const set = await c.env.DB.prepare(
    "SELECT id, name FROM todo_sets WHERE id = ? AND team_id = ?",
  )
    .bind(link.set_id, link.team_id)
    .first<{ id: string; name: string }>();

  if (!set) return c.json({ error: "Set not found" }, 404);

  const claimSupported = await supportsClaimedBy(c.env.DB);

  const result = await c.env.DB.prepare(
    `SELECT id, user_id, parent_id, title, completed, sort_order, ${claimSupported ? "claimed_by" : "NULL AS claimed_by"}, created_at, updated_at FROM todos WHERE set_id = ? AND team_id = ? ORDER BY sort_order ASC, created_at ASC`,
  )
    .bind(link.set_id, link.team_id)
    .all();

  const commentCounts = await c.env.DB.prepare(
    "SELECT todo_id, COUNT(*) as count FROM comments WHERE todo_id IN (SELECT id FROM todos WHERE set_id = ? AND team_id = ?) GROUP BY todo_id",
  )
    .bind(link.set_id, link.team_id)
    .all();

  const countMap: Record<string, number> = {};
  for (const r of commentCounts.results) {
    countMap[r.todo_id as string] = r.count as number;
  }

  return c.json({
    set: { id: set.id, name: set.name },
    permissions: {
      canView: link.can_view === 1,
      canCreate: link.can_create === 1,
      canEdit: link.can_edit === 1,
      canComplete: link.can_complete === 1,
      canDelete: link.can_delete === 1,
      canComment: link.can_comment === 1,
      canReorder: link.can_reorder === 1,
    },
    requiresEmail: !!link.allowed_emails,
    todos: result.results.map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      parentId: (row.parent_id as string) || null,
      title: row.title as string,
      completed: row.completed === 1,
      sortOrder: row.sort_order as number,
      commentCount: countMap[row.id as string] ?? 0,
      claimedBy: (row.claimed_by as string) || null,
      claimedByName: null,
      claimedByAvatar: null,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    })),
  });
});

shares.post("/api/shared/:token/todos", async (c) => {
  const token = c.req.param("token");
  const link = await resolveShareToken(c.env.DB, token);
  if (!link) return c.json({ error: "Share link not found" }, 404);

  const { title, parentId, email } = await c.req.json<{
    title: string;
    parentId?: string;
    email?: string;
  }>();

  if (!checkEmailAccess(link, email ?? null)) {
    return c.json({ error: "Access denied" }, 403);
  }
  if (!link.can_create) {
    return c.json({ error: "This link does not allow creating todos" }, 403);
  }
  const trimmedTitle = title?.trim();
  if (!trimmedTitle) return c.json({ error: "Title is required" }, 400);

  if (parentId) {
    const parent = await c.env.DB.prepare(
      "SELECT id FROM todos WHERE id = ? AND set_id = ? AND team_id = ?",
    )
      .bind(parentId, link.set_id, link.team_id)
      .first();
    if (!parent) return c.json({ error: "Parent todo not found" }, 404);
  }

  const normalizedParentId = parentId ?? null;
  const duplicated = await c.env.DB.prepare(
    "SELECT id FROM todos WHERE set_id = ? AND team_id = ? AND title = ? AND ((parent_id IS NULL AND ? IS NULL) OR parent_id = ?)",
  )
    .bind(
      link.set_id,
      link.team_id,
      trimmedTitle,
      normalizedParentId,
      normalizedParentId,
    )
    .first<{ id: string }>();
  if (duplicated) {
    return c.json(
      { error: "Todo item title already exists among sibling todos" },
      409,
    );
  }

  const maxRow = await c.env.DB.prepare(
    `SELECT COALESCE(MAX(sort_order), 0) as m FROM todos WHERE ${
      parentId ? "parent_id = ?" : "set_id = ? AND parent_id IS NULL"
    } AND team_id = ?`,
  )
    .bind(parentId ?? link.set_id, link.team_id)
    .first<{ m: number }>();

  const id = crypto.randomUUID();
  const sortOrder = (maxRow?.m ?? 0) + 1;

  await c.env.DB.prepare(
    "INSERT INTO todos (id, set_id, team_id, user_id, parent_id, title, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(
      id,
      link.set_id,
      link.team_id,
      "shared",
      parentId ?? null,
      trimmedTitle,
      sortOrder,
    )
    .run();

  return c.json(
    {
      todo: {
        id,
        userId: "shared",
        parentId: parentId ?? null,
        title: trimmedTitle,
        completed: false,
        sortOrder,
        commentCount: 0,
        claimedBy: null,
        claimedByName: null,
        claimedByAvatar: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
    201,
  );
});

shares.patch("/api/shared/:token/todos/:id", async (c) => {
  const token = c.req.param("token");
  const todoId = c.req.param("id");
  const link = await resolveShareToken(c.env.DB, token);
  if (!link) return c.json({ error: "Share link not found" }, 404);

  const body = await c.req.json<{
    title?: string;
    completed?: boolean;
    sortOrder?: number;
    email?: string;
  }>();

  if (!checkEmailAccess(link, body.email ?? null)) {
    return c.json({ error: "Access denied" }, 403);
  }

  if (body.title !== undefined && !link.can_edit) {
    return c.json({ error: "This link does not allow editing" }, 403);
  }
  if (body.completed !== undefined && !link.can_complete) {
    return c.json(
      { error: "This link does not allow toggling completion" },
      403,
    );
  }
  if (body.sortOrder !== undefined && !link.can_reorder) {
    return c.json({ error: "This link does not allow reordering" }, 403);
  }

  const existing = await c.env.DB.prepare(
    "SELECT id, parent_id FROM todos WHERE id = ? AND set_id = ? AND team_id = ?",
  )
    .bind(todoId, link.set_id, link.team_id)
    .first<{ id: string; parent_id: string | null }>();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (body.title !== undefined) {
    const trimmedTitle = body.title.trim();
    if (!trimmedTitle) return c.json({ error: "Title is required" }, 400);
    const normalizedParentId = existing.parent_id ?? null;
    const duplicated = await c.env.DB.prepare(
      "SELECT id FROM todos WHERE set_id = ? AND team_id = ? AND title = ? AND id != ? AND ((parent_id IS NULL AND ? IS NULL) OR parent_id = ?)",
    )
      .bind(
        link.set_id,
        link.team_id,
        trimmedTitle,
        todoId,
        normalizedParentId,
        normalizedParentId,
      )
      .first<{ id: string }>();
    if (duplicated) {
      return c.json(
        { error: "Todo item title already exists among sibling todos" },
        409,
      );
    }
    updates.push("title = ?");
    values.push(trimmedTitle);
  }
  if (body.completed !== undefined) {
    updates.push("completed = ?");
    values.push(body.completed ? 1 : 0);
  }
  if (body.sortOrder !== undefined) {
    updates.push("sort_order = ?");
    values.push(body.sortOrder);
  }

  if (updates.length === 0) return c.json({ error: "No updates" }, 400);

  updates.push("updated_at = datetime('now')");
  values.push(todoId, link.team_id);

  await c.env.DB.prepare(
    `UPDATE todos SET ${updates.join(", ")} WHERE id = ? AND team_id = ?`,
  )
    .bind(...values)
    .run();

  return c.json({ ok: true });
});

shares.delete("/api/shared/:token/todos/:id", async (c) => {
  const token = c.req.param("token");
  const todoId = c.req.param("id");
  const link = await resolveShareToken(c.env.DB, token);
  if (!link) return c.json({ error: "Share link not found" }, 404);

  const email = c.req.query("email") ?? null;
  if (!checkEmailAccess(link, email)) {
    return c.json({ error: "Access denied" }, 403);
  }
  if (!link.can_delete) {
    return c.json({ error: "This link does not allow deleting" }, 403);
  }

  const existing = await c.env.DB.prepare(
    "SELECT id FROM todos WHERE id = ? AND set_id = ? AND team_id = ?",
  )
    .bind(todoId, link.set_id, link.team_id)
    .first();
  if (!existing) return c.json({ error: "Not found" }, 404);

  await c.env.DB.prepare("DELETE FROM todos WHERE id = ? AND team_id = ?")
    .bind(todoId, link.team_id)
    .run();

  return c.json({ ok: true });
});

shares.post("/api/shared/:token/todos/reorder", async (c) => {
  const token = c.req.param("token");
  const link = await resolveShareToken(c.env.DB, token);
  if (!link) return c.json({ error: "Share link not found" }, 404);

  const { items, email } = await c.req.json<{
    items: { id: string; sortOrder: number }[];
    email?: string;
  }>();

  if (!checkEmailAccess(link, email ?? null)) {
    return c.json({ error: "Access denied" }, 403);
  }
  if (!link.can_reorder) {
    return c.json({ error: "This link does not allow reordering" }, 403);
  }

  if (!items?.length) return c.json({ error: "No items" }, 400);

  await c.env.DB.batch(
    items.map(({ id, sortOrder }) =>
      c.env.DB.prepare(
        "UPDATE todos SET sort_order = ?, updated_at = datetime('now') WHERE id = ? AND team_id = ?",
      ).bind(sortOrder, id, link.team_id),
    ),
  );
  return c.json({ ok: true });
});

// ─── Badge endpoint (SVG) ────────────────────────────────────────────────────

shares.get("/api/shared/:token/badge.svg", async (c) => {
  const token = c.req.param("token");
  const link = await resolveShareToken(c.env.DB, token);
  if (!link) {
    return c.body(
      renderBadge({
        label: "glint",
        message: "not found",
        color: "#9f9f9f",
        labelColor: "#555",
        style: "flat",
      }),
      404,
      { "Content-Type": "image/svg+xml", "Cache-Control": "no-cache" },
    );
  }

  const set = await c.env.DB.prepare(
    "SELECT name FROM todo_sets WHERE id = ? AND team_id = ?",
  )
    .bind(link.set_id, link.team_id)
    .first<{ name: string }>();

  if (!set) {
    return c.body(
      renderBadge({
        label: "glint",
        message: "not found",
        color: "#9f9f9f",
        labelColor: "#555",
        style: "flat",
      }),
      404,
      { "Content-Type": "image/svg+xml", "Cache-Control": "no-cache" },
    );
  }

  const counts = await c.env.DB.prepare(
    "SELECT COUNT(*) as total, SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as done FROM todos WHERE set_id = ? AND team_id = ?",
  )
    .bind(link.set_id, link.team_id)
    .first<{ total: number; done: number }>();

  const total = counts?.total ?? 0;
  const done = counts?.done ?? 0;
  const ratio = total > 0 ? done / total : 0;

  const q = c.req.query();
  const style = (q.style === "flat-square" ? "flat-square" : "flat") as
    | "flat"
    | "flat-square";
  const label = q.label ?? set.name;
  const labelColor = q.labelColor ?? "#555";
  const color = q.color ?? progressColor(ratio);
  const message = q.message ?? `${done}/${total}`;

  const svg = renderBadge({ label, message, color, labelColor, style });

  return c.body(svg, 200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=60, s-maxage=60",
  });
});

// ─── Todo-list SVG endpoint ──────────────────────────────────────────────────

shares.get("/api/shared/:token/todo-list.svg", async (c) => {
  const token = c.req.param("token");
  const link = await resolveShareToken(c.env.DB, token);
  if (!link) {
    const svg = renderTodoList({
      title: "Not found",
      todos: [],
      showProgress: false,
    });
    return c.body(svg, 404, {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-cache",
    });
  }

  const set = await c.env.DB.prepare(
    "SELECT name FROM todo_sets WHERE id = ? AND team_id = ?",
  )
    .bind(link.set_id, link.team_id)
    .first<{ name: string }>();

  if (!set) {
    const svg = renderTodoList({
      title: "Not found",
      todos: [],
      showProgress: false,
    });
    return c.body(svg, 404, {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-cache",
    });
  }

  const result = await c.env.DB.prepare(
    "SELECT id, parent_id, title, completed, sort_order FROM todos WHERE set_id = ? AND team_id = ? ORDER BY sort_order ASC, created_at ASC",
  )
    .bind(link.set_id, link.team_id)
    .all();

  // Build tree with depth
  const rows = result.results as {
    id: string;
    parent_id: string | null;
    title: string;
    completed: number;
    sort_order: number;
  }[];

  const childrenMap = new Map<string | null, typeof rows>();
  for (const row of rows) {
    const pid = row.parent_id ?? null;
    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid)!.push(row);
  }

  const todos: TodoItem[] = [];
  function walk(parentId: string | null, depth: number) {
    const children = childrenMap.get(parentId) ?? [];
    for (const row of children) {
      todos.push({
        title: row.title,
        completed: row.completed === 1,
        depth,
      });
      walk(row.id, depth + 1);
    }
  }
  walk(null, 0);

  const q = c.req.query();
  const theme = q.theme === "dark" ? "dark" : "light";
  const _width = parseInt(q.width, 10);
  const width =
    q.width && !isNaN(_width)
      ? Math.min(Math.max(_width, 200), 1000)
      : undefined;
  const _fontSize = parseInt(q.fontSize, 10);
  const fontSize =
    q.fontSize && !isNaN(_fontSize)
      ? Math.min(Math.max(_fontSize, 10), 24)
      : undefined;
  const _maxItems = parseInt(q.maxItems, 10);
  const maxItems =
    q.maxItems && !isNaN(_maxItems)
      ? Math.min(Math.max(_maxItems, 1), 100)
      : undefined;
  const showProgress = q.showProgress !== "false";
  const title = q.title ?? set.name;

  const svg = renderTodoList({
    title: title || undefined,
    todos,
    theme,
    bgColor: q.bgColor || undefined,
    textColor: q.textColor || undefined,
    checkColor: q.checkColor || undefined,
    borderColor: q.borderColor || undefined,
    fontSize,
    showProgress,
    maxItems,
    width,
  });

  return c.body(svg, 200, {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=60, s-maxage=60",
  });
});

export default shares;
