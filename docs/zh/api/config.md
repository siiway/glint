# 应用配置 API

应用级配置：Prism OAuth 设置和访问控制。存储在 KV 中的 `config:app` 键下。

本节所有端点在初始化**之前**均可无需身份验证访问。初始化之后，写入端点（`PUT /api/init/config`）需要所有者权限。

---

## `GET /api/init/status`

检查应用是否已完成初始化。前端用此端点判断是否显示初始化向导。

**需要身份验证：** 否

**响应：**

```json
{ "configured": true }
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `configured` | boolean | 若 `POST /api/init/setup` 已成功调用过至少一次，则为 `true`。 |

---

## `GET /api/init/branding`

公开端点（无需身份验证）。返回用于渲染登录页面的站点名称和 Logo URL，无需会话即可访问。

**需要身份验证：** 否

**响应：**

```json
{
  "site_name": "Glint",
  "site_logo_url": "https://example.com/logo.png"
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `site_name` | string | 来自团队设置的显示名称。若未设置，回退为 `"Glint"`。 |
| `site_logo_url` | string | Logo URL，若未配置 Logo 则为空字符串。 |

---

## `GET /api/init/config`

返回当前应用配置。`prism_client_secret` 字段始终以空字符串返回，避免通过 API 泄露密钥。

**需要身份验证：** 否

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

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `prism_base_url` | string | Prism OAuth 实例的根 URL。 |
| `prism_client_id` | string | 已注册的 OAuth 客户端 ID。 |
| `prism_client_secret` | string | 始终为 `""` — 密钥不会返回。 |
| `prism_redirect_uri` | string | OAuth 回调 URI。 |
| `use_pkce` | boolean | PKCE（公开）客户端为 `true`。 |
| `allowed_team_id` | string | 若设置，限制登录范围为该团队成员。若通过环境变量锁定，UI 中显示该值但不可修改。 |

---

## `PUT /api/init/config`

更新应用配置。初始化之前任何人均可调用；初始化之后仅团队所有者可更新。

**需要身份验证：** 所有者（初始化后）

**请求体**（所有字段均为可选——只有提供的字段才会被更新）：

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

::: tip
发送 `"prism_client_secret": ""` 可清除之前存储的密钥（例如从机密客户端切换到 PKCE 模式时）。
:::

**响应：**

```json
{
  "config": {
    "prism_base_url": "https://id.siiway.com",
    "prism_client_id": "prism_xxxxx",
    "prism_client_secret": "",
    "prism_redirect_uri": "https://glint.example.com/callback",
    "use_pkce": false,
    "allowed_team_id": "team-uuid"
  }
}
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `403` | `"Forbidden"` | 已认证但不是团队所有者。 |
| `401` | `"Unauthorized"` | 未登录，且应用已完成初始化。 |

---

## `POST /api/init/setup`

一次性初始化。使用 `CREATE TABLE IF NOT EXISTS` 创建所有数据库表，并将应用配置保存到 KV。在 KV 中设置 `init:configured` 标记初始化完成。

**需要身份验证：** 否（在首次登录前调用）

**请求体**（可选——配置可在此处提供，也可通过 `PUT /api/init/config` 单独提供）：

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

**响应（200）：**

```json
{ "ok": true }
```

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `400` | `"Already configured"` | 初始化已完成。从 KV 中删除 `init:configured` 可重新运行。 |

::: info
重新运行初始化是安全的——`CREATE TABLE IF NOT EXISTS` 意味着不会丢失数据。主要效果是覆盖存储的配置。详见[配置](../guide/configuration#重置配置)中关于如何触发重新运行的说明。
:::
