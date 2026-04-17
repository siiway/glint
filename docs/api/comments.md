# Comments API

Per-todo threaded comments. All endpoints require authentication and team membership. Comment permissions are checked against the team's permission configuration.

---

## `GET /api/teams/:teamId/todos/:todoId/comments`

List all comments on a todo, ordered by `createdAt` ascending (oldest first).

**Auth required:** Yes — team member with `view_todos` for the set

**Path parameters:**

| Parameter | Description |
| --- | --- |
| `teamId` | The team UUID. |
| `todoId` | The UUID of the todo whose comments to fetch. |

**Response:**

```json
{
  "comments": [
    {
      "id": "uuid",
      "userId": "user-uuid",
      "username": "alice",
      "displayName": "Alice Chen",
      "avatarUrl": "https://id.example.com/avatars/alice.png",
      "body": "Looks good to me!",
      "createdAt": "2026-03-17T14:30:00.000Z"
    },
    {
      "id": "uuid-2",
      "userId": "user-uuid-2",
      "username": "bob",
      "displayName": "Bob Smith",
      "avatarUrl": "",
      "body": "I'll handle the deployment.",
      "createdAt": "2026-03-17T15:00:00.000Z"
    }
  ]
}
```

| Field | Type | Description |
| --- | --- | --- |
| `comments[].id` | string (UUID) | Unique comment identifier. |
| `comments[].userId` | string (UUID) | ID of the comment author. |
| `comments[].username` | string | Author's Prism username (login name). |
| `comments[].displayName` | string | Author's display name. May be empty. |
| `comments[].avatarUrl` | string | URL to avatar image. May be empty. Fetched directly from Prism's CDN by the browser. |
| `comments[].body` | string | Comment text content. |
| `comments[].createdAt` | string (ISO 8601) | Timestamp of when the comment was posted. |

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `401` | `"Unauthorized"` | Not logged in. |
| `403` | `"Forbidden"` | Not a member, or `view_todos` is revoked for this set. |
| `404` | `"Todo not found"` | No todo with that ID in this team. |

---

## `POST /api/teams/:teamId/todos/:todoId/comments`

Add a new comment to a todo.

**Auth required:** Yes — `comment` permission

**Request body:**

```json
{ "body": "Looks good to me!" }
```

| Field | Type | Required | Description |
| --- | --- | :---: | --- |
| `body` | string | Yes | Comment text. Cannot be empty. |

**Response (201):**

```json
{
  "comment": {
    "id": "new-uuid",
    "userId": "user-uuid",
    "username": "alice",
    "displayName": "Alice Chen",
    "avatarUrl": "https://id.example.com/avatars/alice.png",
    "body": "Looks good to me!",
    "createdAt": "2026-03-17T14:30:00.000Z"
  }
}
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `400` | `"Body is required"` | `body` is missing or empty. |
| `403` | `"Forbidden"` | Lacks `comment` permission. |
| `404` | `"Todo not found"` | No todo with that ID in this team. |

---

## `DELETE /api/teams/:teamId/todos/:todoId/comments/:commentId`

Delete a comment. You can always delete your own comments; deleting others' requires the `delete_any_comment` permission.

**Auth required:** Yes — `delete_own_comments` (own comment) or `delete_any_comment` (others')

**Path parameters:**

| Parameter | Description |
| --- | --- |
| `commentId` | UUID of the comment to delete. |

**Response:**

```json
{ "ok": true }
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `403` | `"Forbidden"` | Comment belongs to another user and you lack `delete_any_comment`. |
| `404` | `"Comment not found"` | No comment with that ID on this todo. |
