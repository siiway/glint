# Cross-App Integration

Glint supports a delegation model where other OAuth applications can access Glint's data on behalf of their users — without any separate "app registration" in Glint itself. The entire authorization chain flows through Prism.

## How It Works

Glint is **App A** (the resource provider). Any other app is **App B** (the consumer). The flow relies on Prism's cross-app scope delegation:

```
app:<glint_client_id>:<inner_scope>
```

For example, if Glint's Prism client ID is `prism_abc123`, a read scope looks like:

```
app:prism_abc123:read_todos
```

### Full Authorization Flow

```mermaid
sequenceDiagram
  participant AppBOwner as App B developer
  participant Prism
  participant User
  participant Glint as Glint (App A)

  Note over Glint: Scopes defined in Prism<br/>by the Glint admin

  AppBOwner->>Prism: Register app:glint_id:read_todos<br/>in App B's allowed_scopes
  Note over Prism: Access rules checked (if any)

  User->>AppBOwner: Visits App B
  AppBOwner->>Prism: Authorization URL with scope
  Prism->>User: Consent screen showing Glint's scope title
  User->>Prism: Approves
  Prism->>AppBOwner: Authorization code
  AppBOwner->>Prism: Token exchange
  Prism-->>AppBOwner: Access token (includes scope)

  AppBOwner->>Glint: API request with Bearer token
  Glint->>Prism: Introspect token, verify scope
  Prism-->>Glint: active + scope confirmed
  Glint-->>AppBOwner: Todo data
```

**Nothing is registered inside Glint.** App B registers Glint's scope inside Prism's own dashboard, and users grant access via Prism's standard consent screen.

---

## Prerequisites

- A running Glint deployment with Prism OAuth configured
- Your Glint deployment's **Prism Client ID** (shown in Settings → App Config)
- Access to the Prism instance that Glint uses, with an App B OAuth client

---

## Step 1 — Define Scopes in Prism (Glint Admin)

A Glint owner must first define the permission scopes that App B can request. This is done directly in Prism's dashboard — not in Glint's UI.

Log in to Prism, open Glint's app settings, go to **Permissions**, and add scope definitions:

| Scope key       | Suggested title     | Description                                 |
| --------------- | ------------------- | ------------------------------------------- |
| `read_todos`    | Read todos          | View todo sets and todos in any joined team |
| `write_todos`   | Create & edit todos | Create and update todos                     |
| `delete_todos`  | Delete todos        | Delete todos                                |

You can define as many or as few scopes as your use case requires.

Optionally, set **access rules** to restrict which apps or users can register these scopes:

- `app_allow` — only specific App B `client_id`s may request your scopes
- `owner_allow` — only specific Prism user IDs may add your scopes to their app's `allowed_scopes`

Without any allow rules, all apps are permitted by default.

---

## Step 2 — Register the Scope in App B (App B Developer)

In **App B's** Prism dashboard → Settings → App Permissions, enter Glint's client ID and select the inner scope (e.g. `read_todos`). This adds:

```
app:prism_abc123:read_todos
```

to App B's `allowed_scopes`. This step is gated by any `owner_allow` rules Glint's admin may have set.

Alternatively, via API:

```bash
curl -X PATCH https://prism.example.com/api/apps/<appB_id> \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "allowed_scopes": [
      "openid", "profile",
      "app:prism_abc123:read_todos"
    ]
  }'
```

---

## Step 3 — Request the Scope in the Authorization URL

When App B redirects a user to Prism for login, include Glint's scope in the `scope` parameter:

```
https://prism.example.com/api/oauth/authorize
  ?client_id=<appB_client_id>
  &redirect_uri=https://appb.example.com/callback
  &response_type=code
  &scope=openid+profile+app%3Aprism_abc123%3Aread_todos
  &code_challenge=...
  &code_challenge_method=S256
```

The user will see a consent card in Prism showing Glint's scope title and description as defined in Step 1.

---

