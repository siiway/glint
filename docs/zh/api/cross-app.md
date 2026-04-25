# 跨应用 API

供外部应用使用的 Bearer Token 认证接口。所有请求必须在 `Authorization: Bearer <token>` 头中携带一个通过 Prism OAuth 流程颁发、并包含所需跨应用 scope 的 access token。

详细的集成流程请参阅[跨应用集成](/zh/guide/cross-app)。

## 认证方式

每个请求都必须携带有效的 Prism access token：

```http
Authorization: Bearer <access_token>
```

Glint 通过调用 Prism 的 introspect 接口（`/api/oauth/introspect`）验证 Token。Token 必须满足：

1. **有效（active）** — 未过期且未被撤销
2. **包含所需 scope** — 必须包含 `app:<glint_client_id>:<required_scope>`

验证 Token 后，Glint 将通过 KV 缓存（用户曾登录 Glint）或实时 Prism 请求（Token 包含 `teams:read`）解析用户的团队成员关系。

### Scope 与接口映射

::: tip 在 Prism 中注册这些 scope
[跨应用集成指南](/zh/guide/cross-app#一键导入到-prism) 提供了所有 scope 定义的可复制 JSON，直接粘贴到 Prism 的 **Import** 对话框即可（Glint 应用 → Permissions → Import）。
:::

| Scope             | 可访问的接口                                                    |
| ----------------- | --------------------------------------------------------------- |
| `read_todos`      | `GET /api/cross-app/teams/:teamId/sets`                         |
|                   | `GET /api/cross-app/teams/:teamId/sets/:setId/todos`            |
|                   | `GET /api/cross-app/teams/:teamId/todos/:todoId/comments`       |
|                   | `GET /api/cross-app/teams/:teamId/sets/:setId/export`           |
| `create_todos`    | `POST /api/cross-app/teams/:teamId/sets/:setId/todos`           |
|                   | `POST /api/cross-app/teams/:teamId/sets/:setId/import`（追加模式）|
| `edit_todos`      | `PATCH /api/cross-app/teams/:teamId/todos/:todoId`（仅 title）  |
| `complete_todos`  | `PATCH /api/cross-app/teams/:teamId/todos/:todoId`（仅 completed）|
| `delete_todos`    | `DELETE /api/cross-app/teams/:teamId/todos/:todoId`             |
| `reorder_todos`   | `POST /api/cross-app/teams/:teamId/todos/reorder`               |
| `claim_todos`     | `POST /api/cross-app/teams/:teamId/todos/:todoId/claim`         |
| `manage_sets`     | `POST /api/cross-app/teams/:teamId/sets`                        |
|                   | `PATCH /api/cross-app/teams/:teamId/sets/:setId`（含自动续期、时区、分隔已完成）|
|                   | `DELETE /api/cross-app/teams/:teamId/sets/:setId`               |
|                   | `POST /api/cross-app/teams/:teamId/sets/reorder`                |
|                   | `POST /api/cross-app/teams/:teamId/sets/import`（导入为新分组） |
|                   | `POST /api/cross-app/teams/:teamId/sets/:setId/import` 且 `mode: "replace"`（同时还需 `create_todos`） |
| `comment`         | `POST /api/cross-app/teams/:teamId/todos/:todoId/comments`      |
| `delete_comments` | `DELETE /api/cross-app/teams/:teamId/todos/:todoId/comments/:commentId` |
| `read_settings`   | `GET /api/cross-app/teams/:teamId/settings`                     |
| `manage_settings` | `PATCH /api/cross-app/teams/:teamId/settings`                   |
| `write_todos`     | 旧版兼容范围：可作为 `create_todos`、`edit_todos`、`complete_todos` 任意之一使用 |

---

## `GET /api/cross-app/teams/:teamId/sets`

列出团队中的所有待办分组。

**所需 scope：** `read_todos`

**路径参数：**

| 参数       | 说明              |
| ---------- | ----------------- |
| `teamId`   | Prism 团队 ID     |

**响应 `200`：**

```json
{
  "sets": [
    {
      "id": "uuid",
      "userId": "user_id_of_creator",
      "name": "Sprint 12",
      "sortOrder": 1,
      "autoRenew": false,
      "renewTime": "00:00",
      "timezone": "",
      "lastRenewedAt": null,
      "splitCompleted": false,
      "createdAt": "2026-04-17T09:00:00.000Z"
    }
  ]
}
```

**错误：**

| 状态码 | 原因                                                                               |
| ------ | ---------------------------------------------------------------------------------- |
| `401`  | Bearer Token 缺失、格式错误或已过期                                                |
| `403`  | Token 缺少 `app:<glint_id>:read_todos` scope                                      |
| `403`  | 用户不是 `teamId` 团队的成员                                                       |
| `403`  | 无法获取团队成员关系——请在 scope 中包含 `teams:read`，或让用户先登录 Glint 一次   |

---

## `GET /api/cross-app/teams/:teamId/sets/:setId/todos`

列出某个待办分组中的所有待办事项。遵循用户的 `view_todos` 权限。

**所需 scope：** `read_todos`

**路径参数：**

| 参数       | 说明              |
| ---------- | ----------------- |
| `teamId`   | Prism 团队 ID     |
| `setId`    | 待办分组 ID       |

**响应 `200`：**

```json
{
  "todos": [
    {
      "id": "uuid",
      "userId": "user_id_of_creator",
      "parentId": null,
      "title": "编写单元测试",
      "completed": false,
      "sortOrder": 1,
      "commentCount": 2,
      "claimedBy": "user_id_or_null",
      "claimedByName": "显示名称",
      "claimedByAvatar": "https://example.com/a.png",
      "createdAt": "2026-04-01T10:00:00.000Z",
      "updatedAt": "2026-04-01T10:00:00.000Z"
    },
    {
      "id": "uuid-2",
      "userId": "user_id_of_creator",
      "parentId": "uuid",
      "title": "覆盖边界情况",
      "completed": true,
      "sortOrder": 1,
      "commentCount": 0,
      "claimedBy": null,
      "claimedByName": null,
      "claimedByAvatar": null,
      "createdAt": "2026-04-01T10:05:00.000Z",
      "updatedAt": "2026-04-02T08:00:00.000Z"
    }
  ]
}
```

返回的待办列表是扁平结构。子待办的 `parentId` 指向其父待办。`claimedByName` / `claimedByAvatar` 在团队空间中通过 Prism 解析；个人空间下仅解析当前调用者。

**错误：**

| 状态码 | 原因                                               |
| ------ | -------------------------------------------------- |
| `401`  | Token 缺失或无效                                   |
| `403`  | scope 或团队成员关系不足                           |
| `403`  | 用户对该分组的 `view_todos` 权限被拒绝             |
| `404`  | 待办分组不存在或不属于 `teamId`                    |

---

## `POST /api/cross-app/teams/:teamId/sets/:setId/todos`

在某个待办分组中创建新的待办事项。遵循用户的 `create_todos` 权限。

**所需 scope：** `write_todos`

**路径参数：**

| 参数       | 说明              |
| ---------- | ----------------- |
| `teamId`   | Prism 团队 ID     |
| `setId`    | 待办分组 ID       |

**请求体：**

```json
{
  "title": "编写文档",
  "parentId": "可选的父待办 UUID"
}
```

| 字段       | 类型   | 必填 | 说明                                   |
| ---------- | ------ | ---- | -------------------------------------- |
| `title`    | string | 是   | 待办标题，首尾空白字符会被自动去除     |
| `parentId` | string | 否   | 父待办 ID，用于创建子待办              |

**响应 `201`：**

```json
{
  "todo": {
    "id": "uuid",
    "parentId": null,
    "title": "编写文档",
    "completed": false,
    "sortOrder": 5,
    "createdAt": "2026-04-17T09:00:00.000Z",
    "updatedAt": "2026-04-17T09:00:00.000Z"
  }
}
```

**错误：**

| 状态码 | 原因                                                          |
| ------ | ------------------------------------------------------------- |
| `400`  | `title` 缺失或为空                                            |
| `401`  | Token 缺失或无效                                              |
| `403`  | scope 不足、团队成员关系不足，或 `create_todos` 权限被拒绝   |
| `404`  | 待办分组不存在或不属于 `teamId`                               |

---

## `PATCH /api/cross-app/teams/:teamId/todos/:todoId`

更新待办的标题或完成状态。权限检查规则与 Glint 常规 API 保持一致：

- 更新 `title`：本人待办需要 `edit_own_todos`，他人待办需要 `edit_any_todo`
- 更新 `completed`：本人待办无额外权限要求；他人待办需要 `complete_any_todo`

**所需 scope：** `write_todos`

**路径参数：**

| 参数       | 说明              |
| ---------- | ----------------- |
| `teamId`   | Prism 团队 ID     |
| `todoId`   | 待办事项 ID       |

**请求体（所有字段均为可选）：**

```json
{
  "title": "更新后的标题",
  "completed": true
}
```

至少需要提供一个字段。

**响应 `200`：**

```json
{ "ok": true }
```

**错误：**

| 状态码 | 原因                                                              |
| ------ | ----------------------------------------------------------------- |
| `401`  | Token 缺失或无效                                                  |
| `403`  | scope 不足、团队成员关系不足，或编辑/完成权限被拒绝               |
| `404`  | 待办事项不存在或不属于 `teamId`                                   |

---

## `DELETE /api/cross-app/teams/:teamId/todos/:todoId`

删除待办事项，同时级联删除其子待办。本人待办需要 `delete_own_todos`，他人待办需要 `delete_any_todo`。

**所需 scope：** `delete_todos`

**路径参数：**

| 参数       | 说明              |
| ---------- | ----------------- |
| `teamId`   | Prism 团队 ID     |
| `todoId`   | 待办事项 ID       |

**响应 `200`：**

```json
{ "ok": true }
```

**错误：**

| 状态码 | 原因                                                      |
| ------ | --------------------------------------------------------- |
| `401`  | Token 缺失或无效                                          |
| `403`  | scope 不足、团队成员关系不足，或删除权限被拒绝            |
| `404`  | 待办事项不存在或不属于 `teamId`                           |

---

## 通用错误格式

所有错误均返回 JSON：

```json
{ "error": "人类可读的描述信息" }
```

`403` 的具体错误信息包括：

| 错误信息片段                                           | 含义                                                  |
| ------------------------------------------------------ | ----------------------------------------------------- |
| `"Token inactive or expired"`                          | Introspect 返回 `active: false`                       |
| `"Missing required scope: app:..."`                    | Token 有效但缺少所需的跨应用 scope                    |
| `"Not a member of this team"`                          | 用户不在所请求的团队中                                |
| `"Team membership unavailable"`                        | KV 缓存未命中且 Token scope 中无 `teams:read`         |
| `"No permission to view todos"`                        | 用户对该分组的 `view_todos` 权限已关闭                |
| `"No permission to create todos"`                      | 用户的 `create_todos` 权限已关闭                      |
| `"No permission to edit this todo"`                    | 缺少 `edit_own_todos` 或 `edit_any_todo`              |
| `"No permission to delete this todo"`                  | 缺少 `delete_own_todos` 或 `delete_any_todo`          |
