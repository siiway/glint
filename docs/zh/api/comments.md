# 评论 API

按待办事项的评论。所有端点需要身份验证和团队成员身份。

## `GET /api/teams/:teamId/todos/:todoId/comments`

列出某个待办事项的评论，按创建时间排序。

**响应：**

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

添加评论。需要 `comment` 权限。

**请求体：**

```json
{ "body": "Looks good!" }
```

**响应（201）：**

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

删除评论。需要 `delete_own_comments`（自己的）或 `delete_any_comment`（他人的）权限。

**响应：**

```json
{ "ok": true }
```
