# App Config API

App-level configuration: Prism OAuth settings and access control. Stored in KV under `config:app`.

All endpoints in this section are accessible without authentication **before** initialization. After initialization, write endpoints (`PUT /api/init/config`) require owner privileges.

---

## `GET /api/init/status`

Check whether the app has been initialized. Used by the frontend to determine whether to show the initialization wizard.

**Auth required:** No

**Response:**

```json
{ "configured": true }
```

| Field | Type | Description |
| --- | --- | --- |
| `configured` | boolean | `true` if `POST /api/init/setup` has been called at least once. |

---

## `GET /api/init/branding`

Public endpoint (no auth). Returns the site name and logo URL used to render the login page before a session exists.

**Auth required:** No

**Response:**

```json
{
  "site_name": "Glint",
  "site_logo_url": "https://example.com/logo.png"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `site_name` | string | Display name from team settings. Falls back to `"Glint"` if not set. |
| `site_logo_url` | string | Logo URL, or empty string if no logo is configured. |

---

## `GET /api/init/config`

Returns the current app configuration. The `prism_client_secret` field is always returned as an empty string to avoid exposing secrets over the API.

**Auth required:** No

**Response:**

```json
{
  "config": {
    "prism_base_url": "https://id.siiway.com",
    "prism_client_id": "prism_xxxxx",
    "prism_client_secret": "",
    "prism_redirect_uri": "https://glint.example.com/callback",
    "use_pkce": true,
    "allowed_team_id": ""
  }
}
```

| Field | Type | Description |
| --- | --- | --- |
| `prism_base_url` | string | Base URL of the Prism OAuth instance. |
| `prism_client_id` | string | Registered OAuth client ID. |
| `prism_client_secret` | string | Always `""` — secret is never returned. |
| `prism_redirect_uri` | string | OAuth callback URI. |
| `use_pkce` | boolean | `true` for PKCE (public) clients. |
| `allowed_team_id` | string | If set, restricts sign-in to members of this team. If locked via env var, the value is shown but cannot be changed from the UI. |

---

## `PUT /api/init/config`

Update the app configuration. Before initialization, anyone can call this. After initialization, only the team owner can update it.

**Auth required:** Owner (after initialization)

**Request body** (all fields optional — only provided fields are updated):

```json
{
  "prism_base_url": "https://id.siiway.com",
  "prism_client_id": "prism_xxxxx",
  "prism_client_secret": "your-secret",
  "prism_redirect_uri": "https://glint.example.com/callback",
  "use_pkce": false,
  "allowed_team_id": "team-uuid"
}
```

::: tip
Send `"prism_client_secret": ""` to clear a previously stored secret (e.g. switching from confidential to PKCE mode).
:::

**Response:**

```json
{
  "config": {
    "prism_base_url": "https://id.siiway.com",
    "prism_client_id": "prism_xxxxx",
    "prism_client_secret": "",
    "prism_redirect_uri": "https://glint.example.com/callback",
    "use_pkce": false,
    "allowed_team_id": "team-uuid"
  }
}
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `403` | `"Forbidden"` | Authenticated but not the team owner. |
| `401` | `"Unauthorized"` | Not logged in, and app is already initialized. |

---

## `POST /api/init/setup`

One-time initialization. Creates all database tables (using `CREATE TABLE IF NOT EXISTS`) and saves the app configuration to KV. Sets `init:configured` in KV to mark setup as complete.

**Auth required:** No (call before first login)

**Request body** (optional — config can be supplied here or via `PUT /api/init/config` separately):

```json
{
  "config": {
    "prism_base_url": "https://id.siiway.com",
    "prism_client_id": "prism_xxxxx",
    "prism_client_secret": "",
    "prism_redirect_uri": "https://glint.example.com/callback",
    "use_pkce": true,
    "allowed_team_id": ""
  }
}
```

**Response (200):**

```json
{ "ok": true }
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `400` | `"Already configured"` | Setup has already been completed. Delete `init:configured` from KV to re-run. |

::: info
Re-running setup is safe — `CREATE TABLE IF NOT EXISTS` means no data is lost. The main effect of re-running is overwriting the stored config. See [Configuration](../guide/configuration#resetting-configuration) for how to trigger a re-run.
:::
