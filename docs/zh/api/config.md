# 应用配置 API

应用级配置（Prism OAuth 设置、访问控制）。存储在 KV 中的 `config:app` 键下。

## `GET /api/init/status`

检查应用是否已初始化。

**响应：**

```json
{ "configured": true }
```

## `GET /api/init/branding`

公开端点（无需身份验证）。返回登录页面的站点名称和 Logo。

**响应：**

```json
{
  "site_name": "Glint",
  "site_logo_url": "https://example.com/logo.png"
}
```

## `GET /api/init/config`

返回当前应用配置。无需身份验证。

**响应：**

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

更新应用配置。初始化之前任何人都可以调用。初始化之后仅团队所有者可以更新。

**请求体（所有字段均为可选）：**

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

**响应：**

```json
{
  "config": { ... }
}
```

## `POST /api/init/setup`

首次设置。创建所有数据库表并可选保存应用配置。只能调用一次。

**请求体（可选）：**

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

**响应：**

```json
{ "ok": true }
```

如果已配置，则返回 `400`。
