# Authentication API

Glint uses Prism OAuth 2.0 for authentication. Two client flows are supported:

- **PKCE (public client)** — the frontend generates a code verifier/challenge pair. No client secret is ever sent to the browser. Recommended for SPAs.
- **Confidential client** — the server holds a `client_secret` and exchanges codes directly. The frontend never sees the secret.

Sessions are stored as JSON objects in Cloudflare KV (`session:{uuid}`) with a configurable TTL (default: 24 hours). The session ID is stored in an `httpOnly`, `Secure`, `SameSite=Lax` cookie named `session`.

---

## `GET /api/auth/config`

Returns the Prism OAuth configuration that the frontend needs to initiate the login flow. No authentication required — this endpoint is always public.

**Response `200`:**

```json
{
  "baseUrl": "https://id.siiway.com",
  "clientId": "prism_abc123",
  "redirectUri": "https://glint.example.com/callback",
  "usePkce": true
}
```

| Field         | Description                                                                     |
| ------------- | ------------------------------------------------------------------------------- |
| `baseUrl`     | The Prism instance URL. Used to build the authorization and token endpoints.    |
| `clientId`    | The OAuth client ID registered in Prism.                                        |
| `redirectUri` | The callback URL where Prism sends the authorization code.                      |
| `usePkce`     | `true` → use PKCE (code challenge + verifier). `false` → confidential client.  |

The frontend uses `usePkce` to decide whether to generate a PKCE challenge before redirecting to Prism. When `false`, the code verifier is omitted and the server uses the stored `client_secret` during code exchange.

---

## `GET /api/auth/me`

Returns the currently authenticated user from the session cookie, or `null` if not logged in.

**Response `200` (authenticated):**

```json
{
  "user": {
    "id": "65014c37bd41f58abf06cdac3f37e3c5",
    "username": "alice",
    "displayName": "Alice Smith",
    "avatarUrl": "https://assets.example.com/avatar.png",
    "teams": [
      {
        "id": "63d4761c78c2dec09a002233e1b7c06c",
        "name": "SiiWay Team",
        "role": "owner",
        "avatarUrl": "https://assets.example.com/team.png"
      }
    ],
    "isAppToken": false
  }
}
```

**Response `200` (not authenticated):**

```json
{ "user": null }
```

The cookie is cleared if the session is not found in KV or is expired.

### Session Renewal

If the session is within **30 minutes** of expiring, it is automatically extended by 24 hours and the cookie's `Max-Age` is refreshed. This happens transparently on every `/api/auth/me` call.

### `isAppToken` Flag

When `isAppToken` is `true`, the access token stored in the session was issued to an **external application** rather than directly to the user through Glint's own OAuth flow. This happens when the token's `client_id` (from Prism introspection at login time) does not match Glint's own configured `prism_client_id`.

The Glint frontend displays a warning modal when this flag is `true`, allowing the user to sign out if they did not expect this state.

---

## `POST /api/auth/callback`

Exchanges an OAuth authorization code for a user session. Sets a session cookie on success.

**Request body:**

```json
{
  "code": "the-authorization-code-from-prism",
  "codeVerifier": "the-pkce-verifier-you-stored-before-redirect"
}
```

| Field          | Required       | Description                                                          |
| -------------- | -------------- | -------------------------------------------------------------------- |
| `code`         | Always         | The `code` parameter from Prism's redirect to `/callback`            |
| `codeVerifier` | PKCE only      | The code verifier generated before the redirect. Omit for confidential clients. |

**Successful response `200`:**

```json
{
  "user": {
    "id": "...",
    "username": "alice",
    "displayName": "Alice Smith",
    "avatarUrl": "https://...",
    "teams": [...],
    "isAppToken": false
  }
}
```

The response shape is identical to `/api/auth/me`.

**Error responses:**

| Status | Body                                         | Cause                                                              |
| ------ | -------------------------------------------- | ------------------------------------------------------------------ |
| `401`  | `{"error":"Token exchange failed"}`          | Prism rejected the code (expired, wrong verifier, wrong client)    |
| `403`  | `{"error":"You are not a member of any allowed team"}` | `allowed_team_id` is set and the user is not in that team |

### What Happens During Callback

1. **Code exchange** — Calls Prism's `/api/oauth/token` with the authorization code (and code verifier if PKCE).
2. **User info** — Calls Prism's `/api/oauth/userinfo` to get the user's profile (`sub`, `preferred_username`, `name`, `picture`).
3. **Team fetch** — Calls Prism's `/api/oauth/me/teams` (requires `teams:read` scope) to get team memberships and roles.
4. **Access control** — If `allowed_team_id` is configured, verifies the user belongs to at least one allowed team.
5. **Token introspection** — Calls Prism's `/api/oauth/introspect` to check the token's `client_id`. Sets `isAppToken: true` if it differs from Glint's own client ID.
6. **Session creation** — Stores a session object in KV with a TTL derived from `session_ttl` config or the token's `expires_in`.
7. **Team cache** — Stores the user's team memberships in KV (`user-teams:{userId}`, TTL 1 hour) for use by cross-app bearer token auth.
8. **Cookie** — Sets the `session` cookie with `httpOnly`, `Secure`, `SameSite=Lax`, and `Max-Age` matching the session TTL.

---

## `POST /api/auth/logout`

Destroys the current session and clears the session cookie.

**Response `200`:**

```json
{ "ok": true }
```

The session is deleted from KV and the `session` cookie is cleared. This endpoint is always safe to call even if not logged in.

---

## Session Storage

Sessions are stored in KV as JSON under `session:{uuid}`:

```json
{
  "userId": "...",
  "username": "alice",
  "displayName": "Alice Smith",
  "avatarUrl": "https://...",
  "accessToken": "prism-access-token",
  "expiresAt": 1744000000000,
  "teams": [{ "id": "...", "name": "...", "role": "owner", "avatarUrl": "..." }],
  "isAppToken": false
}
```

The `expiresAt` field is checked on every request. Sessions are also given a KV `expirationTtl` so they are automatically purged even if never explicitly deleted.

---

## Legacy Avatar URL Migration

Old sessions may store avatar URLs in a proxy format (`/api/auth/avatar?url=...`). The `/api/auth/me` endpoint transparently unwraps these at read time so users do not need to re-login after the proxy was removed.
