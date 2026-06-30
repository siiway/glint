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

A per-todo action (e.g. edit, complete, move, delete) is surfaced in **three**
places that must always be updated together:

1. **Right-click context menu** — `src/components/TodoContextMenu.tsx`.
2. **Three-dot (`...`) menu** — `todoMenuItems` in `src/components/TodoPage.tsx`.
3. **Action-bar quick actions & preferences** — `renderActionBarItem` in
   `src/components/TodoPage.tsx`, the `ActionKey` list in
   `src/utils/actionBar.ts`, and the My / Workspace / Global (site default)
   customization lists in `src/components/SettingsPage.tsx`.

When you add, rename, or remove a todo action, change all three (right-click +
three-dot + preferences) in the same edit so they stay consistent.

## Contributing

Also follow the instructions in `CONTRIBUTING.md`.
