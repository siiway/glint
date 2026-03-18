# Getting Started

Glint is a team-based todo list application built on Cloudflare Workers. It uses D1 for storage, KV for sessions and configuration, and Prism for authentication.

## Prerequisites

- [Bun](https://bun.sh) (package manager)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (Cloudflare Workers)
- A [Prism](https://github.com/siiway/prism) instance for authentication

## Installation

```bash
git clone https://github.com/siiway/glint.git
cd glint
bun install
```

## Setup Cloudflare Resources

### 1. Create a D1 database

```bash
wrangler d1 create glint-db
```

Copy the `database_id` from the output into `wrangler.jsonc`.

### 2. Create a KV namespace

```bash
wrangler kv namespace create KV
```

Copy the `id` from the output into `wrangler.jsonc`.

### 3. Apply migrations

```bash
wrangler d1 migrations apply glint-db --local  # for local dev
wrangler d1 migrations apply glint-db           # for remote
```

### 4. Register a Prism OAuth app

On your Prism instance, create an OAuth application:

- **Redirect URI**: `http://localhost:5173/callback` (for dev) or `https://your-domain.com/callback`
- **Scopes**: `openid`, `profile`, `email`, `teams:read`
- **Client type**: Public (PKCE) or Confidential (with client secret)

Note down the **Client ID** (and **Client Secret** if using a confidential client) — you will enter them during the init wizard.

The init wizard lets you choose between PKCE (recommended for SPAs) and confidential client flow.

## Development

```bash
bun run dev
```

On first visit, Glint shows an **initialization wizard** that:

1. Collects your Prism configuration (base URL, client ID, redirect URI)
2. Optionally sets an allowed team ID to restrict access
3. Creates the database tables

All configuration is stored in KV — no environment variables needed.

## Deployment

```bash
bun run deploy
```

After deploying, visit your domain. If not yet initialized, the init wizard will appear.
