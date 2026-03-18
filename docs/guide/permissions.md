# Permissions

Glint has a granular, configurable permission system. The team owner can control exactly what admins and members are allowed to do.

## How It Works

- **Owner** always has full access. This is hardcoded and cannot be restricted.
- **Admin** and **Member** roles have configurable permissions with sensible defaults.
- Permissions can be set **globally** (team-wide) or **per-set** (overriding global for a specific todo set).

## Resolution Order

When checking if a user can perform an action:

1. If the user is an **owner**, always allowed.
2. Check for a **per-set override** (if the action is within a specific set).
3. Check for a **global override** in the database.
4. Fall back to the **built-in defaults**.

## Permission Keys

| Key                   | Description                                    |
| --------------------- | ---------------------------------------------- |
| `manage_settings`     | Edit site name, logo, branding, and app config |
| `manage_permissions`  | Edit permission rules (owner-only by default)  |
| `manage_sets`         | Create, rename, delete, and reorder todo sets  |
| `create_todos`        | Create new todos                               |
| `edit_own_todos`      | Edit todos the user created                    |
| `edit_any_todo`       | Edit todos created by others                   |
| `delete_own_todos`    | Delete todos the user created                  |
| `delete_any_todo`     | Delete todos created by others                 |
| `complete_any_todo`   | Toggle completion on others' todos             |
| `add_subtodos`        | Create nested sub-todos                        |
| `reorder_todos`       | Drag to reorder todos                          |
| `comment`             | Add comments to todos                          |
| `delete_own_comments` | Delete comments the user posted                |
| `delete_any_comment`  | Delete comments posted by others               |
| `view_todos`          | View todos in a set                            |

## Managing Permissions

1. Go to **Settings > Permissions** (requires `manage_permissions` or owner role).
2. Select a **scope**: Global (team-wide) or a specific set.
3. Toggle switches for each permission per role (Admin / Member).
4. Click **Save Permissions**.

Use **Reset to Defaults** to remove all overrides for the selected scope.

::: warning
Only owners can grant the `manage_permissions` permission to admins. This prevents privilege escalation.
:::
