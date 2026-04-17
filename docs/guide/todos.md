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
