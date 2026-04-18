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
    "realtime_transport": "auto"
  }
}
```

| Field | Type | Description |
| --- | --- | --- |
| `action_bar` | `string[] \| null` | Custom order of quick-action buttons on each todo. `null` means use workspace or site default. |
| `realtime_transport` | `"ws" \| "sse" \| "auto"` | Preferred sync transport for realtime updates. `"auto"` attempts WebSocket, falls back to SSE. Default: `"auto"`. |

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
  "realtime_transport": "sse"
}
```

**Field constraints:**

| Field | Constraint |
| --- | --- |
| `action_bar` | Array of valid action keys: `add_before`, `add_after`, `add_subtodo`, `edit`, `complete`, `claim`, `comment`, `delete`. Pass `null` to reset to workspace/site default. |
| `realtime_transport` | One of: `"ws"`, `"sse"`, `"auto"`. |

**Response:**

```json
{
  "settings": {
    "action_bar": ["edit", "complete", "delete", "comment"],
    "realtime_transport": "sse"
  }
}
```

The response always returns the full settings object after the update is applied.

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `401` | `"Unauthorized"` | Not logged in. |
| `400` | `"Invalid request"` | Malformed JSON or invalid field value. |
