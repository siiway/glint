# User Settings API

Personal preferences stored per-user in KV under `user_settings:{userId}`. All endpoints require authentication.

---

## `GET /api/user/settings`

Fetch the current user's preferences.

**Auth required:** Yes — authenticated session

**Response:**

```json
{
  "settings": {
    "action_bar": ["add_after", "edit", "complete", "delete"],
    "realtime_transport": "auto",
    "workspace_favicon": true,
    "detailed_status": false,
    "personal_avatar_icon": true,
    "complete_sound_enabled": false,
    "complete_sound_url": ""
  }
}
```

If the user has never saved any preferences, an empty object (`{}`) is returned and the client applies its built-in defaults.

| Field | Type | Description |
| --- | --- | --- |
| `action_bar` | `string[] \| null` | Custom order of quick-action buttons on each todo. `null` means use workspace or site default. |
| `realtime_transport` | `"ws" \| "sse" \| "auto"` | Preferred sync transport for realtime updates. `"auto"` attempts WebSocket, falls back to SSE. Default: `"auto"`. |
| `workspace_favicon` | boolean | When `true`, the browser favicon follows the currently selected workspace's icon. |
| `detailed_status` | boolean | When `true`, completed/remaining counts are shown in the page header. |
| `personal_avatar_icon` | boolean | When `true`, the user's personal avatar is used as the personal workspace icon/favicon. |
| `complete_sound_enabled` | boolean | When `true`, a sound plays when a todo is marked complete. |
| `complete_sound_url` | string | URL of the sound file to play on completion. |

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `401` | `"Unauthorized"` | Not logged in. |

---

## `PUT /api/user/settings`

Update one or more user preference fields. Only the provided fields are updated; omitted fields are unchanged.

**Auth required:** Yes — authenticated session

**Request body** (all fields optional):

```json
{
  "action_bar": ["edit", "complete", "delete", "comment"],
  "realtime_transport": "sse",
  "detailed_status": true,
  "complete_sound_enabled": true,
  "complete_sound_url": "https://example.com/ding.mp3"
}
```

Only recognized keys are persisted; unknown keys in the body are ignored.

**Field constraints:**

| Field | Constraint |
| --- | --- |
| `action_bar` | Array of valid action keys: `add_before`, `add_after`, `add_subtodo`, `edit`, `complete`, `claim`, `comment`, `delete`. Pass `null` to reset to workspace/site default. |
| `realtime_transport` | One of: `"ws"`, `"sse"`, `"auto"`. |
| `workspace_favicon` | Boolean. |
| `detailed_status` | Boolean. |
| `personal_avatar_icon` | Boolean. |
| `complete_sound_enabled` | Boolean. |
| `complete_sound_url` | A URL string pointing to a playable audio file. |

**Response:**

```json
{
  "settings": {
    "action_bar": ["edit", "complete", "delete", "comment"],
    "realtime_transport": "sse",
    "detailed_status": true,
    "complete_sound_enabled": true,
    "complete_sound_url": "https://example.com/ding.mp3"
  }
}
```

The response always returns the full settings object after the update is applied.

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `401` | `"Unauthorized"` | Not logged in. |
| `400` | `"Invalid request"` | Malformed JSON or invalid field value. |
