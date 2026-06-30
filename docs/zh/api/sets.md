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
      "autoRenew": false,
      "renewTime": "00:00",
      "timezone": "",
      "lastRenewedAt": null,
      "splitCompleted": false,
      "createdAt": "2026-03-17T12:00:00.000Z",
      "total": 8,
      "completed": 3,
      "pending": 5
    },
    {
      "id": "uuid-2",
      "userId": "creator-uuid",
      "name": "待办事项池",
      "sortOrder": 2,
      "autoRenew": true,
      "renewTime": "06:00",
      "timezone": "Asia/Shanghai",
      "lastRenewedAt": "2026-03-18T22:00:00.000Z",
      "splitCompleted": true,
      "createdAt": "2026-03-18T09:00:00.000Z",
      "total": 12,
      "completed": 12,
      "pending": 0
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
| `sets[].autoRenew` | boolean | 为 `true` 时，分组内所有已完成的待办事项每天重置为未完成。参见[自动续期](#auto-renew)。 |
| `sets[].renewTime` | string | 自动续期运行的本地时间，格式为 `HH:MM`（24 小时制）。 |
| `sets[].timezone` | string | 用于解析 `renewTime` 的 IANA 时区名称。空字符串时回退到团队的 `default_timezone`。 |
| `sets[].lastRenewedAt` | string \| null | 最近一次成功自动续期的 ISO 8601 时间戳；若从未运行则为 `null`。 |
| `sets[].splitCompleted` | boolean | 为 `true` 时，已完成的待办事项显示在单独的折叠区域中。 |
| `sets[].createdAt` | string（ISO 8601） | 创建时间戳。 |
| `sets[].total` | number | 分组内顶层待办事项的数量。 |
| `sets[].completed` | number | 已完成的顶层待办事项数量。 |
| `sets[].pending` | number | 未完成的顶层待办事项数量（`total - completed`）。 |
| `role` | string | 当前用户的角色：`"owner"`、`"co-owner"`、`"admin"` 或 `"member"`。 |

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
    "autoRenew": false,
    "renewTime": "00:00",
    "timezone": "",
    "lastRenewedAt": null,
    "splitCompleted": false,
    "createdAt": "2026-03-17T12:00:00.000Z"
  }
}
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `400` | `"Name is required"` | `name` 缺失或为空。 |
| `403` | `"No permission to manage sets"` | 缺少 `manage_sets` 权限。 |
| `409` | `"Todo list name already exists in this team"` | 团队中已有其他分组使用该名称。 |

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
  "autoRenew": true,
  "renewTime": "06:00",
  "timezone": "Asia/Shanghai",
  "splitCompleted": true
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `name` | string | 新的显示名称。若提供，不能为空。 |
| `autoRenew` | boolean | 启用 / 禁用每日自动续期已完成的待办事项。参见[自动续期](#auto-renew)。 |
| `renewTime` | string | 自动续期运行的本地时间，格式为 `HH:MM`（24 小时制）。 |
| `timezone` | string | IANA 时区名称（如 `Asia/Shanghai`）。空字符串时回退到团队的 `default_timezone`。 |
| `splitCompleted` | boolean | 启用 / 禁用该分组的分离已完成待办布局。 |

**响应：**

```json
{ "ok": true }
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `400` | `"Name is required"` | 提供了 `name` 但为空字符串。 |
| `400` | `"No updates"` | 未提供任何可识别的字段。 |
| `403` | `"No permission to manage sets"` | 缺少 `manage_sets` 权限且不是该分组的创建者。 |
| `409` | `"Todo list name already exists in this team"` | 团队中已有其他分组使用该新名称。 |
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
| `400` | `"No items"` | `items` 缺失或为空数组。 |
| `403` | `"No permission to manage sets"` | 缺少 `manage_sets` 权限。 |

---

## `GET /api/teams/:teamId/sets/:setId/export`

将分组的待办事项导出为 Markdown、JSON 或 YAML。响应在序列化内容之外还包含建议的文件名。

**需要身份验证：** 是 — 该分组的 `view_todos` 权限

**查询参数：**

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `format` | `md` | 输出格式：`md`、`json` 或 `yaml`。 |
| `includeComments` | `0` | 设为 `1` 时在导出中嵌入每个待办事项的评论。 |

**响应：**

```json
{
  "format": "md",
  "fileName": "Sprint_12.md",
  "content": "- [x] First todo\n- [ ] Second todo"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `format` | string | 解析后的文件扩展名（`md`、`json` 或 `yaml`）。 |
| `fileName` | string | 建议的下载文件名，由分组名称派生。 |
| `content` | string | 序列化后的导出内容。 |

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `403` | `"No permission to export this set"` | 缺少该分组的 `view_todos` 权限。 |
| `404` | `"Set not found"` | 该团队中不存在此 ID 的分组。 |

---

## `POST /api/teams/:teamId/sets/:setId/import`

将待办事项导入到一个**已有**分组中，可以追加到或替换其当前内容。

**需要身份验证：** 是 — 该分组的 `create_todos` 权限（`replace` 模式额外需要 `manage_sets`）

**请求体：**

```json
{
  "format": "md",
  "content": "- [ ] Todo A\n- [ ] Todo B",
  "mode": "append",
  "includeComments": false,
  "insertAt": "bottom"
}
```

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `format` | string | `"md"` | `md`、`json` 或 `yaml`。 |
| `content` | string | — | 要导入的序列化内容。不能为空。 |
| `mode` | string | `"append"` | `"append"` 保留已有待办事项；`"replace"` 先删除它们（需要 `manage_sets`）。 |
| `includeComments` | boolean | `false` | 导入内容中嵌入的所有评论。 |
| `insertAt` | string | `"bottom"` | `"top"` 或 `"bottom"` —— 追加的待办事项放置的位置。 |

**响应：**

```json
{ "ok": true, "imported": 2 }
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `400` | `"Content is required"` | `content` 缺失或为空。 |
| `400` | `"Failed to parse import content"` | 无法按给定的 `format` 解析内容。 |
| `403` | `"No permission to import into this set"` | 缺少 `create_todos` 权限。 |
| `403` | `"No permission to replace set content"` | `mode: "replace"` 但缺少 `manage_sets` 权限。 |
| `409` | `"Todo item title already exists among sibling todos: <title>"` | 会在同级待办中产生重复标题。 |

---

## `POST /api/teams/:teamId/sets/import`

将内容作为团队中一个**全新**分组导入。

**需要身份验证：** 是 — `manage_sets` 权限

**请求体：**

```json
{
  "format": "yaml",
  "content": "version: 1\nset:\n  id: my-set-id\n  name: Imported\ntodos: []",
  "includeComments": false,
  "setName": "Optional name override",
  "setId": "optional-id-override"
}
```

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `format` | string | `"md"` | `md`、`json` 或 `yaml`。 |
| `content` | string | — | 要导入的序列化内容。不能为空。 |
| `includeComments` | boolean | `false` | 导入内容中嵌入的评论。 |
| `setName` | string | 来自内容 | 覆盖分组名称。Markdown 导入默认为 `"Imported Set"`。 |
| `setId` | string | 来自内容 | 覆盖分组 ID（仅限 JSON/YAML；Markdown 始终生成新 ID）。 |

**响应（201）：**

```json
{
  "ok": true,
  "imported": 0,
  "set": {
    "id": "uuid",
    "userId": "creator-uuid",
    "name": "Imported",
    "sortOrder": 4,
    "autoRenew": false,
    "renewTime": "00:00",
    "timezone": "",
    "lastRenewedAt": null,
    "splitCompleted": false,
    "createdAt": "2026-03-17T12:00:00.000Z"
  }
}
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `400` | `"Content is required"` | `content` 缺失或为空。 |
| `400` | `"Failed to parse import content"` | 无法解析内容。 |
| `403` | `"No permission to manage sets"` | 缺少 `manage_sets` 权限。 |
| `409` | `"Todo list name already exists in this team"` | 目标分组名称已被使用。 |
| `409` | `"Set id already exists"` | 提供的 `setId` 在该团队中已存在。 |

---

## 自动续期 {#auto-renew}

当分组启用了 `autoRenew` 时，一个定时的 Cloudflare cron 任务（每 15 分钟运行一次）会每天一次将分组内所有已完成的待办事项重置为未完成。这对于每日站会或日常例行等周期性清单非常有用。

在分组的有效时区下，续期会在满足以下条件时触发：

- 当前本地时间达到或超过 `renewTime`，**并且**
- 该分组在当前本地日期尚未续期。

有效时区为分组自身的 `timezone`，若为空则使用团队的 `default_timezone`（参见[团队设置](./settings)）。续期后会更新分组的 `lastRenewedAt`，以防止同一天再次运行。
