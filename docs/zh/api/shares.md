# 分享链接 API

分享链接通过一个公开、不可猜测的 URL 将单个待办分组暴露给团队**外部**的人——无需 Prism 账号。每个链接都携带自己的精细能力（查看、创建、编辑、完成、删除、评论、重排序）以及可选的邮箱允许列表。链接还可生成只读的**徽章**和**待办清单** SVG，便于嵌入 README 和仪表盘。

分享链接管理端点需要已认证会话和 `manage_set_links` 权限。`/api/shared/:token` 下的公开端点无需会话——访问完全由令牌和链接的能力控制。

---

## 链接对象

```json
{
  "id": "link-uuid",
  "setId": "set-uuid",
  "setName": "Sprint 12",
  "token": "32charhextoken",
  "name": "Public roadmap",
  "canView": true,
  "canCreate": false,
  "canEdit": false,
  "canComplete": false,
  "canDelete": false,
  "canComment": false,
  "canReorder": false,
  "allowedEmails": "",
  "createdBy": "creator-user-id",
  "createdAt": "2026-06-01T10:00:00.000Z"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string（UUID） | 链接的内部标识符（用于更新/删除）。 |
| `setId` | string（UUID） | 该链接暴露的分组。 |
| `setName` | string | 分组名称。仅团队级列表端点会返回。 |
| `token` | string | 公开的、URL 安全的令牌。用于 `/api/shared/:token`。 |
| `name` | string | 链接的可读标签。 |
| `canView` | boolean | 允许读取分组及其待办事项。默认值为 `true`。 |
| `canCreate` | boolean | 允许通过公开 API 创建待办事项。 |
| `canEdit` | boolean | 允许编辑待办事项标题。 |
| `canComplete` | boolean | 允许切换完成状态。 |
| `canDelete` | boolean | 允许删除待办事项。 |
| `canComment` | boolean | 为未来的公开评论功能保留。 |
| `canReorder` | boolean | 允许重新排序待办事项。 |
| `allowedEmails` | string | 逗号分隔的邮箱允许列表。为空 = 不限制。 |
| `createdBy` | string（UUID） | 创建该链接的用户。 |
| `createdAt` | string（ISO 8601） | 创建时间戳。 |

---

## `GET /api/teams/:teamId/sets/:setId/share-links`

列出某个特定分组的所有分享链接。

**需要身份验证：** 是 — 团队成员

**响应：**

```json
{ "links": [ /* 链接对象 */ ] }
```

---

## `GET /api/teams/:teamId/share-links`

列出团队中**所有**分组的分享链接，每条都附带其 `setName`。供团队级管理面板使用。

**需要身份验证：** 是 — 团队成员

**响应：**

```json
{ "links": [ /* 链接对象，每条都带 setName */ ] }
```

---

## `POST /api/teams/:teamId/sets/:setId/share-links`

为分组创建新的分享链接。`token` 由服务端随机生成。

**需要身份验证：** 是 — `manage_set_links` 权限

**请求体**（所有字段均为可选）：

```json
{
  "name": "Public roadmap",
  "canView": true,
  "canCreate": false,
  "canEdit": false,
  "canComplete": false,
  "canDelete": false,
  "canComment": false,
  "canReorder": false,
  "allowedEmails": "alice@example.com, bob@example.com"
}
```

`canView` 默认为 `true`；其他所有能力默认为 `false`。`allowedEmails` 是逗号分隔的列表——非空时，公开请求必须提供匹配的 `email`。

**响应（201）：**

```json
{ "link": { /* 链接对象 */ } }
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `403` | `"No permission to manage set links"` | 缺少 `manage_set_links` 权限。 |

---

## `PATCH /api/teams/:teamId/share-links/:linkId`

更新链接的名称、能力或邮箱允许列表。仅更新提供的字段。

**需要身份验证：** 是 — `manage_set_links` 权限

**请求体**（所有字段均为可选）：与创建相同的结构。

**响应：**

