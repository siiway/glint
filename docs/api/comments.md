# Comments API

Per-todo comments. All endpoints require authentication and team membership.

## `GET /api/teams/:teamId/todos/:todoId/comments`

List comments on a todo, ordered by creation time.

**Response:**

```json
{
  "comments": [
    {
      "id": "uuid",
      "userId": "user-uuid",
      "username": "alice",
      "body": "Looks good!",
      "createdAt": "2026-03-17T14:30:00.000Z"
    }
  ]
}
```

## `POST /api/teams/:teamId/todos/:todoId/comments`

Add a comment. Requires `comment` permission.

**Request body:**

```json
{ "body": "Looks good!" }
```

**Response (201):**

```json
{
  "comment": {
    "id": "uuid",
    "userId": "user-uuid",
    "username": "alice",
    "body": "Looks good!",
    "createdAt": "2026-03-17T14:30:00.000Z"
  }
}
```

## `DELETE /api/teams/:teamId/todos/:todoId/comments/:commentId`

Delete a comment. Requires `delete_own_comments` (own) or `delete_any_comment` (others').

**Response:**

```json
{ "ok": true }
```
