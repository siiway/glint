# 评论 API

按待办事项的线程评论。所有端点需要身份验证和团队成员身份。评论权限根据团队的权限配置进行检查。

---

## `GET /api/teams/:teamId/todos/:todoId/comments`

列出待办事项的所有评论，按 `createdAt` 升序排列（最早的在最前）。

**需要身份验证：** 是 — 团队成员且对该分组拥有 `view_todos` 权限

**路径参数：**

| 参数 | 说明 |
| --- | --- |
| `teamId` | 团队 UUID。 |
| `todoId` | 要获取评论的待办事项 UUID。 |

**响应：**

```json
{
  "comments": [
    {
      "id": "uuid",
      "userId": "user-uuid",
      "username": "alice",
      "displayName": "Alice Chen",
      "avatarUrl": "https://id.example.com/avatars/alice.png",
      "body": "看起来不错！",
      "createdAt": "2026-03-17T14:30:00.000Z"
    },
    {
      "id": "uuid-2",
      "userId": "user-uuid-2",
      "username": "bob",
      "displayName": "Bob Smith",
      "avatarUrl": "",
      "body": "我来处理部署。",
      "createdAt": "2026-03-17T15:00:00.000Z"
    }
  ]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `comments[].id` | string（UUID） | 评论唯一标识符。 |
| `comments[].userId` | string（UUID） | 评论作者的用户 ID。 |
| `comments[].username` | string | 作者在 Prism 中的用户名（登录名）。 |
| `comments[].displayName` | string | 作者的显示名称。可能为空。 |
| `comments[].avatarUrl` | string | 头像图片 URL。可能为空。由浏览器直接从 Prism 的 CDN 获取。 |
| `comments[].body` | string | 评论文本内容。 |
| `comments[].createdAt` | string（ISO 8601） | 评论发布时间戳。 |

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `401` | `"Unauthorized"` | 未登录。 |
| `403` | `"Forbidden"` | 不是成员，或该分组的 `view_todos` 权限已被撤销。 |
| `404` | `"Todo not found"` | 该团队中不存在此 ID 的待办事项。 |

---

## `POST /api/teams/:teamId/todos/:todoId/comments`

向待办事项添加新评论。

**需要身份验证：** 是 — `comment` 权限

**请求体：**

```json
{ "body": "看起来不错！" }
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | :---: | --- |
| `body` | string | 是 | 评论文本。不能为空。 |

**响应（201）：**

```json
{
  "comment": {
    "id": "new-uuid",
    "userId": "user-uuid",
    "username": "alice",
    "displayName": "Alice Chen",
    "avatarUrl": "https://id.example.com/avatars/alice.png",
    "body": "看起来不错！",
    "createdAt": "2026-03-17T14:30:00.000Z"
  }
}
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `400` | `"Body is required"` | `body` 缺失或为空。 |
| `403` | `"Forbidden"` | 缺少 `comment` 权限。 |
| `404` | `"Todo not found"` | 该团队中不存在此 ID 的待办事项。 |

---

## `DELETE /api/teams/:teamId/todos/:todoId/comments/:commentId`

删除评论。你始终可以删除自己的评论；删除他人的评论需要 `delete_any_comment` 权限。

**需要身份验证：** 是 — `delete_own_comments`（自己的评论）或 `delete_any_comment`（他人的评论）

**路径参数：**

| 参数 | 说明 |
| --- | --- |
| `commentId` | 要删除的评论 UUID。 |

**响应：**

```json
{ "ok": true }
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `403` | `"Forbidden"` | 评论属于他人且缺少 `delete_any_comment` 权限。 |
| `404` | `"Comment not found"` | 该待办事项上不存在此 ID 的评论。 |
