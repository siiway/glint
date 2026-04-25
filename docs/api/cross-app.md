# Cross-App API

Bearer-token-authenticated endpoints for external applications. All requests must carry an `Authorization: Bearer <token>` header containing an access token that was issued via Prism's OAuth flow with the appropriate cross-app scope.

See [Cross-App Integration](/guide/cross-app) for the full setup guide.

## Authentication

Every request must include a valid Prism access token:

```http
Authorization: Bearer <access_token>
```

Glint verifies the token by calling Prism's introspection endpoint (`/api/oauth/introspect`). The token must be:

1. **Active** — not expired or revoked
2. **Scoped** — must include `app:<glint_client_id>:<required_scope>`

After verifying the token, Glint resolves the user's team membership from either a KV cache (populated on prior Glint login) or a live Prism fetch (if the token includes `teams:read`).

### Scope → Endpoint Mapping

Each endpoint requires a specific Prism scope **and** the corresponding Glint role permission. Both must be satisfied.

::: tip Registering these scopes in Prism
The [Cross-App Integration guide](/guide/cross-app#importing-the-scope-definitions-into-prism) ships a copy-pasteable JSON block of all scope definitions, ready for Prism's **Import** dialog (Glint app → Permissions → Import).
:::

| Scope              | Endpoints permitted                                                         |
| ------------------ | --------------------------------------------------------------------------- |
| `read_todos`       | `GET /api/cross-app/teams/:teamId/sets`                                     |
|                    | `GET /api/cross-app/teams/:teamId/sets/:setId/todos`                        |
|                    | `GET /api/cross-app/teams/:teamId/todos/:todoId/comments`                   |
|                    | `GET /api/cross-app/teams/:teamId/sets/:setId/export`                       |
| `create_todos`     | `POST /api/cross-app/teams/:teamId/sets/:setId/todos`                       |
|                    | `POST /api/cross-app/teams/:teamId/sets/:setId/import` (append mode)        |
| `edit_todos`       | `PATCH /api/cross-app/teams/:teamId/todos/:todoId` (title field only)       |
| `complete_todos`   | `PATCH /api/cross-app/teams/:teamId/todos/:todoId` (completed field only)   |
| `delete_todos`     | `DELETE /api/cross-app/teams/:teamId/todos/:todoId`                         |
| `reorder_todos`    | `POST /api/cross-app/teams/:teamId/todos/reorder`                           |
| `claim_todos`      | `POST /api/cross-app/teams/:teamId/todos/:todoId/claim`                     |
| `manage_sets`      | `POST /api/cross-app/teams/:teamId/sets`                                    |
|                    | `PATCH /api/cross-app/teams/:teamId/sets/:setId` (incl. auto-renew, timezone, split-completed) |
|                    | `DELETE /api/cross-app/teams/:teamId/sets/:setId`                           |
|                    | `POST /api/cross-app/teams/:teamId/sets/reorder`                            |
|                    | `POST /api/cross-app/teams/:teamId/sets/import` (import-as-new-set)         |
|                    | `POST /api/cross-app/teams/:teamId/sets/:setId/import` with `mode: "replace"` (also requires `create_todos`) |
| `comment`          | `POST /api/cross-app/teams/:teamId/todos/:todoId/comments`                  |
| `delete_comments`  | `DELETE /api/cross-app/teams/:teamId/todos/:todoId/comments/:commentId`     |
| `read_settings`    | `GET /api/cross-app/teams/:teamId/settings`                                 |
| `manage_settings`  | `PATCH /api/cross-app/teams/:teamId/settings`                               |
| `write_todos`      | Legacy catch-all: accepted wherever `create_todos`, `edit_todos`, or `complete_todos` is required |

The `write_todos` scope is kept for backward compatibility with existing integrations. New integrations should request the specific scopes they need.

---

## Sets

### `GET /api/cross-app/teams/:teamId/sets`

List all todo sets in a team.

**Required scope:** `read_todos`

**Response `200`:**

```json
{
  "sets": [
    {
      "id": "uuid",
      "userId": "user_id_of_creator",
      "name": "Sprint 12",
      "sortOrder": 1,
      "autoRenew": false,
      "renewTime": "00:00",
      "timezone": "",
      "lastRenewedAt": null,
      "splitCompleted": false,
      "createdAt": "2026-04-17T09:00:00.000Z"
    }
  ]
}
```

**Errors:**

| Status | Cause                                                   |
| ------ | ------------------------------------------------------- |
| `401`  | Missing, malformed, or expired bearer token             |
| `403`  | Token lacks `read_todos` scope                          |
| `403`  | User is not a member of `teamId`                        |
| `403`  | Team membership unavailable — include `teams:read` in scope or have the user log in to Glint once |

---

### `POST /api/cross-app/teams/:teamId/sets`

Create a new todo set. Requires the `manage_sets` Glint permission.

**Required scope:** `manage_sets`

**Request body:**

```json
{ "name": "Q3 Goals" }
```

| Field  | Type   | Required | Description                        |
| ------ | ------ | -------- | ---------------------------------- |
| `name` | string | Yes      | Set name. Whitespace is trimmed.   |

**Response `201`:**

```json
{
  "set": {
    "id": "uuid",
    "name": "Q3 Goals",
    "sortOrder": 3,
    "createdAt": "2026-04-17T09:00:00.000Z"
  }
}
```

**Errors:**

| Status | Cause                                              |
| ------ | -------------------------------------------------- |
| `400`  | `name` is missing or empty                         |
| `401`  | Token missing or inactive                          |
| `403`  | Token lacks `manage_sets` scope                    |
| `403`  | User's `manage_sets` permission denied             |

---

### `PATCH /api/cross-app/teams/:teamId/sets/:setId`

Rename or reconfigure a set. Requires the `manage_sets` Glint permission, or the requesting user must own the set.

**Required scope:** `manage_sets`

**Path parameters:**

| Parameter | Description     |
| --------- | --------------- |
| `teamId`  | Prism team ID   |
| `setId`   | Todo set ID     |

**Request body (all fields optional, send only the ones you want to change):**

```json
{
  "name": "Renamed Set",
  "autoRenew": true,
  "renewTime": "06:00",
  "timezone": "America/Los_Angeles",
  "splitCompleted": true
}
```

| Field            | Type    | Description                                                           |
| ---------------- | ------- | --------------------------------------------------------------------- |
| `name`           | string  | New name (whitespace trimmed, must not be empty if sent)              |
| `autoRenew`      | boolean | Enable daily reset of completed todos                                 |
| `renewTime`      | string  | `HH:MM` time of day for auto-renew                                    |
| `timezone`       | string  | IANA timezone (empty = team default)                                  |
| `splitCompleted` | boolean | Show completed root todos in their own section                        |

**Response `200`:**

```json
{ "ok": true }
```

**Errors:**

| Status | Cause                                                              |
| ------ | ------------------------------------------------------------------ |
| `400`  | No fields provided, or `name` is empty                             |
| `401`  | Token missing or inactive                                          |
| `403`  | Token lacks `manage_sets` scope                                    |
| `403`  | User lacks `manage_sets` permission and does not own the set       |
| `404`  | Set not found or does not belong to `teamId`                       |

---

### `DELETE /api/cross-app/teams/:teamId/sets/:setId`

Delete a set and all its todos. Requires `manage_sets` permission, or the requesting user must own the set.

**Required scope:** `manage_sets`

**Response `200`:**

```json
{ "ok": true }
```

**Errors:**

| Status | Cause                                                              |
| ------ | ------------------------------------------------------------------ |
| `401`  | Token missing or inactive                                          |
| `403`  | Token lacks `manage_sets` scope                                    |
| `403`  | User lacks `manage_sets` permission and does not own the set       |
| `404`  | Set not found or does not belong to `teamId`                       |

---

### `POST /api/cross-app/teams/:teamId/sets/reorder`

Persist a new sort order for sets after a drag-and-drop reorder. Send only the sets whose `sortOrder` changed.

**Required scope:** `manage_sets`

**Request body:**

```json
{
  "items": [
    { "id": "set-uuid-1", "sortOrder": 1 },
    { "id": "set-uuid-2", "sortOrder": 2 }
  ]
}
```

**Response `200`:** `{ "ok": true }`

**Errors:** `400` empty `items`; `401` token; `403` scope or permission.

---

### `GET /api/cross-app/teams/:teamId/sets/:setId/export`

Export a set as Markdown, JSON, or YAML. Mirrors the native export endpoint.

**Required scope:** `read_todos`

**Query params:**

| Param             | Default | Description                                       |
| ----------------- | ------- | ------------------------------------------------- |
| `format`          | `md`    | One of `md`, `json`, `yaml`                       |
| `includeComments` | `0`     | Set to `1` to include comments in the export      |

**Response `200`:**

```json
{
  "format": "md",
  "fileName": "Sprint_12.md",
  "content": "- [x] First todo\n- [ ] Second todo"
}
```

**Errors:** `403` scope or `view_todos` permission; `404` set not found.

---

### `POST /api/cross-app/teams/:teamId/sets/:setId/import`

Import todos into an existing set. `mode: "replace"` wipes existing todos first and additionally requires the `manage_sets` scope and permission.

**Required scope:** `create_todos` or `write_todos` (replace mode also requires `manage_sets`)

**Request body:**

```json
{
  "format": "md",
  "content": "- [ ] Todo A\n- [ ] Todo B",
  "mode": "append",
  "includeComments": false,
  "insertAt": "bottom"
}
```

| Field             | Type    | Default    | Description                                                |
| ----------------- | ------- | ---------- | ---------------------------------------------------------- |
| `format`          | string  | `"md"`     | `md`, `json`, or `yaml`                                    |
| `content`         | string  | —          | The serialized payload to import                           |
| `mode`            | string  | `"append"` | `"append"` or `"replace"` (replace requires `manage_sets`) |
| `includeComments` | boolean | `false`    | Import comments embedded in the payload                    |
| `insertAt`        | string  | `"bottom"` | `"top"` or `"bottom"`                                      |

**Response `200`:** `{ "ok": true, "imported": 7 }`

**Errors:** `400` parse failure or empty content; `403` missing scope/permission (replace mode without `manage_sets`).

---

### `POST /api/cross-app/teams/:teamId/sets/import`

Import a payload as a brand-new set in the team.

**Required scope:** `manage_sets`

**Request body:**

```json
{
  "format": "yaml",
  "content": "version: 1\nset:\n  id: my-set-id\n  name: Imported\ntodos: []",
  "includeComments": false,
  "setName": "Optional override",
  "setId": "optional-override-uuid"
}
```

For markdown imports the set ID is always generated; `setName` defaults to `"Imported Set"` if not supplied.

**Response `200`:**

```json
{
  "ok": true,
  "imported": 0,
  "set": {
    "id": "uuid",
    "userId": "user_id_of_creator",
    "name": "Imported",
    "sortOrder": 4,
    "autoRenew": false,
    "renewTime": "00:00",
    "timezone": "",
    "lastRenewedAt": null,
    "splitCompleted": false
  }
}
```

**Errors:** `400` empty content / missing name / parse failure; `409` `setId` already exists in this team.

---

## Todos

### `GET /api/cross-app/teams/:teamId/sets/:setId/todos`

List all todos in a set. Respects the user's `view_todos` permission.

**Required scope:** `read_todos`

**Response `200`:**

```json
{
  "todos": [
    {
      "id": "uuid",
      "userId": "user_id_of_creator",
      "parentId": null,
      "title": "Write unit tests",
      "completed": false,
      "sortOrder": 1,
      "commentCount": 2,
      "claimedBy": "user_id_or_null",
      "claimedByName": "Display Name",
      "claimedByAvatar": "https://example.com/a.png",
      "createdAt": "2026-04-01T10:00:00.000Z",
      "updatedAt": "2026-04-01T10:00:00.000Z"
    },
    {
      "id": "uuid-2",
      "userId": "user_id_of_creator",
      "parentId": "uuid",
      "title": "Cover edge cases",
      "completed": true,
      "sortOrder": 1,
      "commentCount": 0,
      "claimedBy": null,
      "claimedByName": null,
      "claimedByAvatar": null,
      "createdAt": "2026-04-01T10:05:00.000Z",
      "updatedAt": "2026-04-02T08:00:00.000Z"
    }
  ]
}
```

Todos are returned flat. Sub-todos have a non-null `parentId` referencing their parent. `claimedByName` / `claimedByAvatar` are resolved from Prism for team spaces; for personal spaces only the calling user is resolved.

**Errors:**

| Status | Cause                                              |
| ------ | -------------------------------------------------- |
| `401`  | Token missing or inactive                          |
| `403`  | Insufficient scope or team membership              |
| `403`  | User's `view_todos` permission denied for this set |
| `404`  | Set not found or does not belong to `teamId`       |

---

### `POST /api/cross-app/teams/:teamId/sets/:setId/todos`

Create a new todo. When `parentId` is provided, the `add_subtodos` Glint permission is required instead of `create_todos`.

**Required scope:** `create_todos` or `write_todos`

**Request body:**

```json
{
  "title": "Write documentation",
  "parentId": "optional-parent-uuid"
}
```

| Field      | Type   | Required | Description                                              |
| ---------- | ------ | -------- | -------------------------------------------------------- |
| `title`    | string | Yes      | The todo title. Whitespace is trimmed.                   |
| `parentId` | string | No       | Parent todo ID. Requires `add_subtodos` permission.      |

**Response `201`:**

```json
{
  "todo": {
    "id": "uuid",
    "parentId": null,
    "title": "Write documentation",
    "completed": false,
    "sortOrder": 5,
    "createdAt": "2026-04-17T09:00:00.000Z",
    "updatedAt": "2026-04-17T09:00:00.000Z"
  }
}
```

**Errors:**

| Status | Cause                                                                           |
| ------ | ------------------------------------------------------------------------------- |
| `400`  | `title` is missing or empty                                                     |
| `401`  | Token missing or inactive                                                       |
| `403`  | Token lacks `create_todos` or `write_todos` scope                               |
| `403`  | User's `create_todos` permission denied (or `add_subtodos` when using parentId) |
| `404`  | Set not found, or `parentId` does not exist in this set                         |

---

### `PATCH /api/cross-app/teams/:teamId/todos/:todoId`

Update a todo's title or completion state. Each field requires its own scope and Glint permission:

| Field       | Required scope                          | Required Glint permission                              |
| ----------- | --------------------------------------- | ------------------------------------------------------ |
| `title`     | `edit_todos` or `write_todos`           | `edit_own_todos` (own) / `edit_any_todo` (others')     |
| `completed` | `complete_todos` or `write_todos`       | None for own todos; `complete_any_todo` for others'    |

Both fields may be updated in a single request. Each is checked independently.

**Path parameters:**

| Parameter | Description    |
| --------- | -------------- |
| `teamId`  | Prism team ID  |
| `todoId`  | Todo ID        |

**Request body (all fields optional, at least one required):**

```json
{
  "title": "Updated title",
  "completed": true
}
```

**Response `200`:**

```json
{ "ok": true }
```

**Errors:**

| Status | Cause                                                                                |
| ------ | ------------------------------------------------------------------------------------ |
| `401`  | Token missing or inactive                                                            |
| `403`  | Token lacks the required scope for the requested field (`edit_todos`/`complete_todos` or `write_todos`) |
| `403`  | User's `edit_any_todo` or `complete_any_todo` permission denied                      |
| `404`  | Todo not found or does not belong to `teamId`                                        |

---

### `DELETE /api/cross-app/teams/:teamId/todos/:todoId`

Delete a todo. Requires `delete_own_todos` for own todos, `delete_any_todo` for others'.

**Required scope:** `delete_todos`

**Response `200`:**

```json
{ "ok": true }
```

**Errors:**

| Status | Cause                                                            |
| ------ | ---------------------------------------------------------------- |
| `401`  | Token missing or inactive                                        |
| `403`  | Token lacks `delete_todos` scope                                 |
| `403`  | User's `delete_own_todos` or `delete_any_todo` permission denied |
| `404`  | Todo not found or does not belong to `teamId`                    |

---

### `POST /api/cross-app/teams/:teamId/todos/reorder`

Persist new sort orders for one or more todos after a drag-and-drop reorder. Sub-todos and root todos can be sent in the same batch.

**Required scope:** `reorder_todos`

**Request body:**

```json
{
  "items": [
    { "id": "todo-uuid-1", "sortOrder": 1 },
    { "id": "todo-uuid-2", "sortOrder": 2 }
  ]
}
```

**Response `200`:** `{ "ok": true }`

**Errors:** `400` empty `items`; `401` token; `403` missing scope or `reorder_todos` permission.

---

### `POST /api/cross-app/teams/:teamId/todos/:todoId/claim`

Toggle the claim on a todo: claims for the caller if unclaimed, releases if claimed by the caller. Returns `409` if claimed by someone else.

**Required scope:** `claim_todos`

**Response `200`:**

```json
{
  "ok": true,
  "claimedBy": "user_id_or_null",
  "claimedByName": "Display Name or null",
  "claimedByAvatar": "https://example.com/a.png"
}
```

**Errors:**

| Status | Cause                                                              |
| ------ | ------------------------------------------------------------------ |
| `401`  | Token missing or inactive                                          |
| `403`  | Token lacks `claim_todos` scope or user lacks `claim_todos` permission |
| `404`  | Todo not found or does not belong to `teamId`                      |
| `409`  | Already claimed by another user                                    |
| `503`  | Database missing the `claimed_by` column (run migrations)          |

---

## Comments

### `GET /api/cross-app/teams/:teamId/todos/:todoId/comments`

List all comments on a todo. Requires `view_todos` permission on the todo's set.

**Required scope:** `read_todos`

**Response `200`:**

```json
{
  "comments": [
    {
      "id": "uuid",
      "userId": "user-uuid",
      "username": "alice",
      "body": "Looks good!",
      "createdAt": "2026-04-17T10:00:00.000Z"
    }
  ]
}
```

**Errors:**

| Status | Cause                                              |
| ------ | -------------------------------------------------- |
| `401`  | Token missing or inactive                          |
| `403`  | Token lacks `read_todos` scope                     |
| `403`  | User's `view_todos` permission denied for this set |
| `404`  | Todo not found or does not belong to `teamId`      |

---

### `POST /api/cross-app/teams/:teamId/todos/:todoId/comments`

Post a comment on a todo. Requires the `comment` Glint permission.

**Required scope:** `comment`

**Request body:**

```json
{ "body": "Looks good to me!" }
```

| Field  | Type   | Required | Description                              |
| ------ | ------ | -------- | ---------------------------------------- |
| `body` | string | Yes      | Comment text. Whitespace is trimmed.     |

**Response `201`:**

```json
{
  "comment": {
    "id": "uuid",
    "userId": "user-uuid",
    "username": "alice",
    "body": "Looks good to me!",
    "createdAt": "2026-04-17T10:00:00.000Z"
  }
}
```

**Errors:**

| Status | Cause                                            |
| ------ | ------------------------------------------------ |
| `400`  | `body` is missing or empty                       |
| `401`  | Token missing or inactive                        |
| `403`  | Token lacks `comment` scope                      |
| `403`  | User's `comment` permission denied for this set  |
| `404`  | Todo not found or does not belong to `teamId`    |

---

### `DELETE /api/cross-app/teams/:teamId/todos/:todoId/comments/:commentId`

Delete a comment. Requires `delete_own_comments` for own comments, `delete_any_comment` for others'.

**Required scope:** `delete_comments`

**Response `200`:**

```json
{ "ok": true }
```

**Errors:**

| Status | Cause                                                                  |
| ------ | ---------------------------------------------------------------------- |
| `401`  | Token missing or inactive                                              |
| `403`  | Token lacks `delete_comments` scope                                    |
| `403`  | User's `delete_own_comments` or `delete_any_comment` permission denied |
| `404`  | Todo or comment not found                                              |

---

## Settings

### `GET /api/cross-app/teams/:teamId/settings`

Read team settings. Available to any team member.

**Required scope:** `read_settings`

**Response `200`:**

```json
{
  "settings": {
    "site_name": "Acme Todos",
    "site_logo_url": "",
    "accent_color": "#6366f1",
    "welcome_message": "",
    "default_set_name": "Not Grouped",
    "allow_member_create_sets": false,
    "default_timezone": "UTC"
  }
}
```

**Errors:**

| Status | Cause                                  |
| ------ | -------------------------------------- |
| `401`  | Token missing or inactive              |
| `403`  | Token lacks `read_settings` scope      |
| `403`  | User is not a member of `teamId`       |

---

### `PATCH /api/cross-app/teams/:teamId/settings`

Update team settings. Requires the `manage_settings` Glint permission (owner or explicitly granted admin).

**Required scope:** `manage_settings`

**Request body (all fields optional):**

```json
{
  "site_name": "Acme Todos",
  "accent_color": "#6366f1",
  "welcome_message": "Welcome to the team!",
  "default_set_name": "Inbox",
  "allow_member_create_sets": true,
  "default_timezone": "America/New_York"
}
```

Only the fields listed below are accepted; any other keys are ignored:

| Field                      | Type    | Description                                   |
| -------------------------- | ------- | --------------------------------------------- |
| `site_name`                | string  | Display name for the workspace                |
| `site_logo_url`            | string  | URL for the workspace logo                    |
| `accent_color`             | string  | CSS color value for the accent color          |
| `welcome_message`          | string  | Message shown to members on the home screen   |
| `default_set_name`         | string  | Default name for the ungrouped set            |
| `allow_member_create_sets` | boolean | Whether members can create new sets           |
| `default_timezone`         | string  | IANA timezone identifier                      |

**Response `200`:**

```json
{
  "settings": { "...": "full updated settings object" }
}
```

**Errors:**

| Status | Cause                                          |
| ------ | ---------------------------------------------- |
| `401`  | Token missing or inactive                      |
| `403`  | Token lacks `manage_settings` scope            |
| `403`  | User's `manage_settings` permission denied     |

---

## Common Error Shape

All errors return JSON:

```json
{ "error": "Human-readable description" }
```

| Message fragment                                        | Meaning                                                    |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| `"Token inactive or expired"`                           | Introspection returned `active: false`                     |
| `"Missing required scope. Token must include one of: …"` | Token exists but lacks any of the required cross-app scopes |
| `"Not a member of this team"`                           | User is not in the requested team                          |
| `"Team membership unavailable"`                         | KV cache miss and no `teams:read` in token scope           |
| `"No permission to view todos"`                         | User's `view_todos` permission is off for this set         |
| `"No permission: create_todos"`                         | User's `create_todos` permission denied                    |
| `"No permission: add_subtodos"`                         | User's `add_subtodos` permission denied                    |
| `"No permission to edit this todo"`                     | Missing `edit_own_todos` or `edit_any_todo`                |
| `"No permission to toggle completion"`                  | Missing `complete_any_todo` for another user's todo        |
| `"No permission to delete this todo"`                   | Missing `delete_own_todos` or `delete_any_todo`            |
| `"No permission to manage sets"`                        | User's `manage_sets` permission denied                     |
| `"No permission to comment"`                            | User's `comment` permission denied for this set            |
| `"No permission to delete this comment"`                | Missing `delete_own_comments` or `delete_any_comment`      |
| `"No permission to manage settings"`                    | User's `manage_settings` permission denied                 |
| `"Missing required scope: edit_todos or write_todos"`   | Tried to update `title` without the right scope            |
| `"Missing required scope: complete_todos or write_todos"` | Tried to update `completed` without the right scope      |
