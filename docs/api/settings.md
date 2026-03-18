# Team Settings API

Team-specific branding and configuration. Stored in KV under `team_settings:{teamId}`.

## `GET /api/teams/:teamId/settings`

Get the team's settings. Requires team membership.

**Response:**

```json
{
  "settings": {
    "site_name": "Glint",
    "site_logo_url": "",
    "accent_color": "",
    "welcome_message": "",
    "default_set_name": "Not Grouped",
    "allow_member_create_sets": false
  }
}
```

## `PATCH /api/teams/:teamId/settings`

Update team settings. Requires `manage_settings` permission.

**Request body (all fields optional):**

```json
{
  "site_name": "My Team Todos",
  "site_logo_url": "https://example.com/logo.png",
  "accent_color": "#0078d4",
  "welcome_message": "Welcome!",
  "default_set_name": "Inbox"
}
```

**Response:**

```json
{
  "settings": { ... }
}
```
