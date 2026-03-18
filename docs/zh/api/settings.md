# 团队设置 API

团队专属的品牌和配置。存储在 KV 中的 `team_settings:{teamId}` 键下。

## `GET /api/teams/:teamId/settings`

获取团队设置。需要团队成员身份。

**响应：**

```json
{
  "settings": {
    "site_name": "Glint",
    "site_logo_url": "",
    "accent_color": "",
    "welcome_message": "",
    "default_set_name": "Not Grouped",
    "allow_member_create_sets": false
  }
}
```

## `PATCH /api/teams/:teamId/settings`

更新团队设置。需要 `manage_settings` 权限。

**请求体（所有字段均为可选）：**

```json
{
  "site_name": "My Team Todos",
  "site_logo_url": "https://example.com/logo.png",
  "accent_color": "#0078d4",
  "welcome_message": "Welcome!",
  "default_set_name": "Inbox"
}
```

**响应：**

```json
{
  "settings": { ... }
}
```
