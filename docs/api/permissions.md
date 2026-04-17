# Permissions API

Granular permission management for teams. Permission overrides are stored in D1 with support for global (team-wide) and per-set scopes.

All endpoints require authentication and team membership.

---

## Permission Keys

The full list of permission keys:

| Key | Admin default | Member default |
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

Fetch the full permission matrix: built-in defaults, global overrides, and all per-set overrides.

**Auth required:** Yes — `manage_permissions` or owner/co-owner

**Response:**

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
    "admin": { "manage_settings": false, "create_todos": true, "view_todos": true, "..." : "..." },
    "member": { "manage_settings": false, "create_todos": true, "view_todos": true, "..." : "..." }
  },
  "global": {
    "admin": { "manage_settings": false, "create_todos": true, "..." : "..." },
    "member": { "manage_settings": false, "create_todos": false, "..." : "..." }
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

| Field | Description |
| --- | --- |
| `keys` | Ordered list of all valid permission key names. |
| `defaults` | The hardcoded built-in defaults for admin and member roles. |
| `global` | The stored global overrides (from D1). Only keys with explicit overrides are present here. |
| `sets` | A map of `setId` → per-role overrides for that set. Only sets with at least one override are included. |
| `role` | The current user's role: `"owner"`, `"co_owner"`, `"admin"`, or `"member"`. |

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `403` | `"Forbidden"` | Lacks `manage_permissions` and is not owner/co-owner. |

---

## `GET /api/teams/:teamId/permissions/me`

Fetch the **resolved** effective permissions for the currently authenticated user. This is what the frontend uses to decide which actions to show or hide.

**Auth required:** Yes — team member

**Query parameters:**

| Parameter | Type | Description |
| --- | --- | --- |
| `setId` | string (optional) | A set UUID. When provided, per-set overrides for that set are applied before returning the result. |

**Response:**

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

Resolution order applied before responding:

1. Owner / Co-owner → all keys return `true`
2. Per-set override (if `setId` query param provided)
3. Global override stored in D1
4. Built-in defaults

---

## `PUT /api/teams/:teamId/permissions`

Batch update permissions for a specific scope. You can update multiple role/permission combinations in a single request.

**Auth required:** Yes — `manage_permissions` or owner/co-owner

**Request body:**

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

| Field | Type | Description |
| --- | --- | --- |
| `scope` | string | `"global"` for team-wide, or `"set:{setId}"` for a specific set. |
| `permissions` | array | Each item specifies a `role`, a `permission` key, and the `allowed` boolean value. |
| `permissions[].role` | string | `"admin"` or `"member"`. |
| `permissions[].permission` | string | Any valid permission key from the list above. |
| `permissions[].allowed` | boolean | `true` to grant, `false` to deny. |

**Response:**

```json
{ "ok": true }
```

::: warning
Only the **owner** (not co-owners or admins) can grant `manage_permissions` to admins. Attempting to set `manage_permissions: true` for admin or member as a non-owner returns `403`. This prevents privilege escalation.
:::

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `400` | `"Invalid scope"` | `scope` is not `"global"` or a valid `"set:{setId}"` string. |
| `400` | `"Invalid permission key"` | A permission key in the list is not recognized. |
| `403` | `"Forbidden"` | Not authorized, or attempting to grant `manage_permissions` as a non-owner. |

---

## `DELETE /api/teams/:teamId/permissions`

Reset all permission overrides for a scope back to defaults. This removes the stored rows from D1 for the given scope, causing the resolution to fall back to global (for per-set scopes) or built-in defaults (for global scope).

**Auth required:** Yes — `manage_permissions` or owner/co-owner

**Query parameters:**

| Parameter | Type | Description |
| --- | --- | --- |
| `scope` | string | `"global"` or `"set:{setId}"`. Defaults to `"global"` if omitted. |

**Response:**

```json
{ "ok": true }
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `403` | `"Forbidden"` | Lacks `manage_permissions` and is not owner/co-owner. |
