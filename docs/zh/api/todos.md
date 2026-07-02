# 待办事项 API

所有端点需要身份验证和团队成员身份。权限按操作和字段逐一检查。权限解析使用与[权限](../guide/permissions#解析顺序)中描述的相同顺序。

---

## `GET /api/teams/:teamId/sets/:setId/todos`

列出分组中的所有待办事项，按 `sortOrder` 排序。包含子待办事项（通过非空的 `parentId` 标识）、评论数量以及当前用户对该分组的有效权限。

**需要身份验证：** 是 — 该分组的 `view_todos` 权限

**响应：**

```json
{
  "todos": [
    {
      "id": "uuid",
      "userId": "creator-uuid",
      "parentId": null,
      "title": "搭建 CI 流水线",
      "completed": false,
      "sortOrder": 1,
      "commentCount": 2,
      "assignees": [
        {
          "userId": "user-uuid",
          "name": "Ada Lovelace",
          "username": "ada",
          "avatarUrl": "https://example.com/a.png"
        }
      ],
      "createdAt": "2026-03-17T12:00:00.000Z",
      "updatedAt": "2026-03-17T14:30:00.000Z"
    },
    {
      "id": "uuid-sub",
      "userId": "creator-uuid",
      "parentId": "uuid",
      "title": "配置 GitHub Actions",
      "completed": true,
      "sortOrder": 1,
      "commentCount": 0,
      "assignees": [],
      "createdAt": "2026-03-17T13:00:00.000Z",
      "updatedAt": "2026-03-17T14:00:00.000Z"
    }
  ],
  "role": "owner",
  "permissions": {
    "create_todos": true,
    "edit_own_todos": true,
    "edit_any_todo": true,
    "delete_own_todos": true,
    "delete_any_todo": true,
    "complete_any_todo": true,
    "add_subtodos": true,
    "assign_todos": true,
    "reorder_todos": true,
    "comment": true,
    "delete_own_comments": true,
    "delete_any_comment": true,
    "view_todos": true
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `todos[].id` | string（UUID） | 唯一标识符。 |
| `todos[].userId` | string（UUID） | 创建该待办的用户 ID。 |
| `todos[].parentId` | string \| null | 子待办事项的父待办 UUID；顶级待办为 `null`。 |
| `todos[].title` | string | 待办事项文本内容。 |
| `todos[].completed` | boolean | 是否已标记完成。 |
| `todos[].sortOrder` | number | 列表内的整数排序位置（或在父项子列表中的位置）。 |
| `todos[].commentCount` | number | 附加到该待办的评论数量。 |
| `todos[].assignees` | array | 该待办的被分配人列表；未分配时为空数组。参见[分配](#put-api-teams-teamid-todos-id-assignees)。 |
| `todos[].assignees[].userId` | string (UUID) | 被分配人的用户 ID。 |
| `todos[].assignees[].name` | string \| null | 解析后的显示名称（来自 Prism）；否则为 `null`。 |
| `todos[].assignees[].username` | string \| null | 解析后的用户名；否则为 `null`。 |
| `todos[].assignees[].avatarUrl` | string \| null | 解析后的头像 URL；否则为 `null`。 |
| `todos[].createdAt` | string（ISO 8601） | 创建时间戳。 |
| `todos[].updatedAt` | string（ISO 8601） | 最后修改时间戳。 |
| `role` | string | 当前用户的团队角色。 |
| `permissions` | object | 该分组的解析后权限映射。前端用此决定显示哪些操作。 |

::: info
被分配人身份字段（`name` / `username` / `avatarUrl`）从 Prism 解析并缓存。对于个人空间，仅解析调用方自身的身份。
:::

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `401` | `"Unauthorized"` | 未登录。 |
| `403` | `"Forbidden"` | 不是成员，或该分组的 `view_todos` 权限已被撤销。 |
| `404` | `"Set not found"` | 该团队中不存在此 ID 的分组。 |

---

## `POST /api/teams/:teamId/sets/:setId/todos`

在分组中创建新的待办事项。传入 `parentId` 可在现有待办事项下创建子待办。

**需要身份验证：** 是 — `create_todos`（提供 `parentId` 时需要 `add_subtodos`）

**请求体：**

```json
{
  "title": "搭建 CI 流水线",
  "parentId": null
}
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | :---: | --- |
| `title` | string | 是 | 待办事项文本。不能为空。 |
| `parentId` | string \| null | 否 | 父待办事项的 UUID。必须引用同一分组中的待办事项。`null` 或省略 = 顶级待办。 |

**响应（201）：**

```json
{
  "todo": {
    "id": "new-uuid",
    "userId": "creator-uuid",
    "parentId": null,
    "title": "搭建 CI 流水线",
    "completed": false,
    "sortOrder": 5,
    "commentCount": 0,
    "assignees": [],
    "createdAt": "2026-03-17T12:00:00.000Z",
    "updatedAt": "2026-03-17T12:00:00.000Z"
  }
}
```

新待办事项放置在相应列表（顶级或子列表）的末尾。同时会向其他已连接的客户端广播 `todo:created` 事件（参见[实时同步](../guide/realtime)）。

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `400` | `"Title is required"` | `title` 缺失或为空。 |
| `404` | `"Set not found"` | 该团队中不存在目标分组。 |
| `404` | `"Parent todo not found"` | `parentId` 引用了该分组中不存在的待办事项。 |
| `403` | `"No permission: <key>"` | 缺少 `create_todos`（或子待办需要的 `add_subtodos`）权限。 |
| `409` | `"Todo item title already exists among sibling todos"` | 已有同级待办使用该标题。 |

---

## `PATCH /api/teams/:teamId/todos/:id`

更新待办事项的一个或多个字段。权限检查因字段和是否为自己的待办而异。

**需要身份验证：** 是 — 取决于字段（见下文）

**路径参数：**

| 参数 | 说明 |
| --- | --- |
| `id` | 要更新的待办事项 UUID。 |

**请求体**（所有字段均为可选——只有提供的字段才会被更新）：

```json
{
  "title": "更新后的标题",
  "completed": true,
  "sortOrder": 3
}
```

**按字段的权限要求：**

| 字段 | 自己的待办 | 他人的待办 |
| --- | --- | --- |
| `title` | `edit_own_todos` | `edit_any_todo` |
| `completed` | 始终允许 | `complete_any_todo` |
| `sortOrder` | `reorder_todos` | `reorder_todos` |

**响应：**

```json
{ "ok": true }
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `400` | `"Title is required"` | 提供了 `title` 但为空字符串。 |
| `403` | `"No permission to edit"` / `"No permission to toggle completion"` / `"No permission to reorder"` | 缺少所提供字段所需的权限。 |
| `404` | `"Not found"` | 该团队中不存在此 ID 的待办事项。 |
| `409` | `"Todo item title already exists among sibling todos"` | 新标题与同级待办冲突。 |

成功时会广播 `todo:updated` 事件。

---

## `DELETE /api/teams/:teamId/todos/:id`

删除待办事项及其所有子待办（级联删除）。待办事项和子待办上的评论也会一并删除。

**需要身份验证：** 是 — `delete_own_todos`（自己的）或 `delete_any_todo`（他人的）

::: warning
删除待办事项会永久移除它和所有嵌套的子待办及评论。没有撤销功能。
:::

**响应：**

```json
{ "ok": true }
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `403` | `"No permission to delete"` | 缺少所需的删除权限。 |
| `404` | `"Not found"` | 该团队中不存在此 ID 的待办事项。 |

成功时会广播 `todo:deleted` 事件。

---

## `POST /api/teams/:teamId/todos/reorder`

在一次请求中批量更新多个待办事项的 `sortOrder` 值。通常在前端拖拽排序后调用。

**需要身份验证：** 是 — `reorder_todos` 权限

**请求体：**

```json
{
  "items": [
    { "id": "uuid-1", "sortOrder": 1 },
    { "id": "uuid-2", "sortOrder": 2 },
    { "id": "uuid-3", "sortOrder": 3 }
  ],
  "setId": "set-uuid"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `items` | array | 每个位置发生变化的待办事项对应一个 `{id, sortOrder}` 对。 |
| `items[].id` | string（UUID） | 待办事项 ID。 |
| `items[].sortOrder` | number | 新的整数排序位置。 |
| `setId` | string（可选） | 正在重新排序的分组。提供时，会向该分组的已连接客户端广播 `todo:reordered` 事件。 |

**响应：**

```json
{ "ok": true }
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `400` | `"No items"` | `items` 数组缺失或为空。 |
| `403` | `"No permission to reorder"` | 缺少 `reorder_todos` 权限。 |

---

## `POST /api/teams/:teamId/todos/:id/move`

将一个待办事项（连同它的整个子待办子树）移动到另一个分组。移动后的待办会成为目标分组中的顶级（根）待办；其子孙待办会保持原有的父子关系。

**需要认证：** 是 —— 源分组的 `edit_own_todos`（自己的）或 `edit_any_todo`（他人的），**以及**目标分组的 `create_todos`。

**请求体：**

```json
{
  "targetSetId": "set-uuid",
  "insertAt": "bottom"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `targetSetId` | string (UUID) | 目标分组。 |
| `insertAt` | `"top"` \| `"bottom"`（可选） | 在目标分组的根待办中放置的位置。默认为 `"bottom"`。 |

**响应：**

```json
{ "ok": true }
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `400` | `"targetSetId is required"` | 缺少 `targetSetId`。 |
| `403` | `"No permission to move this todo"` / `"No permission to add todos to the target set"` | 缺少所需权限。 |
| `404` | `"Not found"` / `"Target set not found"` | 该待办或目标分组在此团队中不存在。 |
| `409` | `"Todo item title already exists among sibling todos"` | 目标分组中已存在同名的根待办。 |

成功时会向源分组和目标分组广播 `todo:moved` 事件。

---

## `PUT /api/teams/:teamId/todos/:id/assignees`

**整体替换**一个待办的被分配人集合。一个待办可以同时分配给多名团队成员。发送完整的
目标用户 ID 列表，服务端会与当前被分配人做差异比较。仅分配给自己时传
`{ "userIds": ["your-user-id"] }`；取消所有分配时传 `{ "userIds": [] }`。

此接口取代了旧的单人"认领"功能。已有的认领已迁移为分配给自己。

**需要身份验证：** 是 — 该分组的 `assign_todos` 权限

**路径参数：**

| 参数 | 说明 |
| --- | --- |
| `id` | 要（重新）分配的待办事项 UUID。 |

**请求体：**

```json
{ "userIds": ["user-uuid-1", "user-uuid-2"] }
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `userIds` | string[] | 完整的被分配人用户 ID 集合。非团队成员的 ID 会被忽略。 |

**响应：**

```json
{
  "ok": true,
  "assignees": [
    {
      "userId": "user-uuid-1",
      "name": "Ada Lovelace",
      "username": "ada",
      "avatarUrl": "https://example.com/a.png"
    }
  ]
}
```

会向已连接的客户端广播携带解析后 `assignees` 数组的 `todo:assigned` 事件。

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `403` | `"No permission to assign todos"` | 缺少 `assign_todos` 权限。 |
| `404` | `"Not found"` | 该团队中不存在此 ID 的待办事项。 |
| `503` | `"Assignment feature unavailable: database migration required"` | 缺少 `todo_assignees` 表 —— 请应用尚未执行的 D1 迁移。 |

---

## `GET /api/teams/:teamId/members`

列出当前工作区中待办可被分配的成员。个人空间仅返回调用方本人；团队空间从 Prism 解析。
供分配选择器使用。

**需要身份验证：** 是 — 团队成员身份。

**响应：**

```json
{
  "members": [
    {
      "userId": "user-uuid",
      "name": "Ada Lovelace",
      "username": "ada",
      "avatarUrl": "https://example.com/a.png"
    }
  ]
}
```

---

## `GET /api/teams/:teamId/assigned-to-me`

当前工作区中分配给调用方的未完成待办，按待办列表分组。用于置顶的**分配给我**分类。
已完成的待办不会返回（分配关系保留但隐藏）。

**需要身份验证：** 是 — 团队成员身份。

**响应：**

```json
{
  "groups": [
    {
      "setId": "set-uuid",
      "setName": "Sprint 12",
      "todos": [
        {
          "id": "todo-uuid",
          "setId": "set-uuid",
          "parentId": null,
          "title": "Set up CI pipeline",
          "completed": false,
          "createdAt": "2026-03-17T12:00:00.000Z",
          "updatedAt": "2026-03-17T14:30:00.000Z"
        }
      ]
    }
  ],
  "expand": { "set-uuid": false }
}
```

`expand` 将列表的 `setId` 映射到其在"分配给我"视图中持久化的展开 / 折叠状态。缺失表示
展开（默认）。

---

## `POST /api/teams/:teamId/assigned-expand`

持久化"分配给我"视图中某个列表的展开 / 折叠状态。为配合 `navigator.sendBeacon` 设计，
因此请求为尽力而为，始终返回 `{ "ok": true }`。

**需要身份验证：** 是 — 团队成员身份。

**请求体：**

```json
{ "setId": "set-uuid", "expanded": false }
```
