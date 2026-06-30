# Todo Sets API

Todo sets are containers for grouping todos within a team workspace. All endpoints require authentication and team membership. Permission checks are enforced per-operation.

---

## `GET /api/teams/:teamId/sets`

List all sets for a team, ordered by `sortOrder` ascending. If no sets exist, a default set is automatically created before returning.

**Auth required:** Yes — team member

**Response:**

```json
{
  "sets": [
    {
      "id": "uuid",
      "userId": "creator-uuid",
      "name": "Sprint 12",
      "sortOrder": 1,
      "autoRenew": false,
      "renewTime": "00:00",
      "timezone": "",
      "lastRenewedAt": null,
      "splitCompleted": false,
      "createdAt": "2026-03-17T12:00:00.000Z",
      "total": 8,
      "completed": 3,
      "pending": 5
    },
    {
      "id": "uuid-2",
      "userId": "creator-uuid",
      "name": "Backlog",
      "sortOrder": 2,
      "autoRenew": true,
      "renewTime": "06:00",
      "timezone": "Asia/Shanghai",
      "lastRenewedAt": "2026-03-18T22:00:00.000Z",
      "splitCompleted": true,
      "createdAt": "2026-03-18T09:00:00.000Z",
      "total": 12,
      "completed": 12,
      "pending": 0
    }
  ],
  "role": "owner"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `sets[].id` | string (UUID) | Unique identifier for the set. |
| `sets[].userId` | string (UUID) | ID of the user who created the set. |
| `sets[].name` | string | Display name. |
| `sets[].sortOrder` | number | Integer sort position (lower = higher in list). |
| `sets[].autoRenew` | boolean | When `true`, all completed todos in the set are reset to incomplete daily. See [Auto-Renew](#auto-renew). |
| `sets[].renewTime` | string | `HH:MM` (24-hour) local time of day at which auto-renew runs. |
| `sets[].timezone` | string | IANA timezone name used to evaluate `renewTime`. Empty string falls back to the team's `default_timezone`. |
| `sets[].lastRenewedAt` | string \| null | ISO 8601 timestamp of the last successful auto-renew, or `null` if it has never run. |
| `sets[].splitCompleted` | boolean | When `true`, completed todos are shown in a separate collapsed section. |
| `sets[].createdAt` | string (ISO 8601) | Creation timestamp. |
| `sets[].total` | number | Count of top-level todos in the set. |
| `sets[].completed` | number | Count of completed top-level todos. |
| `sets[].pending` | number | Count of incomplete top-level todos (`total - completed`). |
| `role` | string | Current user's role: `"owner"`, `"co-owner"`, `"admin"`, or `"member"`. |

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `401` | `"Unauthorized"` | Not logged in. |
| `403` | `"Forbidden"` | Not a member of this team. |

---

## `POST /api/teams/:teamId/sets`

Create a new set. The new set is appended at the end (highest `sortOrder + 1`).

**Auth required:** Yes — `manage_sets` permission

**Request body:**

```json
{ "name": "Sprint 12" }
```

| Field | Type | Required | Description |
| --- | --- | :---: | --- |
| `name` | string | Yes | Display name for the new set. Cannot be empty. |

**Response (201):**

```json
{
  "set": {
    "id": "uuid",
    "userId": "creator-uuid",
    "name": "Sprint 12",
    "sortOrder": 3,
    "autoRenew": false,
    "renewTime": "00:00",
    "timezone": "",
    "lastRenewedAt": null,
    "splitCompleted": false,
    "createdAt": "2026-03-17T12:00:00.000Z"
  }
}
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `400` | `"Name is required"` | `name` is missing or empty. |
| `403` | `"No permission to manage sets"` | Lacks `manage_sets`. |
| `409` | `"Todo list name already exists in this team"` | Another set in the team already uses this name. |

---

## `PATCH /api/teams/:teamId/sets/:setId`

Update a set's name or options. Only provided fields are changed.

**Auth required:** Yes — `manage_sets`, or the current user must be the set's creator

**Path parameters:**

| Parameter | Description |
| --- | --- |
| `setId` | UUID of the set to update. |

**Request body** (all fields optional):

