# Permissions API

Granular permission management for teams. Stored in D1 with per-set override support.

## `GET /api/teams/:teamId/permissions`

Get the full permission matrix: defaults, global overrides, and per-set overrides.

**Response:**

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

Get the effective permissions for the current user, optionally scoped to a set.

**Query params:**

- `setId` (optional) — check permissions in the context of a specific set

**Response:**

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

Batch update permissions for a scope. Requires `manage_permissions`.

**Request body:**

```json
{
  "scope": "global",
  "permissions": [
    { "role": "admin", "permission": "manage_settings", "allowed": true },
    { "role": "member", "permission": "create_todos", "allowed": false }
  ]
}
```

`scope` can be `"global"` or `"set:{setId}"`.

**Response:**

```json
{ "ok": true }
```

::: warning
Only owners can grant `manage_permissions` to admins. Attempting to do so as a non-owner returns `403`.
:::

## `DELETE /api/teams/:teamId/permissions`

Reset all permission overrides for a scope back to defaults.

**Query params:**

- `scope` — `"global"` or `"set:{setId}"` (defaults to `"global"`)

Requires `manage_permissions`.

**Response:**

```json
{ "ok": true }
```
