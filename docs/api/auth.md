# Authentication API

Glint uses Prism OAuth 2.0 for authentication, supporting both PKCE (public client) and confidential client flows. Sessions are stored in Cloudflare KV.

## `GET /api/auth/config`

Returns the Prism OAuth configuration for the frontend to initiate the login flow. No authentication required.

**Response:**

```json
{
  "baseUrl": "https://id.siiway.com",
  "clientId": "prism_xxxxx",
  "redirectUri": "https://glint.example.com/callback",
  "usePkce": true
}
```

The `usePkce` flag tells the frontend whether to use PKCE (code challenge/verifier) or the standard authorization code flow with a server-side client secret.

## `GET /api/auth/me`

Returns the current authenticated user, or `null` if not logged in.

**Response:**

```json
{
  "user": {
    "id": "user-uuid",
    "username": "alice",
    "displayName": "Alice",
    "avatarUrl": "https://...",
    "teams": [{ "id": "team-uuid", "name": "My Team", "role": "owner" }]
  }
}
```

## `POST /api/auth/callback`

Exchanges an OAuth authorization code for a session. Sets an `httpOnly` session cookie.

**Request body:**

```json
{
  "code": "authorization-code",
  "codeVerifier": "pkce-code-verifier"
}
```

`codeVerifier` is required when PKCE is enabled, and omitted for confidential client flow (the server uses the stored client secret instead).

**Response:** Same shape as `/api/auth/me`.

If `allowed_team_id` is configured and the user is not a member of that team, returns `403`.

## `POST /api/auth/logout`

Destroys the current session and clears the cookie.

**Response:**

```json
{ "ok": true }
```
