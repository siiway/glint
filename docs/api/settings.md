# Team Settings API

Team-specific branding and configuration. Stored in KV under `team_settings:{teamId}`. All endpoints require authentication and team membership.

---

## `GET /api/teams/:teamId/settings`

Fetch the current branding and configuration settings for a team.

**Auth required:** Yes — team member

**Path parameters:**

| Parameter | Description |
| --- | --- |
| `teamId` | The Prism team UUID, or `personal:<userId>` for a personal workspace. |

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

| Field | Type | Description |
| --- | --- | --- |
| `site_name` | string | Displayed in the sidebar and browser title. Default: `"Glint"`. |
| `site_logo_url` | string | URL to a logo image. Empty means use text title. |
| `accent_color` | string | CSS color value for the primary theme. Empty means use default. |
| `welcome_message` | string | Optional message shown on the login page. |
| `default_set_name` | string | Name given to the auto-created first set. Default: `"Not Grouped"`. |
| `allow_member_create_sets` | boolean | Whether members can create sets. When `true`, members bypass the `manage_sets` default restriction for set creation only. |

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `401` | `"Unauthorized"` | Not logged in. |
| `403` | `"Forbidden"` | Logged in but not a member of this team. |

---

## `PATCH /api/teams/:teamId/settings`

Update one or more team settings fields. Only the provided fields are updated; omitted fields are unchanged.

**Auth required:** Yes — `manage_settings` permission (or owner/co-owner)

**Path parameters:**

| Parameter | Description |
| --- | --- |
| `teamId` | The Prism team UUID. |

**Request body** (all fields optional):

```json
{
  "site_name": "My Team Todos",
  "site_logo_url": "https://cdn.example.com/logo.png",
  "accent_color": "#0078d4",
  "welcome_message": "Sign in to track your work.",
  "default_set_name": "Inbox",
  "allow_member_create_sets": true
}
```

**Field constraints:**

| Field | Constraint |
| --- | --- |
| `site_name` | Non-empty string if provided. |
| `site_logo_url` | Must be a valid URL or empty string. Logo is fetched by the browser directly — must be publicly accessible. |
| `accent_color` | Any CSS color value (`#hex`, `rgb()`, named, etc.) or empty string to reset. |
| `welcome_message` | Any string or empty to clear. |
| `default_set_name` | Non-empty string if provided. Affects newly created workspaces; does not rename any existing sets. |
| `allow_member_create_sets` | Boolean. |

**Response:**

```json
{
  "settings": {
    "site_name": "My Team Todos",
    "site_logo_url": "https://cdn.example.com/logo.png",
    "accent_color": "#0078d4",
    "welcome_message": "Sign in to track your work.",
    "default_set_name": "Inbox",
    "allow_member_create_sets": true
  }
}
```

The response always returns the full settings object after the update is applied.

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `401` | `"Unauthorized"` | Not logged in. |
| `403` | `"Forbidden"` | Logged in but lacks `manage_settings` (and is not owner/co-owner). |
| `400` | `"Invalid request"` | Malformed JSON or invalid field value. |
