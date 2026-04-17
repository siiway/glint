# Todo Sets

Todo sets are containers that group related todos within a team workspace. Every todo belongs to exactly one set. Sets are listed in the sidebar and can be reordered, renamed, or deleted.

---

## Default Set

When a user first accesses a team workspace, Glint automatically creates a default set if none exists. The default set name is configurable in **Settings → Branding** (`default_set_name`; defaults to `"Not Grouped"`).

This ensures the workspace is immediately usable without any manual setup.

---

## Creating Sets

Users with `manage_sets` permission can create sets:

1. Scroll to the bottom of the sidebar's set list.
2. Click **New set**.
3. Type a name and press **Enter** or click the confirm button.

The new set appears at the end of the list with the next available `sortOrder`. It becomes the active set automatically.

---

## Renaming Sets

1. Hover over a set in the sidebar to reveal the `...` menu.
2. Click **Rename**.
3. Enter the new name in the dialog and confirm.

Requires: `manage_sets`, or you must be the creator of the set.

---

## Deleting Sets

1. Open the `...` menu on the set.
2. Click **Delete**.
3. Confirm the deletion in the dialog.

::: warning
Deleting a set **permanently removes** the set and all todos within it, including sub-todos and all comments. This cannot be undone.
:::

Requires: `manage_sets`, or you must be the creator of the set.

---

## Reordering Sets

On desktop, drag sets in the sidebar using the drag handle to change their order. The new order is saved immediately via the reorder API.

Drag-and-drop is not available on mobile. On mobile, sets can be reordered from **Settings → Sets** (if you have `manage_sets`).

Requires: `manage_sets`.

---

## Per-Set Options

Each set has configurable options accessible via the `...` menu → **Options** (or the set's settings panel).

### Split Completed Todos

When enabled, completed todos are separated from active todos within the set — they appear in a collapsible "Completed" section below the active list.

This is set per-set and does not affect other sets. The setting persists for all users viewing the set (it's a server-side property, not a personal preference).

---

## Per-Set Permissions

Each set can have its own permission overrides, independent of global team permissions. This is useful for:

- **Restricting sensitive sets** — prevent members from viewing a set used for confidential planning.
- **Opening up specific sets** — allow members to reorder or manage todos in a single set without granting those permissions globally.

To configure per-set permissions:

1. Go to **Settings → Permissions**.
2. Open the **Scope** dropdown and select the specific set.
3. Toggle permissions for Admin / Member as needed.
4. Click **Save Permissions**.

Per-set overrides take priority over global permissions. See [Permissions](./permissions) for the full resolution order.

---

## Set Visibility

Sets are listed to all team members who have `view_todos` in at least one set. If `view_todos` is revoked for a specific set, users in that role:

- Do not see todo content when they navigate to that set.
- Receive an "Unauthorized" notice and are redirected to the home page.
- The set still appears in the sidebar (it is not hidden), but access is blocked when clicked.

---

## API Reference

See [Todo Sets API](../api/sets) for the full endpoint reference including request/response shapes and error codes.
