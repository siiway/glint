# 权限 API

团队的精细权限管理。权限覆盖存储在 D1 中，支持全局（团队范围）和按分组两种作用域。

所有端点需要身份验证和团队成员身份。

---

## 权限键说明

所有有效权限键的完整列表：

| 键 | 管理员默认 | 成员默认 |
| --- | :---: | :---: |
| `manage_settings` | `false` | `false` |
| `manage_permissions` | `false` | `false` |
| `manage_sets` | `true` | `false` |
| `create_todos` | `true` | `true` |
| `edit_own_todos` | `true` | `true` |
| `edit_any_todo` | `true` | `false` |
| `delete_own_todos` | `true` | `true` |
| `delete_any_todo` | `true` | `false` |
| `complete_any_todo` | `true` | `false` |
| `add_subtodos` | `true` | `true` |
| `reorder_todos` | `true` | `false` |
| `comment` | `true` | `true` |
| `delete_own_comments` | `true` | `true` |
| `delete_any_comment` | `true` | `false` |
| `view_todos` | `true` | `true` |

---

## `GET /api/teams/:teamId/permissions`

获取完整权限矩阵：内置默认值、全局覆盖和所有按分组覆盖。

**需要身份验证：** 是 — `manage_permissions` 权限或所有者 / 联合所有者

**响应：**

```json
{
  "keys": [
    "manage_settings",
    "manage_permissions",
    "manage_sets",
    "create_todos",
    "edit_own_todos",
    "edit_any_todo",
    "delete_own_todos",
    "delete_any_todo",
    "complete_any_todo",
    "add_subtodos",
    "reorder_todos",
    "comment",
    "delete_own_comments",
    "delete_any_comment",
    "view_todos"
  ],
  "defaults": {
    "admin": { "manage_settings": false, "create_todos": true, "view_todos": true },
    "member": { "manage_settings": false, "create_todos": true, "view_todos": true }
  },
  "global": {
    "admin": { "manage_settings": false, "create_todos": true },
    "member": { "manage_settings": false, "create_todos": false }
  },
  "sets": {
    "set-uuid-1": {
      "admin": { "view_todos": true },
      "member": { "view_todos": false }
    }
  },
  "role": "owner"
}
```

| 字段 | 说明 |
| --- | --- |
| `keys` | 所有有效权限键名的有序列表。 |
| `defaults` | 管理员和成员角色的硬编码内置默认值。 |
| `global` | 存储在 D1 中的全局覆盖。此处只包含有显式覆盖的键。 |
| `sets` | `setId` → 该分组的按角色覆盖的映射。只包含有至少一个覆盖的分组。 |
| `role` | 当前用户的角色：`"owner"`、`"co_owner"`、`"admin"` 或 `"member"`。 |

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `403` | `"Forbidden"` | 缺少 `manage_permissions` 权限且不是所有者 / 联合所有者。 |

---

## `GET /api/teams/:teamId/permissions/me`

获取当前已认证用户的**解析后**有效权限。这正是前端用于决定显示或隐藏哪些操作的数据。

**需要身份验证：** 是 — 团队成员

**查询参数：**

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `setId` | string（可选） | 分组 UUID。提供时，该分组的按分组覆盖会在返回结果前被应用。 |

**响应：**

```json
{
  "permissions": {
    "manage_settings": false,
    "manage_permissions": false,
    "manage_sets": true,
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
  },
  "role": "admin"
}
```

响应前的解析顺序：

1. 所有者 / 联合所有者 → 所有键返回 `true`
2. 按分组覆盖（若提供了 `setId` 查询参数）
3. 存储在 D1 中的全局覆盖
4. 内置默认值

---

## `PUT /api/teams/:teamId/permissions`

批量更新特定作用域的权限。可以在单次请求中更新多个角色/权限组合。

**需要身份验证：** 是 — `manage_permissions` 权限或所有者 / 联合所有者

**请求体：**

```json
{
  "scope": "global",
  "permissions": [
    { "role": "admin", "permission": "manage_settings", "allowed": true },
    { "role": "member", "permission": "create_todos", "allowed": false },
    { "role": "member", "permission": "view_todos", "allowed": true }
  ]
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `scope` | string | `"global"` 表示团队范围；`"set:{setId}"` 表示特定分组。 |
| `permissions` | array | 每个元素指定一个 `role`、`permission` 键和 `allowed` 布尔值。 |
| `permissions[].role` | string | `"admin"` 或 `"member"`。 |
| `permissions[].permission` | string | 上述列表中的任意有效权限键。 |
| `permissions[].allowed` | boolean | `true` 表示授予，`false` 表示拒绝。 |

**响应：**

```json
{ "ok": true }
```

::: warning
只有**所有者**（非联合所有者或管理员）才能将 `manage_permissions` 授予管理员。非所有者尝试将 `manage_permissions` 设为 `true` 时返回 `403`。这防止权限提升。
:::

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `400` | `"Invalid scope"` | `scope` 不是 `"global"` 或有效的 `"set:{setId}"` 字符串。 |
| `400` | `"Invalid permission key"` | 列表中存在无法识别的权限键。 |
| `403` | `"Forbidden"` | 未授权，或以非所有者身份尝试授予 `manage_permissions`。 |

---

## `DELETE /api/teams/:teamId/permissions`

将某个作用域的所有权限覆盖重置为默认值。此操作从 D1 中删除该作用域的存储行，使解析回退到全局（对于按分组作用域）或内置默认值（对于全局作用域）。

**需要身份验证：** 是 — `manage_permissions` 权限或所有者 / 联合所有者

**查询参数：**

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `scope` | string | `"global"` 或 `"set:{setId}"`。若省略，默认为 `"global"`。 |

**响应：**

```json
{ "ok": true }
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `403` | `"Forbidden"` | 缺少 `manage_permissions` 权限且不是所有者 / 联合所有者。 |
