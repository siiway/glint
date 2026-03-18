# Todo Sets API

Todo sets are containers for grouping todos within a team. All endpoints require authentication and team membership.

## `GET /api/teams/:teamId/sets`

List all sets for a team, ordered by `sort_order`. Automatically creates a default set if none exists.

**Response:**

```json
{
  "sets": [
    {
      "id": "uuid",
      "userId": "creator-uuid",
      "name": "Sprint 12",
      "sortOrder": 1,
      "createdAt": "2026-03-17T12:00:00.000Z"
    }
  ],
  "role": "owner"
}
```

## `POST /api/teams/:teamId/sets`

Create a new set. Requires `manage_sets` permission.

**Request body:**

```json
{ "name": "Sprint 12" }
```

**Response (201):**

```json
{
  "set": {
    "id": "uuid",
    "userId": "creator-uuid",
    "name": "Sprint 12",
    "sortOrder": 3,
    "createdAt": "2026-03-17T12:00:00.000Z"
  }
}
```

## `PATCH /api/teams/:teamId/sets/:setId`

Rename a set. Requires `manage_sets` permission, or ownership of the set.

**Request body:**

```json
{ "name": "Sprint 13" }
```

**Response:**

```json
{ "ok": true }
```

## `DELETE /api/teams/:teamId/sets/:setId`

Delete a set and all its todos (cascade). Requires `manage_sets` permission, or ownership of the set.

**Response:**

```json
{ "ok": true }
```

## `POST /api/teams/:teamId/sets/reorder`

Batch update sort orders for sets. Requires `manage_sets` permission.

**Request body:**

```json
{
  "items": [
    { "id": "uuid-1", "sortOrder": 1 },
    { "id": "uuid-2", "sortOrder": 2 }
  ]
}
```

**Response:**

```json
{ "ok": true }
```
