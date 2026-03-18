# Glint

A team-based todo list built on Cloudflare Workers with [Prism](https://github.com/siiway/prism) authentication.

## Features

- **Team-scoped todos** with role-based access control (owner / admin / member)
- **Drag-and-drop reordering** with persistent sort order
- **Prism OAuth 2.0 + PKCE** authentication
- **Cloudflare D1** for persistent storage, **KV** for sessions
- **Fluent UI v9** component library
- **First-time init page** that sets up the database automatically

## Quick Start

```bash
bun install

# Create Cloudflare resources
wrangler d1 create glint-db
wrangler kv namespace create KV

# Update wrangler.jsonc with the IDs from above, plus your Prism config

bun run dev
```

See the [documentation](docs/guide/getting-started.md) for full setup instructions.

## Scripts

| Command              | Description                    |
| -------------------- | ------------------------------ |
| `bun run dev`        | Start development server       |
| `bun run build`      | Build for production           |
| `bun run deploy`     | Build and deploy to Cloudflare |
| `bun run docs:dev`   | Start docs dev server          |
| `bun run docs:build` | Build documentation            |

## Tech Stack

- [Cloudflare Workers](https://workers.cloudflare.com/) + D1 + KV
- [Hono](https://hono.dev/) (API router)
- [React 19](https://react.dev/) + [Fluent UI v9](https://react.fluentui.dev/)
- [Prism](https://github.com/siiway/prism) (authentication)
- [Vite](https://vite.dev/) (build tool)
- [VitePress](https://vitepress.dev/) (documentation)

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