```json
{
  "name": "Sprint 13",
  "autoRenew": true,
  "renewTime": "06:00",
  "timezone": "Asia/Shanghai",
  "splitCompleted": true
}
```

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | New display name. Cannot be empty if provided. |
| `autoRenew` | boolean | Enable/disable daily auto-renew of completed todos. See [Auto-Renew](#auto-renew). |
| `renewTime` | string | `HH:MM` (24-hour) local time at which auto-renew runs. |
| `timezone` | string | IANA timezone name (e.g. `Asia/Shanghai`). Empty string falls back to the team `default_timezone`. |
| `splitCompleted` | boolean | Enable/disable the split-completed-todos layout for this set. |

**Response:**

```json
{ "ok": true }
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `400` | `"Name is required"` | `name` was provided but is an empty string. |
| `400` | `"No updates"` | No recognized fields were provided. |
| `403` | `"No permission to manage sets"` | Lacks `manage_sets` and is not the set's creator. |
| `409` | `"Todo list name already exists in this team"` | Another set in the team already uses the new name. |
| `404` | `"Set not found"` | No set with that ID in this team. |

---

## `DELETE /api/teams/:teamId/sets/:setId`

Delete a set and **all** of its todos, sub-todos, and comments (cascading delete).

**Auth required:** Yes — `manage_sets`, or the current user must be the set's creator

::: warning
This operation is permanent. All todos, sub-todos, and comments inside the set are deleted immediately. There is no recycle bin or undo.
:::

**Response:**

```json
{ "ok": true }
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `403` | `"Forbidden"` | Lacks `manage_sets` and is not the set's creator. |
| `404` | `"Set not found"` | No set with that ID in this team. |

---

## `POST /api/teams/:teamId/sets/reorder`

Batch update `sortOrder` for multiple sets in one request. The caller is responsible for providing consistent, gap-free integers (e.g. 1, 2, 3).

**Auth required:** Yes — `manage_sets`

**Request body:**

```json
{
  "items": [
    { "id": "uuid-1", "sortOrder": 1 },
    { "id": "uuid-2", "sortOrder": 2 },
    { "id": "uuid-3", "sortOrder": 3 }
  ]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `items` | array | List of `{id, sortOrder}` objects. All sets that need new positions should be included. |
| `items[].id` | string (UUID) | ID of the set to update. |
| `items[].sortOrder` | number | New sort position (integer). |

**Response:**

```json
{ "ok": true }
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `400` | `"No items"` | `items` is missing or empty. |
| `403` | `"No permission to manage sets"` | Lacks `manage_sets`. |

---

## `GET /api/teams/:teamId/sets/:setId/export`

Export a set's todos as Markdown, JSON, or YAML. The response wraps the serialized content along with a suggested file name.

**Auth required:** Yes — `view_todos` for the set

**Query parameters:**

| Parameter | Default | Description |
| --- | --- | --- |
| `format` | `md` | Output format: `md`, `json`, or `yaml`. |
| `includeComments` | `0` | Set to `1` to embed each todo's comments in the export. |

**Response:**

```json
{
  "format": "md",
  "fileName": "Sprint_12.md",
  "content": "- [x] First todo\n- [ ] Second todo"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `format` | string | The resolved file extension (`md`, `json`, or `yaml`). |
| `fileName` | string | Suggested download file name, derived from the set name. |
| `content` | string | The serialized export payload. |

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `403` | `"No permission to export this set"` | Lacks `view_todos` for this set. |
| `404` | `"Set not found"` | No set with that ID in this team. |

---

## `POST /api/teams/:teamId/sets/:setId/import`

Import todos into an **existing** set, either appending to or replacing its current contents.

**Auth required:** Yes — `create_todos` for the set (`replace` mode additionally requires `manage_sets`)

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

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `format` | string | `"md"` | `md`, `json`, or `yaml`. |
| `content` | string | — | The serialized payload to import. Cannot be empty. |
| `mode` | string | `"append"` | `"append"` keeps existing todos; `"replace"` deletes them first (requires `manage_sets`). |
| `includeComments` | boolean | `false` | Import any comments embedded in the payload. |
| `insertAt` | string | `"bottom"` | `"top"` or `"bottom"` — where appended todos are placed. |

**Response:**

```json
{ "ok": true, "imported": 2 }
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `400` | `"Content is required"` | `content` is missing or empty. |
| `400` | `"Failed to parse import content"` | The payload could not be parsed in the given `format`. |
| `403` | `"No permission to import into this set"` | Lacks `create_todos`. |
| `403` | `"No permission to replace set content"` | `mode: "replace"` without `manage_sets`. |
| `409` | `"Todo item title already exists among sibling todos: <title>"` | A duplicate title would be created among siblings. |

---

## `POST /api/teams/:teamId/sets/import`

Import a payload as a **brand-new** set in the team.

**Auth required:** Yes — `manage_sets`

**Request body:**

```json
{
  "format": "yaml",
  "content": "version: 1\nset:\n  id: my-set-id\n  name: Imported\ntodos: []",
  "includeComments": false,
  "setName": "Optional name override",
  "setId": "optional-id-override"
}
```

| Field | Type | Default | Description |
| --- | --- | --- | --- |
| `format` | string | `"md"` | `md`, `json`, or `yaml`. |
| `content` | string | — | The serialized payload to import. Cannot be empty. |
| `includeComments` | boolean | `false` | Import comments embedded in the payload. |
| `setName` | string | from payload | Overrides the set name. Markdown imports default to `"Imported Set"`. |
| `setId` | string | from payload | Overrides the set ID (JSON/YAML only; Markdown always generates a new ID). |

**Response (201):**

```json
{
  "ok": true,
  "imported": 0,
  "set": {
    "id": "uuid",
    "userId": "creator-uuid",
    "name": "Imported",
    "sortOrder": 4,
    "autoRenew": false,
    "renewTime": "00:00",
    "timezone": "",
    "lastRenewedAt": null,
    "splitCompleted": false,
    "createdAt": "2026-03-17T12:00:00.000Z"
  }
}
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `400` | `"Content is required"` | `content` is missing or empty. |
| `400` | `"Failed to parse import content"` | The payload could not be parsed. |
| `403` | `"No permission to manage sets"` | Lacks `manage_sets`. |
| `409` | `"Todo list name already exists in this team"` | The target set name is already in use. |
| `409` | `"Set id already exists"` | The supplied `setId` already exists in this team. |

---

## Auto-Renew

When a set has `autoRenew` enabled, a scheduled Cloudflare cron job (running every 15 minutes) resets all completed todos in the set back to incomplete once per day. This is useful for recurring checklists such as daily standups or routines.

A renewal fires when, in the set's effective timezone:

- the current local time is at or past `renewTime`, **and**
- the set has not already been renewed for the current local date.

The effective timezone is the set's own `timezone`, or — if that is empty — the team's `default_timezone` (see [Team Settings](./settings)). After a renewal the set's `lastRenewedAt` is updated to prevent it from running again the same day.
