# 配置

Glint 的所有配置都存储在 Cloudflare KV 中，并通过 Web 界面或环境变量进行管理。无需 `.env` 文件——初始化向导在首次运行时直接将配置写入 KV，后续修改通过设置页面完成。

---

## 应用配置

在初始化向导中或在**设置 → 应用配置**（设置完成后仅所有者可访问）中进行配置。

| 键 | 说明 |
| --- | --- |
| `prism_base_url` | Prism 实例的根 URL，例如 `https://id.example.com`。末尾不加斜杠。 |
| `prism_client_id` | 来自 Prism 应用注册的 OAuth 客户端 ID。 |
| `prism_client_secret` | OAuth 客户端密钥。仅机密客户端需要。使用 PKCE 时留空。 |
| `prism_redirect_uri` | Prism 应用中注册的回调 URL，例如 `https://glint.example.com/callback`。必须完全匹配。 |
| `use_pkce` | 公开（PKCE）客户端设为 `true`；机密（密钥）客户端设为 `false`。 |
| `allowed_team_id` | 将登录限制为特定 Prism 团队的成员。留空则允许任何已认证的 Prism 用户登录。 |

所有值存储在 KV 键 `config:app` 下的 JSON 对象中。

::: warning
`prism_client_secret` 存储在 KV 中，而非环境变量。请确保你的 KV 命名空间不对外公开。在 Cloudflare 的安全模型中，KV 绑定只能由你的 Worker 访问——它们不会通过任何公共 API 暴露。
:::

### PKCE 与机密客户端对比

| | PKCE（公开） | 机密 |
| --- | --- | --- |
| `use_pkce` | `true` | `false` |
| `prism_client_secret` | 空 | 必须填写 |
| 令牌交换方式 | 授权码 + PKCE 验证器 | 授权码 + 客户端密钥 |
| 安全模型 | 验证器保存在 Worker 中 | 密钥保存在 Worker 中，永不暴露给浏览器 |
| 适用场景 | 大多数部署 | 高安全性私有部署 |

部署在 Cloudflare Workers 上时，两种模式同样安全——PKCE 验证器和客户端密钥都在服务端处理，不会暴露给浏览器。

### `allowed_team_id`

设置后，Glint 在登录时评估团队成员关系。不属于指定团队的用户会看到"未授权"页面，无法继续操作。

可配置多个团队 ID，用逗号、分号或空格分隔：

```
team_a, team_b, team_c
```

::: tip
通过**`ALLOWED_TEAM_ID` 环境变量**（在 `wrangler.jsonc` 或 Cloudflare 控制台中设置）指定的值会覆盖 KV 中存储的值，且无法通过 UI 修改。当环境变量生效时，设置页面会显示"已锁定"提示。
:::

---

## 团队设置

按团队配置的品牌和行为，在**设置 → 品牌**中配置（所有者或拥有 `manage_settings` 权限的用户）。

| 键 | 说明 |
| --- | --- |
| `site_name` | 显示在侧边栏标题、浏览器标签页标题和登录页面中的名称。 |
| `site_logo_url` | Logo 图片的 URL。设置后替代侧边栏中的文字标题。必须可公开访问。 |
| `accent_color` | 作为主题色应用的 CSS 颜色值（十六进制、`rgb()` 等）。留空则使用默认主题色。 |
| `welcome_message` | 登录页面应用名称下方显示的简短文字。可选。 |
| `default_set_name` | 首次访问团队时自动创建的分组名称。默认值：`"Not Grouped"`（未分组）。 |

团队设置存储在 KV 键 `team_settings:{teamId}` 下。

---

## Cloudflare 绑定

`wrangler.jsonc` 中必须声明两个绑定：

### D1 数据库（`DB`）

存储所有持久化数据：待办事项、分组、评论和权限覆盖。

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "glint-db",
      "database_id": "YOUR_DATABASE_ID"
    }
  ]
}
```

数据库模式通过 `migrations/` 目录中的编号迁移文件管理。执行迁移：

```bash
# 本地开发
wrangler d1 migrations apply glint-db --local

# 生产环境
wrangler d1 migrations apply glint-db
```

迁移使用 `CREATE TABLE IF NOT EXISTS`，幂等安全——重复执行不会丢失数据。

### KV 命名空间（`KV`）

用于会话、配置、团队设置和用户团队缓存。

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "YOUR_KV_ID",
      "preview_id": "YOUR_KV_PREVIEW_ID"
    }
  ]
}
```

`preview_id` 是 `wrangler dev`（本地开发）所必需的。创建方式：

```bash
wrangler kv namespace create KV --preview
```

---

## KV 键参考

| 键模式 | 内容 | TTL |
| --- | --- | --- |
| `init:configured` | 设置完成后为 `"1"` | 无（永久） |
| `config:app` | 包含所有应用配置字段的 JSON 对象 | 无（永久） |
| `team_settings:{teamId}` | 包含品牌/设置的 JSON 对象 | 无（永久） |
| `session:{sessionId}` | 包含访问令牌的 JSON 会话数据 | 设置为令牌过期时间 |
| `user-teams:{userId}` | `TeamInfo` 对象的 JSON 数组 | 10 分钟 |

`user-teams` 缓存在登录时写入，由跨应用中间件使用，无需实时调用 Prism API 即可解析团队成员关系。缓存 10 分钟后过期；若缺失，中间件会回退到实时查询。

---

## 环境变量

只有一个可选环境变量：

| 变量 | 用途 |
| --- | --- |
| `ALLOWED_TEAM_ID` | 覆盖 `config:app.allowed_team_id`。设置后无法通过 UI 修改。 |

在 `wrangler.jsonc` 中设置：

```jsonc
{
  "vars": {
    "ALLOWED_TEAM_ID": "your-prism-team-uuid"
  }
}
```

或在 Cloudflare 控制台中：**Workers → 你的 Worker → 设置 → 变量**。

---

## 重置配置

在本地开发时，清空初始化状态并重新运行向导：

```bash
wrangler kv key delete --local --binding KV "init:configured"
```

这将允许重新调用 `POST /api/init/setup`。表使用 `IF NOT EXISTS` 重建，现有数据得以保留。

在生产环境中重置，需从生产 KV 命名空间删除 `init:configured`：

```bash
wrangler kv key delete --binding KV "init:configured"
```

::: warning
在生产环境中重新初始化**不会清空数据库**。它只允许覆盖配置。待办事项、分组和评论均完好保留。
:::
