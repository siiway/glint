# 待办事项 API

所有端点需要身份验证和团队成员身份。权限按操作逐一检查。

## `GET /api/teams/:teamId/sets/:setId/todos`

列出集合中的所有待办事项，包含评论数量和用户的有效权限。

需要：`view_todos`

**响应：**

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

创建新的待办事项。传入 `parentId` 可创建子待办。

需要：`create_todos`（子待办需要 `add_subtodos`）

**请求体：**

```json
{
  "title": "Buy groceries",
  "parentId": "parent-uuid"
}
```

`parentId` 为可选。如果提供，必须引用同一集合中的待办事项。

**响应（201）：**

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

更新待办事项。权限检查取决于字段和所有权：

- `title`：需要 `edit_own_todos`（自己的）或 `edit_any_todo`（他人的）
- `completed`：自己的待办始终允许；他人的需要 `complete_any_todo`
- `sortOrder`：需要 `reorder_todos`

**请求体（所有字段均为可选）：**

```json
{
  "title": "Updated title",
  "completed": true,
  "sortOrder": 3
}
```

**响应：**

```json
{ "ok": true }
```

## `DELETE /api/teams/:teamId/todos/:id`

删除待办事项及其所有子待办（级联删除）。

需要：`delete_own_todos`（自己的）或 `delete_any_todo`（他人的）

**响应：**

```json
{ "ok": true }
```

## `POST /api/teams/:teamId/todos/reorder`

批量更新排序。

需要：`reorder_todos`

**请求体：**

```json
{
  "items": [
    { "id": "uuid-1", "sortOrder": 1 },
    { "id": "uuid-2", "sortOrder": 2 }
  ]
}
```

**响应：**

```json
{ "ok": true }
```
