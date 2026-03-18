# 身份验证 API

Glint 使用 Prism OAuth 2.0 进行身份验证，支持 PKCE（公开客户端）和机密客户端流程。会话存储在 Cloudflare KV 中。

## `GET /api/auth/config`

返回前端发起登录流程所需的 Prism OAuth 配置。无需身份验证。

**响应：**

```json
{
  "baseUrl": "https://id.siiway.com",
  "clientId": "prism_xxxxx",
  "redirectUri": "https://glint.example.com/callback",
  "usePkce": true
}
```

`usePkce` 标志告知前端是使用 PKCE（代码质询/验证器）还是使用带有服务端客户端密钥的标准授权码流程。

## `GET /api/auth/me`

返回当前已认证的用户，未登录时返回 `null`。

**响应：**

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

用 OAuth 授权码换取会话。设置一个 `httpOnly` 会话 Cookie。

**请求体：**

```json
{
  "code": "authorization-code",
  "codeVerifier": "pkce-code-verifier"
}
```

启用 PKCE 时需要 `codeVerifier`，机密客户端流程中省略（服务端使用存储的客户端密钥）。

**响应：** 与 `/api/auth/me` 格式相同。

如果配置了 `allowed_team_id` 且用户不是该团队的成员，则返回 `403`。

## `POST /api/auth/logout`

销毁当前会话并清除 Cookie。

**响应：**

```json
{ "ok": true }
```
