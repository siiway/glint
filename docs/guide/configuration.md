# Configuration

All Glint configuration lives in Cloudflare KV and is managed through the web UI or environment variables. There is no `.env` file — the init wizard writes values directly into KV on first run, and subsequent changes go through the Settings page.

---

## App Config

Configured during the initialization wizard or in **Settings → App Config** (owner only after setup).

| Key | Description |
| --- | --- |
| `prism_base_url` | Base URL of your Prism instance, e.g. `https://id.example.com`. No trailing slash. |
| `prism_client_id` | OAuth Client ID from your Prism app registration. |
| `prism_client_secret` | OAuth client secret. Only required for confidential clients. Leave empty when using PKCE. |
| `prism_redirect_uri` | The callback URL registered in your Prism app, e.g. `https://glint.example.com/callback`. Must match exactly. |
| `use_pkce` | `true` for public (PKCE) clients; `false` for confidential (secret-based) clients. |
| `allowed_team_id` | Restrict sign-in to members of a specific Prism team. Leave empty to allow any authenticated Prism user. |

All values are stored under the KV key `config:app` as a JSON object.

::: warning
`prism_client_secret` is stored in KV, not as an environment variable. Make sure your KV namespace is not publicly readable. In Cloudflare's security model, KV bindings are only accessible to your Worker — they are never exposed via any public API.
:::

### PKCE vs Confidential Client

| | PKCE (Public) | Confidential |
| --- | --- | --- |
| `use_pkce` | `true` | `false` |
| `prism_client_secret` | empty | required |
| Token exchange | Code + PKCE verifier | Code + client secret |
| Security model | Verifier stays in Worker | Secret stays in Worker, never in browser |
| Best for | Most deployments | High-security private deployments |

Both modes are equally secure when deployed on Cloudflare Workers — the PKCE verifier and the client secret are both handled server-side and never exposed to the browser.

### `allowed_team_id`

When set, Glint evaluates team membership at login time. Users not in the specified team see a "Not Authorized" page and cannot proceed.

Multiple team IDs can be specified, separated by commas, semicolons, or spaces:

```
team_a, team_b, team_c
```

::: tip
`allowed_team_id` set via the **`ALLOWED_TEAM_ID` environment variable** (in `wrangler.jsonc` or the Cloudflare dashboard) takes precedence over the KV-stored value and cannot be modified from the UI. The Settings page shows a "locked" indicator when the env var is active.
:::

---

## Team Settings

Per-team branding and behaviour, configurable in **Settings → Branding** (owner or users with `manage_settings`).

| Key | Description |
| --- | --- |
| `site_name` | Display name shown in the sidebar header, browser tab title, and login page. |
| `site_logo_url` | URL to a logo image. When set, replaces the text title in the sidebar. Must be publicly accessible. |
| `accent_color` | CSS color value (hex, `rgb()`, etc.) applied as the primary theme color. Leave empty for default. |
| `welcome_message` | Short message shown below the app name on the login page. Optional. |
| `default_set_name` | Name given to the auto-created set when a team is first accessed. Default: `"Not Grouped"`. |

Team settings are stored under the KV key `team_settings:{teamId}`.

---

## Cloudflare Bindings

Your `wrangler.jsonc` must declare two bindings:

### D1 Database (`DB`)

Stores all persistent data: todos, sets, comments, and permission overrides.

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "glint-db",
      "database_id": "YOUR_DATABASE_ID"
    }
  ]
}
```

The schema is managed via numbered migration files in `migrations/`. Run them with:

```bash
# Local
wrangler d1 migrations apply glint-db --local

# Production
wrangler d1 migrations apply glint-db
```

Migrations use `CREATE TABLE IF NOT EXISTS` and are idempotent — re-running is safe.

### KV Namespace (`KV`)

Used for sessions, configuration, team settings, and user-teams caching.

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "YOUR_KV_ID",
      "preview_id": "YOUR_KV_PREVIEW_ID"
    }
  ]
}
```

`preview_id` is required for `wrangler dev` (local development). Create one with:

```bash
wrangler kv namespace create KV --preview
```

---

## KV Key Reference

| Key pattern | Contents | TTL |
| --- | --- | --- |
| `init:configured` | `"1"` once setup is complete | None (permanent) |
| `config:app` | JSON object with all app config fields | None (permanent) |
| `team_settings:{teamId}` | JSON object with branding/settings | None (permanent) |
| `session:{sessionId}` | JSON session data including access token | Set to token expiry |
| `user-teams:{userId}` | JSON array of `TeamInfo` objects | 10 minutes |

The `user-teams` cache is populated at login and used by cross-app middleware to resolve team membership without a live Prism API call. It expires after 10 minutes; if absent, the middleware falls back to a live lookup.

---

## Environment Variables

Only one optional environment variable exists:

| Variable | Purpose |
| --- | --- |
| `ALLOWED_TEAM_ID` | Overrides `config:app.allowed_team_id`. Cannot be changed from the UI when set. |

Set it in `wrangler.jsonc`:

```jsonc
{
  "vars": {
    "ALLOWED_TEAM_ID": "your-prism-team-uuid"
  }
}
```

Or in the Cloudflare dashboard under **Workers → Your Worker → Settings → Variables**.

---

## Resetting Configuration

To wipe the init state and re-run the wizard (local development):

```bash
wrangler kv key delete --local --binding KV "init:configured"
```

This lets you re-run `POST /api/init/setup`. Tables are recreated with `IF NOT EXISTS`, so existing data is preserved.

To reset on production, delete `init:configured` from your production KV namespace:

```bash
wrangler kv key delete --binding KV "init:configured"
```

::: warning
Re-initializing in production does not wipe your database. It only allows the config to be overwritten. Todos, sets, and comments remain intact.
:::
