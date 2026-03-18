# 权限 API

团队的精细权限管理。存储在 D1 中，支持按集合覆盖。

## `GET /api/teams/:teamId/permissions`

获取完整权限矩阵：默认值、全局覆盖和按集合覆盖。

**响应：**

```json
{
  "keys": ["manage_settings", "create_todos", ...],
  "defaults": {
    "admin": { "manage_settings": false, "create_todos": true, ... },
    "member": { "manage_settings": false, "create_todos": true, ... }
  },
  "global": {
    "admin": { "manage_settings": false, "create_todos": true, ... },
    "member": { ... }
  },
  "sets": {
    "set-uuid": {
      "admin": { "view_todos": true },
      "member": { "view_todos": false }
    }
  },
  "role": "owner"
}
```

## `GET /api/teams/:teamId/permissions/me`

获取当前用户的有效权限，可选按集合范围限定。

**查询参数：**

- `setId`（可选）— 在特定集合的上下文中检查权限

**响应：**

```json
{
  "permissions": {
    "manage_settings": true,
    "create_todos": true,
    "edit_own_todos": true,
    ...
  },
  "role": "admin"
}
```

## `PUT /api/teams/:teamId/permissions`

批量更新某个范围的权限。需要 `manage_permissions` 权限。

**请求体：**

```json
{
  "scope": "global",
  "permissions": [
    { "role": "admin", "permission": "manage_settings", "allowed": true },
    { "role": "member", "permission": "create_todos", "allowed": false }
  ]
}
```

`scope` 可以是 `"global"` 或 `"set:{setId}"`。

**响应：**

```json
{ "ok": true }
```

::: warning
只有所有者才能将 `manage_permissions` 权限授予管理员。非所有者尝试此操作将返回 `403`。
:::

## `DELETE /api/teams/:teamId/permissions`

将某个范围的所有权限覆盖重置为默认值。

**查询参数：**

- `scope` — `"global"` 或 `"set:{setId}"`（默认为 `"global"`）

需要 `manage_permissions` 权限。

**响应：**

```json
{ "ok": true }
```
