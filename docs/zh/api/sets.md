# 待办分组 API

待办分组是团队工作区内用于组织待办事项的容器。所有端点需要身份验证和团队成员身份。权限按操作逐一检查。

---

## `GET /api/teams/:teamId/sets`

列出团队的所有分组，按 `sortOrder` 升序排列。若不存在任何分组，会在返回前自动创建一个默认分组。

**需要身份验证：** 是 — 团队成员

**响应：**

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
      "name": "待办事项池",
      "sortOrder": 2,
      "splitCompleted": true,
      "createdAt": "2026-03-18T09:00:00.000Z"
    }
  ],
  "role": "owner"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sets[].id` | string（UUID） | 分组唯一标识符。 |
| `sets[].userId` | string（UUID） | 创建该分组的用户 ID。 |
| `sets[].name` | string | 显示名称。 |
| `sets[].sortOrder` | number | 整数排序位置（数值越小，在列表中越靠上）。 |
| `sets[].splitCompleted` | boolean | 为 `true` 时，已完成的待办事项显示在单独的折叠区域中。 |
| `sets[].createdAt` | string（ISO 8601） | 创建时间戳。 |
| `role` | string | 当前用户的角色：`"owner"`、`"co_owner"`、`"admin"` 或 `"member"`。 |

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `401` | `"Unauthorized"` | 未登录。 |
| `403` | `"Forbidden"` | 不是该团队的成员。 |

---

## `POST /api/teams/:teamId/sets`

创建新分组。新分组附加在列表末尾（最高 `sortOrder + 1`）。

**需要身份验证：** 是 — `manage_sets` 权限

**请求体：**

```json
{ "name": "Sprint 12" }
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | :---: | --- |
| `name` | string | 是 | 新分组的显示名称。不能为空。 |

**响应（201）：**

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

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `400` | `"Name is required"` | `name` 缺失或为空。 |
| `403` | `"Forbidden"` | 缺少 `manage_sets` 权限。 |

---

## `PATCH /api/teams/:teamId/sets/:setId`

更新分组的名称或选项。仅更新提供的字段。

**需要身份验证：** 是 — `manage_sets` 权限，或当前用户为该分组的创建者

**路径参数：**

| 参数 | 说明 |
| --- | --- |
| `setId` | 要更新的分组的 UUID。 |

**请求体**（所有字段均为可选）：

```json
{
  "name": "Sprint 13",
  "splitCompleted": true
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | 新的显示名称。若提供，不能为空。 |
| `splitCompleted` | boolean | 启用 / 禁用该分组的分离已完成待办布局。 |

**响应：**

```json
{ "ok": true }
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `400` | `"Name cannot be empty"` | 提供了 `name` 但为空字符串。 |
| `403` | `"Forbidden"` | 缺少 `manage_sets` 权限且不是该分组的创建者。 |
| `404` | `"Set not found"` | 该团队中不存在此 ID 的分组。 |

---

## `DELETE /api/teams/:teamId/sets/:setId`

删除分组及其**所有**待办事项、子待办和评论（级联删除）。

**需要身份验证：** 是 — `manage_sets` 权限，或当前用户为该分组的创建者

::: warning
此操作是永久性的。分组内的所有待办事项、子待办和评论会立即删除。没有回收站或撤销功能。
:::

**响应：**

```json
{ "ok": true }
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `403` | `"Forbidden"` | 缺少 `manage_sets` 权限且不是该分组的创建者。 |
| `404` | `"Set not found"` | 该团队中不存在此 ID 的分组。 |

---

## `POST /api/teams/:teamId/sets/reorder`

在一次请求中批量更新多个分组的 `sortOrder`。调用方需提供连续的整数（例如 1、2、3）。

**需要身份验证：** 是 — `manage_sets` 权限

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
| `items` | array | `{id, sortOrder}` 对象列表。所有需要新位置的分组都应包含在内。 |
| `items[].id` | string（UUID） | 要更新的分组 ID。 |
| `items[].sortOrder` | number | 新的排序位置（整数）。 |

**响应：**

```json
{ "ok": true }
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `400` | `"Items required"` | `items` 缺失或为空数组。 |
| `403` | `"Forbidden"` | 缺少 `manage_sets` 权限。 |
