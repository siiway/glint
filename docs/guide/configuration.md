# Configuration

All Glint configuration is stored in Cloudflare KV and managed through the web UI. No environment variables are required.

## App Config

Configured during the init wizard or in **Settings > App Config** (owner only):

| Key                   | Description                                                                      |
| --------------------- | -------------------------------------------------------------------------------- |
| `prism_base_url`      | URL of your Prism instance (e.g. `https://id.siiway.com`)                        |
| `prism_client_id`     | OAuth client ID from Prism                                                       |
| `prism_client_secret` | OAuth client secret (only for confidential clients, leave empty for PKCE)        |
| `prism_redirect_uri`  | OAuth redirect URI for your deployment                                           |
| `use_pkce`            | `true` for public clients (PKCE), `false` for confidential clients with a secret |
| `allowed_team_id`     | If set, only members of this Prism team can sign in                              |

Stored in KV under `config:app`.

## Team Settings

Configured in **Settings > Branding** (owner or users with `manage_settings` permission):

| Key                | Description                                             |
| ------------------ | ------------------------------------------------------- |
| `site_name`        | Displayed in the sidebar, login page, and browser title |
| `site_logo_url`    | URL to a logo image (replaces the text title)           |
| `accent_color`     | Custom accent color (CSS value)                         |
| `welcome_message`  | Shown on the login page                                 |
| `default_set_name` | Name for the auto-created default todo set              |

Stored in KV under `team_settings:{teamId}`.

## Bindings

The worker requires two Cloudflare bindings in `wrangler.jsonc`:

### D1 Database (`DB`)

Stores todos, todo sets, comments, and permissions. Schema is managed via migrations in the `migrations/` directory.

### KV Namespace (`KV`)

Used for:

- **App configuration** — `config:app`
- **Team settings** — `team_settings:{teamId}`
- **User sessions** — `session:{id}`
- **Init state** — `init:configured`
