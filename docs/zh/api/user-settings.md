# 用户设置 API

个人偏好设置，每个用户存储在 KV 中的 `user_settings:{userId}` 键下。所有端点需要身份验证。

---

## `GET /api/user/settings`

获取当前用户的偏好设置。

**需要身份验证：** 是 — 已认证会话

**响应：**

```json
{
  "settings": {
    "action_bar": ["add_after", "edit", "complete", "delete"],
    "realtime_transport": "auto",
    "workspace_favicon": true,
    "detailed_status": false,
    "personal_avatar_icon": true,
    "complete_sound_enabled": false,
    "complete_sound_url": ""
  }
}
```

如果用户从未保存过任何偏好，则返回空对象（`{}`），客户端将应用其内置默认值。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `action_bar` | `string[] \| null` | 每个待办事项的快捷操作按钮的自定义顺序。`null` 表示使用工作区或站点默认值。 |
| `realtime_transport` | `"ws" \| "sse" \| "auto"` | 实时更新的首选同步传输方式。`"auto"` 尝试 WebSocket，失败时回退到 SSE。默认值：`"auto"`。 |
| `workspace_favicon` | boolean | 为 `true` 时，浏览器图标跟随当前选中工作区的图标。 |
| `detailed_status` | boolean | 为 `true` 时，在页面标题栏显示已完成/剩余的数量。 |
| `personal_avatar_icon` | boolean | 为 `true` 时，使用用户的个人头像作为个人工作区的图标/浏览器图标。 |
| `complete_sound_enabled` | boolean | 为 `true` 时，待办事项标记为完成时播放声音。 |
| `complete_sound_url` | string | 完成时播放的声音文件 URL。 |

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `401` | `"Unauthorized"` | 未登录。 |

---

## `PUT /api/user/settings`

更新一个或多个用户偏好字段。仅更新提供的字段，未提供的字段保持不变。

**需要身份验证：** 是 — 已认证会话

**请求体**（所有字段均为可选）：

```json
{
  "action_bar": ["edit", "complete", "delete", "comment"],
  "realtime_transport": "sse",
  "detailed_status": true,
  "complete_sound_enabled": true,
  "complete_sound_url": "https://example.com/ding.mp3"
}
```

只有可识别的键会被持久化；请求体中的未知键将被忽略。

**字段约束：**

| 字段 | 约束 |
| --- | --- |
| `action_bar` | 有效操作键的数组：`add_before`、`add_after`、`add_subtodo`、`edit`、`complete`、`claim`、`comment`、`delete`。传递 `null` 以重置为工作区/站点默认值。 |
| `realtime_transport` | 其中之一：`"ws"`、`"sse"`、`"auto"`。 |
| `workspace_favicon` | 布尔值。 |
| `detailed_status` | 布尔值。 |
| `personal_avatar_icon` | 布尔值。 |
| `complete_sound_enabled` | 布尔值。 |
| `complete_sound_url` | 指向可播放音频文件的 URL 字符串。 |

**响应：**

```json
{
  "settings": {
    "action_bar": ["edit", "complete", "delete", "comment"],
    "realtime_transport": "sse",
    "detailed_status": true,
    "complete_sound_enabled": true,
    "complete_sound_url": "https://example.com/ding.mp3"
  }
}
```

响应始终返回更新后的完整设置对象。

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `401` | `"Unauthorized"` | 未登录。 |
| `400` | `"Invalid request"` | JSON 格式错误或字段值无效。 |
