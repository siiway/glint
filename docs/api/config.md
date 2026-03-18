# App Config API

App-level configuration (Prism OAuth settings, access control). Stored in KV under `config:app`.

## `GET /api/init/status`

Check if the app has been initialized.

**Response:**

```json
{ "configured": true }
```

## `GET /api/init/branding`

Public endpoint (no auth). Returns the site name and logo for the login page.

**Response:**

```json
{
  "site_name": "Glint",
  "site_logo_url": "https://example.com/logo.png"
}
```

## `GET /api/init/config`

Returns the current app configuration. No auth required.

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

## `PUT /api/init/config`

Update the app configuration. Before initialization, anyone can call this. After initialization, only the team owner can update it.

**Request body (all fields optional):**

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

**Response:**

```json
{
  "config": { ... }
}
```

## `POST /api/init/setup`

First-time setup. Creates all database tables and optionally saves app config. Can only be called once.

**Request body (optional):**

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

**Response:**

```json
{ "ok": true }
```

Returns `400` if already configured.
