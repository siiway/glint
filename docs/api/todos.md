# Todos API

All endpoints require authentication and team membership. Permissions are checked per-action.

## `GET /api/teams/:teamId/sets/:setId/todos`

List all todos in a set, with comment counts and the user's effective permissions.

Requires: `view_todos`

**Response:**

```json
{
  "todos": [
    {
      "id": "uuid",
      "userId": "creator-uuid",
      "parentId": null,
      "title": "Buy groceries",
      "completed": false,
      "sortOrder": 1,
      "commentCount": 3,
      "createdAt": "2026-03-17T12:00:00.000Z",
      "updatedAt": "2026-03-17T12:00:00.000Z"
    }
  ],
  "role": "owner",
  "permissions": {
    "create_todos": true,
    "edit_own_todos": true,
    "edit_any_todo": true,
    "add_subtodos": true,
    "comment": true
  }
}
```

## `POST /api/teams/:teamId/sets/:setId/todos`

Create a new todo. Pass `parentId` to create a sub-todo.

Requires: `create_todos` (or `add_subtodos` for sub-todos)

**Request body:**

```json
{
  "title": "Buy groceries",
  "parentId": "parent-uuid"
}
```

`parentId` is optional. If provided, it must reference a todo in the same set.

**Response (201):**

```json
{
  "todo": {
    "id": "uuid",
    "userId": "creator-uuid",
    "parentId": null,
    "title": "Buy groceries",
    "completed": false,
    "sortOrder": 5,
    "commentCount": 0,
    "createdAt": "2026-03-17T12:00:00.000Z",
    "updatedAt": "2026-03-17T12:00:00.000Z"
  }
}
```

## `PATCH /api/teams/:teamId/todos/:id`

Update a todo. Permission checks depend on the field and ownership:

- `title`: requires `edit_own_todos` (own) or `edit_any_todo` (others')
- `completed`: own todos are always allowed; others' requires `complete_any_todo`
- `sortOrder`: requires `reorder_todos`

**Request body (all fields optional):**

```json
{
  "title": "Updated title",
  "completed": true,
  "sortOrder": 3
}
```

**Response:**

```json
{ "ok": true }
```

## `DELETE /api/teams/:teamId/todos/:id`

Delete a todo and all its sub-todos (cascade).

Requires: `delete_own_todos` (own) or `delete_any_todo` (others')

**Response:**

```json
{ "ok": true }
```

## `POST /api/teams/:teamId/todos/reorder`

Batch update sort orders.

Requires: `reorder_todos`

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
