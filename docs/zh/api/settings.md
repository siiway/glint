# 团队设置 API

团队专属的品牌和配置。存储在 KV 中的 `team_settings:{teamId}` 键下。所有端点需要身份验证和团队成员身份。

---

## `GET /api/teams/:teamId/settings`

获取团队当前的品牌和配置设置。

**需要身份验证：** 是 — 团队成员

**路径参数：**

| 参数 | 说明 |
| --- | --- |
| `teamId` | Prism 团队 UUID，或个人工作区的 `personal:<userId>`。 |

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

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `site_name` | string | 显示在侧边栏和浏览器标题中。默认值：`"Glint"`。 |
| `site_logo_url` | string | Logo 图片 URL。为空则使用文字标题。 |
| `accent_color` | string | 主题色的 CSS 颜色值。为空则使用默认主题色。 |
| `welcome_message` | string | 登录页面显示的可选文字。 |
| `default_set_name` | string | 自动创建的首个分组名称。默认值：`"Not Grouped"`。 |
| `allow_member_create_sets` | boolean | 成员是否可以创建分组。为 `true` 时，成员仅在创建分组方面绕过 `manage_sets` 的默认限制。 |

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `401` | `"Unauthorized"` | 未登录。 |
| `403` | `"Forbidden"` | 已登录但不是该团队成员。 |

---

## `PATCH /api/teams/:teamId/settings`

更新一个或多个团队设置字段。仅更新提供的字段，未提供的字段保持不变。

**需要身份验证：** 是 — `manage_settings` 权限（或所有者 / 联合所有者）

**路径参数：**

| 参数 | 说明 |
| --- | --- |
| `teamId` | Prism 团队 UUID。 |

**请求体**（所有字段均为可选）：

```json
{
  "site_name": "我的团队待办",
  "site_logo_url": "https://cdn.example.com/logo.png",
  "accent_color": "#0078d4",
  "welcome_message": "登录以跟踪你的工作。",
  "default_set_name": "收件箱",
  "allow_member_create_sets": true
}
```

**字段约束：**

| 字段 | 约束 |
| --- | --- |
| `site_name` | 若提供，不能为空字符串。 |
| `site_logo_url` | 必须是有效 URL 或空字符串。Logo 由浏览器直接获取——必须可公开访问。 |
| `accent_color` | 任何 CSS 颜色值（`#hex`、`rgb()`、颜色名称等）或空字符串（重置为默认）。 |
| `welcome_message` | 任意字符串，或空字符串（清除）。 |
| `default_set_name` | 若提供，不能为空字符串。影响新建工作区；不会重命名已有分组。 |
| `allow_member_create_sets` | 布尔值。 |

**响应：**

```json
{
  "settings": {
    "site_name": "我的团队待办",
    "site_logo_url": "https://cdn.example.com/logo.png",
    "accent_color": "#0078d4",
    "welcome_message": "登录以跟踪你的工作。",
    "default_set_name": "收件箱",
    "allow_member_create_sets": true
  }
}
```

响应始终返回更新后的完整设置对象。

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `401` | `"Unauthorized"` | 未登录。 |
| `403` | `"Forbidden"` | 已登录但缺少 `manage_settings` 权限（且不是所有者 / 联合所有者）。 |
| `400` | `"Invalid request"` | JSON 格式错误或字段值无效。 |
