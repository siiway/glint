# AGENTS

## Package Manager

Use Bun for all package and script commands in this repository.

- Install deps: `bun install`
- Run scripts: `bun run <script>`
- Generate Cloudflare worker types: `bun run cf-typegen`
- Add deps: `bun add <package>`
- Add dev deps: `bun add -d <package>`

Avoid npm, pnpm, and yarn unless the user explicitly asks for them.

## Todo actions

A per-todo action (e.g. edit, complete, assign, move, delete) is surfaced in
**three** places that must always be updated together:

1. **Right-click context menu** — `src/components/TodoContextMenu.tsx`.
2. **Three-dot (`...`) menu** — `todoMenuItems` in `src/components/TodoPage.tsx`.
3. **Action-bar quick actions & preferences** — `renderActionBarItem` in
   `src/components/TodoPage.tsx`, the `ActionKey` list in
   `src/utils/actionBar.ts`, and the My / Workspace / Global (site default)
   customization lists in `src/components/SettingsPage.tsx`.

When you add, rename, or remove a todo action, change all three (right-click +
three-dot + preferences) in the same edit so they stay consistent.

## Assignment model

Todos are assigned to team members via the `todo_assignees` join table (a todo
can have multiple assignees). The old single-user "claim" (`todos.claimed_by` +
`claim_todos` permission) was replaced by assignment (`assign_todos` permission,
`PUT /todos/:id/assignees`, `todo:assigned` realtime event). "Assign to me" is a
self-assign shortcut. Runtime feature detection lives in `worker/assignees.ts`
(`supportsAssignees`). The pinned "Assigned to me" sidebar category renders
`src/components/AssignedToMe.tsx`; the GitHub-style picker is
`src/components/AssigneePicker.tsx`.

## Contributing

Also follow the instructions in `CONTRIBUTING.md`.
