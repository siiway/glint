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

| Scope          | Endpoints permitted                                            |
| -------------- | -------------------------------------------------------------- |
| `read_todos`   | `GET /api/cross-app/teams/:teamId/sets`                        |
|                | `GET /api/cross-app/teams/:teamId/sets/:setId/todos`           |
| `write_todos`  | `POST /api/cross-app/teams/:teamId/sets/:setId/todos`          |
|                | `PATCH /api/cross-app/teams/:teamId/todos/:todoId`             |
| `delete_todos` | `DELETE /api/cross-app/teams/:teamId/todos/:todoId`            |

---

## `GET /api/cross-app/teams/:teamId/sets`

List all todo sets in a team.

**Required scope:** `read_todos`

**Path parameters:**

| Parameter  | Description              |
| ---------- | ------------------------ |
| `teamId`   | The Prism team ID        |

**Response `200`:**

```json
{
  "sets": [
    { "id": "uuid", "name": "Sprint 12" },
    { "id": "uuid", "name": "Backlog" }
  ]
}
```

**Errors:**

| Status | Cause                                                   |
| ------ | ------------------------------------------------------- |
| `401`  | Missing, malformed, or expired bearer token             |
| `403`  | Token lacks `app:<glint_id>:read_todos` scope           |
| `403`  | User is not a member of `teamId`                        |
| `403`  | Team membership unavailable — include `teams:read` in scope or have the user log in to Glint once |

---

## `GET /api/cross-app/teams/:teamId/sets/:setId/todos`

List all todos in a set. Respects the user's `view_todos` permission.

**Required scope:** `read_todos`

**Path parameters:**

| Parameter  | Description        |
| ---------- | ------------------ |
| `teamId`   | The Prism team ID  |
| `setId`    | The todo set ID    |

**Response `200`:**

```json
{
  "todos": [
    {
      "id": "uuid",
      "parentId": null,
      "title": "Write unit tests",
      "completed": false,
      "sortOrder": 1,
      "createdAt": "2026-04-01T10:00:00.000Z",
      "updatedAt": "2026-04-01T10:00:00.000Z"
    },
    {
      "id": "uuid-2",
      "parentId": "uuid",
      "title": "Cover edge cases",
      "completed": true,
      "sortOrder": 1,
      "createdAt": "2026-04-01T10:05:00.000Z",
      "updatedAt": "2026-04-02T08:00:00.000Z"
    }
  ]
}
```

Todos are returned flat. Sub-todos have a non-null `parentId` referencing their parent.

**Errors:**

| Status | Cause                                           |
| ------ | ----------------------------------------------- |
| `401`  | Token missing or inactive                       |
| `403`  | Insufficient scope or team membership           |
| `403`  | User's `view_todos` permission denied for this set |
| `404`  | Set not found or does not belong to `teamId`    |

---

## `POST /api/cross-app/teams/:teamId/sets/:setId/todos`

Create a new todo in a set. Respects the user's `create_todos` permission.

**Required scope:** `write_todos`

**Path parameters:**

| Parameter  | Description        |
| ---------- | ------------------ |
| `teamId`   | The Prism team ID  |
| `setId`    | The todo set ID    |

**Request body:**

```json
{
  "title": "Write documentation",
  "parentId": "optional-parent-uuid"
}
```

| Field      | Type   | Required | Description                                    |
| ---------- | ------ | -------- | ---------------------------------------------- |
| `title`    | string | Yes      | The todo title. Whitespace is trimmed.         |
| `parentId` | string | No       | Parent todo ID for creating a sub-todo         |

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

| Status | Cause                                           |
| ------ | ----------------------------------------------- |
| `400`  | `title` is missing or empty                     |
| `401`  | Token missing or inactive                       |
| `403`  | Insufficient scope, team membership, or `create_todos` permission denied |
| `404`  | Set not found or does not belong to `teamId`    |

---

## `PATCH /api/cross-app/teams/:teamId/todos/:todoId`

Update a todo's title or completion state. Permission checks follow the same rules as the regular Glint API:

- Updating `title`: requires `edit_own_todos` for own todos, `edit_any_todo` for others'
- Updating `completed`: no extra permission required for own todos; `complete_any_todo` required for others'

**Required scope:** `write_todos`

**Path parameters:**

| Parameter  | Description        |
| ---------- | ------------------ |
| `teamId`   | The Prism team ID  |
| `todoId`   | The todo ID        |

**Request body (all fields optional):**

```json
{
  "title": "Updated title",
  "completed": true
}
```

At least one field must be present.

**Response `200`:**

```json
{ "ok": true }
```

**Errors:**

| Status | Cause                                                                        |
| ------ | ---------------------------------------------------------------------------- |
| `401`  | Token missing or inactive                                                    |
| `403`  | Insufficient scope, team membership, or edit/complete permission denied      |
| `404`  | Todo not found or does not belong to `teamId`                                |

---

## `DELETE /api/cross-app/teams/:teamId/todos/:todoId`

Delete a todo. Cascades to sub-todos. Requires `delete_own_todos` for own todos, `delete_any_todo` for others'.

**Required scope:** `delete_todos`

**Path parameters:**

| Parameter  | Description        |
| ---------- | ------------------ |
| `teamId`   | The Prism team ID  |
| `todoId`   | The todo ID        |

**Response `200`:**

```json
{ "ok": true }
```

**Errors:**

| Status | Cause                                                           |
| ------ | --------------------------------------------------------------- |
| `401`  | Token missing or inactive                                       |
| `403`  | Insufficient scope, team membership, or delete permission denied |
| `404`  | Todo not found or does not belong to `teamId`                   |

---

## Common Error Shape

All errors return JSON:

```json
{ "error": "Human-readable description" }
```

Specific error messages for `403` include:

| Message fragment                                       | Meaning                                               |
| ------------------------------------------------------ | ----------------------------------------------------- |
| `"Token inactive or expired"`                          | Introspection returned `active: false`                |
| `"Missing required scope: app:..."`                    | Token exists but lacks the required cross-app scope   |
| `"Not a member of this team"`                          | User is not in the requested team                     |
| `"Team membership unavailable"`                        | KV cache miss and no `teams:read` in token scope      |
| `"No permission to view todos"`                        | User's `view_todos` permission is off for this set    |
| `"No permission to create todos"`                      | User's `create_todos` permission is off               |
| `"No permission to edit this todo"`                    | Missing `edit_own_todos` or `edit_any_todo`           |
| `"No permission to delete this todo"`                  | Missing `delete_own_todos` or `delete_any_todo`       |
