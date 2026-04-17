# 认证 API

Glint 使用 Prism OAuth 2.0 进行身份验证，支持两种客户端流程：

- **PKCE（公开客户端）**——前端生成 code verifier/challenge 对，client secret 不会暴露给浏览器。推荐用于单页应用（SPA）。
- **机密客户端**——服务端保存 `client_secret` 并直接完成授权码交换，前端不接触 secret。

会话以 JSON 对象的形式存储在 Cloudflare KV 中（`session:{uuid}`），TTL 可配置（默认 24 小时）。会话 ID 存储在名为 `session` 的 `httpOnly`、`Secure`、`SameSite=Lax` Cookie 中。

---

## `GET /api/auth/config`

返回前端发起登录流程所需的 Prism OAuth 配置。无需身份验证，始终公开。

**响应 `200`：**

```json
{
  "baseUrl": "https://id.siiway.com",
  "clientId": "prism_abc123",
  "redirectUri": "https://glint.example.com/callback",
  "usePkce": true
}
```

| 字段          | 说明                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| `baseUrl`     | Prism 实例的 URL，用于构造授权和 Token 接口地址                               |
| `clientId`    | 在 Prism 中注册的 OAuth Client ID                                             |
| `redirectUri` | Prism 发送授权码的回调 URL                                                    |
| `usePkce`     | `true` → 使用 PKCE（code challenge + verifier）；`false` → 机密客户端模式    |

前端根据 `usePkce` 决定重定向至 Prism 前是否生成 PKCE challenge。若为 `false`，则省略 code verifier，服务端在授权码交换时使用存储的 `client_secret`。

---

## `GET /api/auth/me`

从 session Cookie 中返回当前已认证的用户，未登录时返回 `null`。

**响应 `200`（已认证）：**

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

**响应 `200`（未认证）：**

```json
{ "user": null }
```

若 KV 中找不到会话或会话已过期，Cookie 会被自动清除。

### 会话续期

若会话距过期时间不足 **30 分钟**，会自动延长 24 小时，并刷新 Cookie 的 `Max-Age`。此操作在每次 `/api/auth/me` 调用时自动完成，对调用方透明。

### `isAppToken` 字段

当 `isAppToken` 为 `true` 时，表示会话中存储的 access token 是由**外部应用**颁发的，而非用户通过 Glint 自身的 OAuth 流程直接获取的。具体判断方式为：Prism 在登录时返回的 token 的 `client_id` 与 Glint 自身配置的 `prism_client_id` 不匹配。

Glint 前端在该标志为 `true` 时会显示一个警告弹窗，允许用户在未预期此状态时立即退出登录。

---

## `POST /api/auth/callback`

用 OAuth 授权码换取用户会话，成功后设置 session Cookie。

**请求体：**

```json
{
  "code": "来自 Prism 的授权码",
  "codeVerifier": "重定向前生成并保存的 PKCE verifier"
}
```

| 字段           | 是否必填       | 说明                                                                       |
| -------------- | -------------- | -------------------------------------------------------------------------- |
| `code`         | 始终必填       | Prism 重定向到 `/callback` 时的 `code` 参数                               |
| `codeVerifier` | 仅 PKCE 必填   | 重定向前生成的 code verifier，机密客户端可省略                             |

**成功响应 `200`：**

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

响应格式与 `/api/auth/me` 完全一致。

**错误响应：**

| 状态码 | 响应体                                              | 原因                                                        |
| ------ | --------------------------------------------------- | ----------------------------------------------------------- |
| `401`  | `{"error":"Token exchange failed"}`                 | Prism 拒绝了授权码（已过期、verifier 错误、客户端不匹配）  |
| `403`  | `{"error":"You are not a member of any allowed team"}` | 已配置 `allowed_team_id` 但用户不在该团队中              |

### 回调处理流程

1. **授权码交换** — 调用 Prism 的 `/api/oauth/token`，传入授权码（PKCE 时附带 code verifier）。
2. **获取用户信息** — 调用 Prism 的 `/api/oauth/userinfo`，获取 `sub`、`preferred_username`、`name`、`picture`。
3. **获取团队列表** — 调用 Prism 的 `/api/oauth/me/teams`（需要 `teams:read` scope）获取团队成员关系和角色。
4. **访问控制** — 若配置了 `allowed_team_id`，验证用户是否属于至少一个允许的团队。
5. **Token Introspect** — 调用 Prism 的 `/api/oauth/introspect` 检查 token 的 `client_id`，若与 Glint 自身的 client ID 不符则将 `isAppToken` 设为 `true`。
6. **创建会话** — 将会话对象存入 KV，TTL 取 `session_ttl` 配置或 token 的 `expires_in` 中较大值。
7. **团队缓存** — 将用户的团队成员关系存入 KV（`user-teams:{userId}`，TTL 1 小时），供跨应用 Bearer Token 认证使用。
8. **设置 Cookie** — 设置 `session` Cookie，属性为 `httpOnly`、`Secure`、`SameSite=Lax`，`Max-Age` 与会话 TTL 一致。

---

## `POST /api/auth/logout`

销毁当前会话并清除 session Cookie。

**响应 `200`：**

```json
{ "ok": true }
```

会话从 KV 中删除，`session` Cookie 被清除。即使未登录也可安全调用。

---

## 会话存储结构

会话以 JSON 格式存储在 KV 的 `session:{uuid}` 键下：

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

每次请求都会检查 `expiresAt` 字段。KV 还会自动在 `expirationTtl` 到期后清除会话，即使未显式删除。

---

## 旧版代理 URL 迁移

旧版会话可能以代理格式（`/api/auth/avatar?url=...`）存储头像 URL。`/api/auth/me` 接口在读取时会自动解包这些 URL，用户无需重新登录。