## Step 4 — Exchange the Code and Call Glint

After the user approves and you complete the standard token exchange, the resulting access token's `scope` field will include `app:prism_abc123:read_todos`.

Use it as a `Bearer` token when calling Glint:

```ts
const response = await fetch(
  `https://glint.example.com/api/cross-app/teams/${teamId}/sets`,
  {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  }
);
const { sets } = await response.json();
```

---

## Team Membership Resolution

Glint's cross-app endpoints are team-scoped. To serve a request, Glint must verify that the user (identified by the `sub` in the introspected token) is a member of the requested team.

Glint resolves team membership via two paths, in order:

1. **KV cache** (fast path) — populated whenever the user logs in to Glint directly. If the user has logged in to Glint at least once, their team memberships are cached for 1 hour in KV.
2. **Live Prism fetch** (fallback) — if the bearer token includes `teams:read` scope, Glint calls Prism's `/api/oauth/me/teams` in real time and caches the result.

If neither path succeeds, the request returns `403` with an explanatory message. In practice you can avoid this by including `teams:read` in App B's requested scopes alongside the Glint scope.

### Recommended Scope Set for App B

```
openid profile teams:read app:prism_abc123:read_todos
```

---

## App Token Warning in Glint UI

When a user logs in to Glint and Glint detects that the underlying access token was issued to an **external application** (i.e., the token's `client_id` differs from Glint's own `client_id`), Glint displays a modal warning:

> **Access via App Token** — This session was established using a token issued to an external application, not directly to you. If you did not expect this, sign out immediately.

The user can choose to continue or sign out. This is a security safeguard and should not appear under normal cross-app usage (where App B uses the token server-side and the user logs in to Glint separately through Glint's own flow).

---

## Available Scopes

| Scope key      | What it allows                                  |
| -------------- | ----------------------------------------------- |
| `read_todos`   | List sets and list todos in any joined team     |
| `write_todos`  | Create todos, update todo title and completion  |
| `delete_todos` | Delete todos                                    |

All operations still respect Glint's per-team permission rules. If the user's team role lacks a permission (e.g., `create_todos`), the API returns `403` even with a valid `write_todos` scope.

---

## Error Reference

| Status | Meaning                                                                          |
| ------ | -------------------------------------------------------------------------------- |
| `401`  | Missing or malformed `Authorization` header, or token is inactive/expired        |
| `403`  | Token is missing the required scope; or user is not a member of the team         |
| `403`  | Team membership unavailable (no KV cache and no `teams:read` in token scope)     |
| `404`  | Set or todo not found, or does not belong to the requested team                  |

---

## Security Notes

- Glint **always** verifies tokens via Prism's introspection endpoint — it never trusts the token payload directly.
- App B's `client_secret` is never involved; only the `client_id` identifies the scope namespace.
- If you want to restrict which apps can use Glint's scopes, set `app_allow` rules in Prism before publishing the `client_id` to integrators.
- Revoking a user's App B consent in Prism also removes their access to Glint's resources — no extra action needed.

---

## Full Example (TypeScript)

```ts
async function getGlintSets(
  accessToken: string,
  glintBaseUrl: string,
  teamId: string,
) {
  const res = await fetch(
    `${glintBaseUrl}/api/cross-app/teams/${teamId}/sets`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (res.status === 401) throw new Error("Token inactive or missing");
  if (res.status === 403) {
    const { error } = await res.json();
    throw new Error(`Forbidden: ${error}`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const { sets } = await res.json();
  return sets as Array<{ id: string; name: string }>;
}

async function createGlintTodo(
  accessToken: string,
  glintBaseUrl: string,
  teamId: string,
  setId: string,
  title: string,
) {
  const res = await fetch(
    `${glintBaseUrl}/api/cross-app/teams/${teamId}/sets/${setId}/todos`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    },
  );

  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(`Failed to create todo: ${error}`);
  }

  const { todo } = await res.json();
  return todo;
}
```
