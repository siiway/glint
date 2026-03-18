# 配置

Glint 的所有配置都存储在 Cloudflare KV 中，并通过 Web 界面进行管理。无需环境变量。

## 应用配置

在初始化向导中或在**设置 > 应用配置**（仅所有者）中进行配置：

| 键                    | 说明                                                                 |
| --------------------- | -------------------------------------------------------------------- |
| `prism_base_url`      | Prism 实例的 URL（例如 `https://id.siiway.com`）                      |
| `prism_client_id`     | 来自 Prism 的 OAuth 客户端 ID                                        |
| `prism_client_secret` | OAuth 客户端密钥（仅用于机密客户端，PKCE 时留空）                      |
| `prism_redirect_uri`  | 部署的 OAuth 重定向 URI                                              |
| `use_pkce`            | 公开客户端（PKCE）设为 `true`，使用密钥的机密客户端设为 `false`          |
| `allowed_team_id`     | 如果设置，只有该 Prism 团队的成员才能登录                               |

存储在 KV 中的 `config:app` 键下。

## 团队设置

在**设置 > 品牌**中配置（所有者或拥有 `manage_settings` 权限的用户）：

| 键                 | 说明                                  |
| ------------------ | ------------------------------------- |
| `site_name`        | 显示在侧边栏、登录页面和浏览器标题中    |
| `site_logo_url`    | Logo 图片的 URL（替代文字标题）        |
| `accent_color`     | 自定义主题色（CSS 值）                 |
| `welcome_message`  | 在登录页面显示                        |
| `default_set_name` | 自动创建的默认待办集合的名称            |

存储在 KV 中的 `team_settings:{teamId}` 键下。

## 绑定

Worker 需要在 `wrangler.jsonc` 中配置两个 Cloudflare 绑定：

### D1 数据库（`DB`）

存储待办事项、待办集合、评论和权限。数据库模式通过 `migrations/` 目录中的迁移文件管理。

### KV 命名空间（`KV`）

用途：

- **应用配置** — `config:app`
- **团队设置** — `team_settings:{teamId}`
- **用户会话** — `session:{id}`
- **初始化状态** — `init:configured`
