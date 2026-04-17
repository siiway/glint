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
| `todos[].createdAt` | string（ISO 8601） | 创建时间戳。 |
| `todos[].updatedAt` | string（ISO 8601） | 最后修改时间戳。 |
| `role` | string | 当前用户的团队角色。 |
| `permissions` | object | 该分组的解析后权限映射。前端用此决定显示哪些操作。 |

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
    "createdAt": "2026-03-17T12:00:00.000Z",
    "updatedAt": "2026-03-17T12:00:00.000Z"
  }
}
```

新待办事项放置在相应列表（顶级或子列表）的末尾。

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `400` | `"Title is required"` | `title` 缺失或为空。 |
| `400` | `"Parent not found"` | `parentId` 引用了该分组中不存在的待办事项。 |
| `403` | `"Forbidden"` | 缺少 `create_todos`（或子待办需要的 `add_subtodos`）权限。 |

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
| `400` | `"Title cannot be empty"` | 提供了 `title` 但为空字符串。 |
| `403` | `"Forbidden"` | 缺少所提供字段所需的权限。 |
| `404` | `"Todo not found"` | 该团队中不存在此 ID 的待办事项。 |

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
| `403` | `"Forbidden"` | 缺少所需的删除权限。 |
| `404` | `"Todo not found"` | 该团队中不存在此 ID 的待办事项。 |

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
  ]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `items` | array | 每个位置发生变化的待办事项对应一个 `{id, sortOrder}` 对。 |
| `items[].id` | string（UUID） | 待办事项 ID。 |
| `items[].sortOrder` | number | 新的整数排序位置。 |

**响应：**

```json
{ "ok": true }
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `400` | `"Items required"` | `items` 数组缺失或为空。 |
| `403` | `"Forbidden"` | 缺少 `reorder_todos` 权限。 |
