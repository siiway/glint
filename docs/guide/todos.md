# Todos

Todos are the core unit of content in Glint. Each todo belongs to a set, can have a nested hierarchy of sub-todos, and supports comments and multi-select bulk actions.

---

## Creating Todos

Type in the input field at the top of the todo list and press **Enter** or click **Add**. New todos are appended at the end of the list with the next available `sortOrder`.

To create a sub-todo, see [Sub-Todos](#sub-todos) below.

---

## Sub-Todos

Sub-todos are nested todos attached to a parent. They support the same actions (edit, complete, delete, comment) as top-level todos.

**To create a sub-todo:**

1. Hover over an existing todo to reveal its `...` menu.
2. Click **Add sub-todo** (or use the right-click context menu).
3. Type the title and press **Enter**.

Sub-todos appear indented below their parent. Use the chevron icon to collapse or expand a parent's sub-todo list.

::: warning
Deleting a parent todo also deletes all of its sub-todos and their comments. This is a cascading delete and cannot be undone.
:::

Requires: `add_subtodos` permission.

---

## Completing Todos

Click the checkbox to toggle completion. Completed todos display with a strikethrough style.

- You can always toggle your **own** todos.
- Toggling **others'** todos requires the `complete_any_todo` permission.

If the set has **Split Completed Todos** enabled, completed todos move to a collapsible "Completed" section at the bottom of the list.

---

## Assignment

Assignment lets you say "this is on these people." A todo can be assigned to
**multiple** team members at once, and each assignee's avatar is shown on the
todo row.

- Use **Assign…** (action bar, `...` menu, or right-click) to open the
  assignee picker — a GitHub-style popup with a search box and a checkable
  member list. Ticking a member assigns them; unticking removes them. Everyone
  currently assigned shows a check.
- Use **Assign to me** / **Unassign me** for the one-click self-assign shortcut.
  (This replaces the old "claim" feature; existing claims were migrated to
  self-assignments.)

Assignments sync in realtime via the `todo:assigned` event, so everyone viewing
the set sees the change instantly.

Requires: `assign_todos` permission.

---

## Assigned to me

A pinned **Assigned to me** category sits at the top of the sidebar, above your
todo lists. It gathers every incomplete todo assigned to you in the current
workspace, grouped by todo list. Each list group can be collapsed or expanded
(MS To Do style); the expand/collapse state is remembered per user in the
background.

You can complete a todo directly from this view. Completing it keeps the
assignment but removes it from the list (completed todos are hidden here).

Derived apps can read the same data across **all** your workspaces through the
cross-app [`GET /api/cross-app/assigned-to-me`](../api/cross-app#get-api-cross-app-assigned-to-me)
endpoint, which partitions results by workspace.

---

## Inline Editing

1. Click **Edit** from the `...` menu or right-click context menu.
2. The todo title becomes an editable input field.
3. Press **Enter** to save, or **Escape** to cancel without saving.

Requires: `edit_own_todos` for your own todos, `edit_any_todo` for others'.

---

## Reordering

On desktop, grab the grip handle on the left side of any todo and drag it to a new position. The order is saved immediately to the server.

- Drag-and-drop is not available on mobile.
- Only top-level todos within the same set can be reordered relative to each other. Sub-todo ordering follows the same rule within their parent's sub-list.

Requires: `reorder_todos` permission.

---

## Moving Between Lists

A todo (together with all of its sub-todos) can be moved from one set to another. The moved todo becomes a top-level todo in the destination set.

There are two ways to move a todo:

- **Context menu** — right-click a todo (or open its `...` menu) and choose **Move to list**. A dialog opens where you pick the destination list, then click **Insert at top** or **Insert at bottom** (or **Cancel**).
- **Drag-and-drop (desktop only)** — drag a todo onto a set in the sidebar. While hovering over a set, two overlays appear: drop on the **left half** to add it to the top of that list, or the **right half** to add it to the bottom.

A todo cannot be moved into a list that already has a top-level todo with the same title.

Requires: permission to edit the todo in its current set (`edit_own_todos` / `edit_any_todo`) **and** `create_todos` in the destination set.

---

## Comments

Each todo has a threaded comment section:

1. Click the **Comments** button or the comment count badge on a todo.
2. The comments dialog opens, showing all comments with author, timestamp, and body.
3. Type a new comment and click **Send** (or press **Ctrl+Enter** / **Cmd+Enter**).
4. To delete a comment, click the trash icon (visible on your own comments, or on any comment if you have `delete_any_comment`).

Requires: `comment` to post; `delete_own_comments` or `delete_any_comment` to delete.

---

## Multi-Selection

Multi-select allows bulk actions across many todos at once.

**Entering selection mode:**

- Right-click any todo → **Select**
- Or open the `...` menu → **Select**

**Selecting items:**

- Click any todo to toggle it selected / deselected.
- **Shift+click** to range-select all todos between the last-clicked and current.
- Click **Select All** in the selection bar to select every visible todo.

**Bulk actions (via the selection bar):**

| Action | Description |
| --- | --- |
| **Mark Complete** | Sets all selected todos to completed |
| **Mark Incomplete** | Clears completion on all selected todos |
| **Delete** | Permanently deletes all selected todos (and their sub-todos) |
| **Clear** | Exits selection mode without changes |

---

## Right-Click Context Menu

Right-click any todo to open a context menu with all available actions:

- Add sub-todo
- Comments
- Select / Deselect
- Select All
- Edit
- Mark complete / Mark incomplete
- Move to list
- Delete

Available actions are filtered based on your current permissions. Actions you lack permission for are hidden or disabled.

---

## Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| **Enter** | Submit the new-todo input |
| **Escape** | Cancel inline edit |
| **Ctrl+Enter** / **Cmd+Enter** | Send a comment |
| **Shift+click** | Range-select todos (in multi-select mode) |

---

## API Reference

See [Todos API](../api/todos) for the full endpoint reference, including field-level permission checks and cascade behavior.
