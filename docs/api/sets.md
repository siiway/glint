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
      "splitCompleted": false,
      "createdAt": "2026-03-17T12:00:00.000Z"
    },
    {
      "id": "uuid-2",
      "userId": "creator-uuid",
      "name": "Backlog",
      "sortOrder": 2,
      "splitCompleted": true,
      "createdAt": "2026-03-18T09:00:00.000Z"
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
| `sets[].splitCompleted` | boolean | When `true`, completed todos are shown in a separate collapsed section. |
| `sets[].createdAt` | string (ISO 8601) | Creation timestamp. |
| `role` | string | Current user's role: `"owner"`, `"co_owner"`, `"admin"`, or `"member"`. |

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
    "splitCompleted": false,
    "createdAt": "2026-03-17T12:00:00.000Z"
  }
}
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `400` | `"Name is required"` | `name` is missing or empty. |
| `403` | `"Forbidden"` | Lacks `manage_sets`. |

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
  "splitCompleted": true
}
```

| Field | Type | Description |
| --- | --- | --- |
| `name` | string | New display name. Cannot be empty if provided. |
| `splitCompleted` | boolean | Enable/disable the split-completed-todos layout for this set. |

**Response:**

```json
{ "ok": true }
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `400` | `"Name cannot be empty"` | `name` was provided but is an empty string. |
| `403` | `"Forbidden"` | Lacks `manage_sets` and is not the set's creator. |
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
| `400` | `"Items required"` | `items` is missing or empty. |
| `403` | `"Forbidden"` | Lacks `manage_sets`. |
