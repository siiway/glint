# Todos API

All endpoints require authentication and team membership. Permissions are checked per-action and per-field. Permission resolution uses the same order as described in [Permissions](../guide/permissions#resolution-order).

---

## `GET /api/teams/:teamId/sets/:setId/todos`

List all todos in a set, ordered by `sortOrder`. Includes sub-todos (identified by a non-null `parentId`), comment counts, and the current user's effective permissions for this set.

**Auth required:** Yes — `view_todos` for the set

**Response:**

```json
{
  "todos": [
    {
      "id": "uuid",
      "userId": "creator-uuid",
      "parentId": null,
      "title": "Set up CI pipeline",
      "completed": false,
      "sortOrder": 1,
      "commentCount": 2,
      "claimedBy": "user-uuid",
      "claimedByName": "Ada Lovelace",
      "claimedByUsername": "ada",
      "claimedByAvatar": "https://example.com/a.png",
      "createdAt": "2026-03-17T12:00:00.000Z",
      "updatedAt": "2026-03-17T14:30:00.000Z"
    },
    {
      "id": "uuid-sub",
      "userId": "creator-uuid",
      "parentId": "uuid",
      "title": "Configure GitHub Actions",
      "completed": true,
      "sortOrder": 1,
      "commentCount": 0,
      "claimedBy": null,
      "claimedByName": null,
      "claimedByUsername": null,
      "claimedByAvatar": null,
      "createdAt": "2026-03-17T13:00:00.000Z",
      "updatedAt": "2026-03-17T14:00:00.000Z"
    }
  ],
  "role": "owner",
  "permissions": {
    "create_todos": true,
    "edit_own_todos": true,
    "edit_any_todo": true,
    "delete_own_todos": true,
    "delete_any_todo": true,
    "complete_any_todo": true,
    "add_subtodos": true,
    "claim_todos": true,
    "reorder_todos": true,
    "comment": true,
    "delete_own_comments": true,
    "delete_any_comment": true,
    "view_todos": true
  }
}
```

| Field | Type | Description |
| --- | --- | --- |
| `todos[].id` | string (UUID) | Unique identifier. |
| `todos[].userId` | string (UUID) | ID of the user who created the todo. |
| `todos[].parentId` | string \| null | Parent todo UUID for sub-todos; `null` for top-level todos. |
| `todos[].title` | string | Todo text content. |
| `todos[].completed` | boolean | Whether the todo is marked complete. |
| `todos[].sortOrder` | number | Integer position within the list (or within its parent's sub-list). |
| `todos[].commentCount` | number | Number of comments attached to this todo. |
| `todos[].claimedBy` | string \| null | User ID of the person who claimed the todo, or `null` if unclaimed. See [Claiming](#post-api-teams-teamid-todos-id-claim). |
| `todos[].claimedByName` | string \| null | Resolved display name of the claimer (from Prism), or `null`. |
| `todos[].claimedByUsername` | string \| null | Resolved username of the claimer, or `null`. |
| `todos[].claimedByAvatar` | string \| null | Resolved avatar URL of the claimer, or `null`. |
| `todos[].createdAt` | string (ISO 8601) | Creation timestamp. |
| `todos[].updatedAt` | string (ISO 8601) | Last modification timestamp. |
| `role` | string | Current user's team role. |
| `permissions` | object | Resolved permission map for this set. Used by the frontend to render actions. |

::: info
Claimer identity fields (`claimedByName` / `claimedByUsername` / `claimedByAvatar`) are resolved from Prism and cached. For personal spaces, only the calling user's identity is resolved.
:::

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `401` | `"Unauthorized"` | Not logged in. |
| `403` | `"Forbidden"` | Not a member, or `view_todos` is revoked for this set. |
| `404` | `"Set not found"` | No set with that ID in this team. |

---

## `POST /api/teams/:teamId/sets/:setId/todos`

Create a new todo in the set. Pass `parentId` to create a sub-todo beneath an existing todo.

**Auth required:** Yes — `create_todos` (or `add_subtodos` when `parentId` is provided)

**Request body:**

```json
{
  "title": "Set up CI pipeline",
  "parentId": null
}
```

| Field | Type | Required | Description |
| --- | --- | :---: | --- |
| `title` | string | Yes | Todo text. Cannot be empty. |
| `parentId` | string \| null | No | UUID of the parent todo. Must reference a todo in the same set. `null` or omitted = top-level todo. |

**Response (201):**

```json
{
  "todo": {
    "id": "new-uuid",
    "userId": "creator-uuid",
    "parentId": null,
    "title": "Set up CI pipeline",
    "completed": false,
    "sortOrder": 5,
    "commentCount": 0,
    "claimedBy": null,
    "claimedByName": null,
    "claimedByAvatar": null,
    "createdAt": "2026-03-17T12:00:00.000Z",
    "updatedAt": "2026-03-17T12:00:00.000Z"
  }
}
```

The new todo is placed at the end of the relevant list (top-level or sub-list). A `todo:created` event is broadcast to other connected clients (see [Realtime Sync](../guide/realtime)).

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `400` | `"Title is required"` | `title` is missing or empty. |
| `404` | `"Set not found"` | The target set does not exist in this team. |
| `404` | `"Parent todo not found"` | `parentId` references a todo that doesn't exist in this set. |
| `403` | `"No permission: <key>"` | Lacks `create_todos` (or `add_subtodos` for sub-todos). |
| `409` | `"Todo item title already exists among sibling todos"` | A sibling todo already has this title. |

---

## `PATCH /api/teams/:teamId/todos/:id`

Update one or more fields on a todo. Permission checks differ by field and by whether you own the todo.

**Auth required:** Yes — field-dependent (see below)

**Path parameters:**

| Parameter | Description |
| --- | --- |
| `id` | UUID of the todo to update. |

**Request body** (all fields optional — only provided fields are updated):

```json
{
  "title": "Updated title",
  "completed": true,
  "sortOrder": 3
}
```

**Field-level permission requirements:**

| Field | Own todo | Others' todo |
| --- | --- | --- |
| `title` | `edit_own_todos` | `edit_any_todo` |
| `completed` | Always allowed | `complete_any_todo` |
| `sortOrder` | `reorder_todos` | `reorder_todos` |

**Response:**

```json
{ "ok": true }
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `400` | `"Title is required"` | `title` was provided but is an empty string. |
| `403` | `"No permission to edit"` / `"No permission to toggle completion"` / `"No permission to reorder"` | Lacks the required permission for the provided fields. |
| `404` | `"Not found"` | No todo with that ID in this team. |
| `409` | `"Todo item title already exists among sibling todos"` | The new title collides with a sibling. |

A `todo:updated` event is broadcast on success.

---

## `DELETE /api/teams/:teamId/todos/:id`

Delete a todo and all of its sub-todos (cascading delete). Comments on the todo and its sub-todos are also deleted.

**Auth required:** Yes — `delete_own_todos` (own) or `delete_any_todo` (others')

::: warning
Deleting a todo permanently removes it and all nested sub-todos and comments. There is no undo.
:::

**Response:**

```json
{ "ok": true }
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `403` | `"No permission to delete"` | Lacks the required delete permission. |
| `404` | `"Not found"` | No todo with that ID in this team. |

A `todo:deleted` event is broadcast on success.

---

## `POST /api/teams/:teamId/todos/reorder`

Batch update `sortOrder` values for multiple todos in one request. Typically called after a drag-and-drop reorder on the frontend.

**Auth required:** Yes — `reorder_todos`

**Request body:**

```json
{
  "items": [
    { "id": "uuid-1", "sortOrder": 1 },
    { "id": "uuid-2", "sortOrder": 2 },
    { "id": "uuid-3", "sortOrder": 3 }
  ],
  "setId": "set-uuid"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `items` | array | Array of `{id, sortOrder}` pairs for every todo whose position changed. |
| `items[].id` | string (UUID) | ID of the todo. |
| `items[].sortOrder` | number | New integer sort position. |
| `setId` | string (optional) | The set being reordered. When provided, a `todo:reordered` event is broadcast to connected clients for that set. |

**Response:**

```json
{ "ok": true }
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `400` | `"No items"` | `items` array is missing or empty. |
| `403` | `"No permission to reorder"` | Lacks `reorder_todos`. |

---

## `POST /api/teams/:teamId/todos/:id/move`

Move a todo — together with its entire sub-todo subtree — into another set. The moved todo becomes a top-level (root) todo in the target set; its descendants keep their parent/child relationships.

**Auth required:** Yes — `edit_own_todos` (own) or `edit_any_todo` (others') in the source set, **and** `create_todos` in the target set.

**Request body:**

```json
{
  "targetSetId": "set-uuid",
  "insertAt": "bottom"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `targetSetId` | string (UUID) | The destination set. |
| `insertAt` | `"top"` \| `"bottom"` (optional) | Where to place the moved todo among the target set's root todos. Defaults to `"bottom"`. |

**Response:**

```json
{ "ok": true }
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `400` | `"targetSetId is required"` | `targetSetId` is missing. |
| `403` | `"No permission to move this todo"` / `"No permission to add todos to the target set"` | Lacks the required permission. |
| `404` | `"Not found"` / `"Target set not found"` | The todo or target set does not exist in this team. |
| `409` | `"Todo item title already exists among sibling todos"` | The target set already has a root todo with the same title. |

A `todo:moved` event is broadcast to both the source and target sets on success.

---

## `POST /api/teams/:teamId/todos/:id/claim`

Toggle a **claim** on a todo. Claiming assigns the todo to yourself; calling it again while you hold the claim releases it. A todo can only be claimed by one person at a time.

**Auth required:** Yes — `claim_todos` for the set

**Path parameters:**

| Parameter | Description |
| --- | --- |
| `id` | UUID of the todo to claim or release. |

**Behavior:**

- If the todo is unclaimed → it becomes claimed by you.
- If you already hold the claim → it is released (set back to `null`).
- If someone else holds the claim → returns `409`.

**Response:**

```json
{
  "ok": true,
  "claimedBy": "your-user-id",
  "claimedByName": "Ada Lovelace",
  "claimedByUsername": "ada",
  "claimedByAvatar": "https://example.com/a.png"
}
```

When releasing a claim, all `claimedBy*` fields are `null`. A `todo:claimed` event is broadcast to connected clients.

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `403` | `"No permission to claim todos"` | Lacks `claim_todos`. |
| `404` | `"Not found"` | No todo with that ID in this team. |
| `409` | `"Already claimed by another user"` | The todo is currently claimed by someone else. |
| `503` | `"Claim feature unavailable: database migration required"` | The `claimed_by` column is missing — apply pending D1 migrations. |
