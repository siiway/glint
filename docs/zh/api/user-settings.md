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
    "realtime_transport": "auto"
  }
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `action_bar` | `string[] \| null` | 每个待办事项的快捷操作按钮的自定义顺序。`null` 表示使用工作区或站点默认值。 |
| `realtime_transport` | `"ws" \| "sse" \| "auto"` | 实时更新的首选同步传输方式。`"auto"` 尝试 WebSocket，失败时回退到 SSE。默认值：`"auto"`。 |

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
  "realtime_transport": "sse"
}
```

**字段约束：**

| 字段 | 约束 |
| --- | --- |
| `action_bar` | 有效操作键的数组：`add_before`、`add_after`、`add_subtodo`、`edit`、`complete`、`claim`、`comment`、`delete`。传递 `null` 以重置为工作区/站点默认值。 |
| `realtime_transport` | 其中之一：`"ws"`、`"sse"`、`"auto"`。 |

**响应：**

```json
{
  "settings": {
    "action_bar": ["edit", "complete", "delete", "comment"],
    "realtime_transport": "sse"
  }
}
```

响应始终返回更新后的完整设置对象。

**错误响应：**

| 状态码 | `error` | 原因 |
| --- | --- | --- |
| `401` | `"Unauthorized"` | 未登录。 |
| `400` | `"Invalid request"` | JSON 格式错误或字段值无效。 |