```json
{ "ok": true }
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `400` | `"No updates"` | 未提供任何可识别的字段。 |
| `403` | `"No permission to manage set links"` | 缺少 `manage_set_links` 权限。 |

---

## `DELETE /api/teams/:teamId/share-links/:linkId`

永久删除分享链接。令牌立即失效；底层分组和待办事项不受影响。

**需要身份验证：** 是 — `manage_set_links` 权限

**响应：**

```json
{ "ok": true }
```

---

## 公开端点

以下端点**无需会话**。授权由 `token` 和链接的能力标志决定。当链接设置了 `allowedEmails` 限制时，调用方必须传入匹配的 `email`（`GET`/`DELETE` 作为查询参数，`POST`/`PATCH` 放在 JSON 请求体中）。

### `GET /api/shared/:token`

获取分享的分组、其待办事项以及该链接授予的能力。

**查询参数：**

| 参数 | 说明 |
| --- | --- |
| `email` | 仅当链接设置了邮箱允许列表时必填。 |

**响应：**

```json
{
  "set": { "id": "set-uuid", "name": "Sprint 12" },
  "permissions": {
    "canView": true,
    "canCreate": false,
    "canEdit": false,
    "canComplete": false,
    "canDelete": false,
    "canComment": false,
    "canReorder": false
  },
  "requiresEmail": false,
  "todos": [
    {
      "id": "uuid",
      "userId": "creator-uuid",
      "parentId": null,
      "title": "First todo",
      "completed": false,
      "sortOrder": 1,
      "commentCount": 0,
      "claimedBy": null,
      "claimedByName": null,
      "claimedByAvatar": null,
      "createdAt": "2026-06-01T10:00:00.000Z",
      "updatedAt": "2026-06-01T10:00:00.000Z"
    }
  ]
}
```

当链接受邮箱限制时，`requiresEmail` 为 `true`，提示公开页面在授予访问前先要求输入邮箱。

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `403` | `"Access denied"`（`requiresEmail: true`） | 邮箱限制生效但未提供 / 提供了无效邮箱。 |
| `404` | `"Share link not found"` | 未知令牌。 |
| `404` | `"Set not found"` | 底层分组已被删除。 |

---

### `POST /api/shared/:token/todos`

通过链接创建待办事项。需要 `canCreate`。

**请求体：**

```json
{ "title": "New todo", "parentId": null, "email": "alice@example.com" }
```

公开创建的待办事项以合成用户 ID `"shared"` 存储。

**响应（201）：** `{ "todo": { /* 待办事项对象 */ } }`

**错误响应：** `400` 标题为空；`403` `"Access denied"` 或 `"This link does not allow creating todos"`；`404` 链接或父项未找到；`409` 同级标题重复。

---

### `PATCH /api/shared/:token/todos/:id`

更新待办事项的 `title`、`completed` 或 `sortOrder`。每个字段需要相应的能力（`canEdit`、`canComplete`、`canReorder`）。

**请求体：**

```json
{ "completed": true, "email": "alice@example.com" }
```

**响应：** `{ "ok": true }`

**错误响应：** `400` 标题为空；`403` `"Access denied"` 或针对被禁止字段的 `"This link does not allow ..."` 消息；`404` 链接或待办事项未找到；`409` 同级标题重复。

---

### `DELETE /api/shared/:token/todos/:id`

删除待办事项。需要 `canDelete`。

**查询参数：** `email`（当链接受邮箱限制时）。

**响应：** `{ "ok": true }`

**错误响应：** `403` `"Access denied"` 或 `"This link does not allow deleting"`；`404` 链接或待办事项未找到。

---

### `POST /api/shared/:token/todos/reorder`

批量更新排序。需要 `canReorder`。

**请求体：**

```json
{
  "items": [
    { "id": "uuid-1", "sortOrder": 1 },
    { "id": "uuid-2", "sortOrder": 2 }
  ],
  "email": "alice@example.com"
}
```

**响应：** `{ "ok": true }`

**错误响应：** `400` `items` 为空；`403` `"Access denied"` 或 `"This link does not allow reordering"`；`404` 链接未找到。

---

## 可嵌入的 SVG {#embeddable-svgs}

这些端点直接渲染图片（`Content-Type: image/svg+xml`），并缓存 60 秒。它们始终是只读的，忽略能力标志和邮箱限制——任何持有令牌的人都能渲染它们。

### `GET /api/shared/:token/badge.svg`

一个 shields.io 风格的进度徽章，显示 `completed/total`。

**查询参数：**

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `style` | `flat` | `flat` 或 `flat-square`。 |
| `label` | 分组名称 | 左侧标签文字。 |
| `message` | `done/total` | 右侧消息文字。 |
| `color` | 自动（按进度） | 右侧背景色。 |
| `labelColor` | `#555` | 左侧背景色。 |

对于未知令牌或已删除的分组，返回 `404` 徽章（"not found"）。

### `GET /api/shared/:token/todo-list.svg`

将分组的待办事项渲染为清单图片，遵循分组的分离已完成排序和子待办嵌套。

**查询参数：**

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `theme` | `light` | `light` 或 `dark`。 |
| `title` | 分组名称 | 标题文字（传空可隐藏）。 |
| `width` | 自动 | 宽度（px），限制在 `200`–`1000`。 |
| `fontSize` | 自动 | 字号（px），限制在 `10`–`24`。 |
| `maxItems` | 全部 | 最大行数，限制在 `1`–`100`。 |
| `showProgress` | `true` | 设为 `false` 可隐藏进度摘要。 |
| `bgColor` | 主题 | 覆盖背景色。 |
| `textColor` | 主题 | 覆盖文字颜色。 |
| `checkColor` | 主题 | 覆盖复选框/对勾颜色。 |
| `borderColor` | 主题 | 覆盖边框颜色。 |

---

UI 操作流程和嵌入示例参见[分享链接指南](../guide/shares)。
