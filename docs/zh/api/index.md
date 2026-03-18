# API 参考

Glint 在 Cloudflare Worker 上提供 REST API。大多数端点需要通过会话 Cookie 进行身份验证。

## 基础 URL

所有端点相对于 Worker 源（例如 `https://glint.your-domain.com`）。

## 身份验证

身份验证通过 Prism OAuth 2.0 和 PKCE 处理。会话存储在 KV 中，并通过 `httpOnly` Cookie 进行跟踪。详见[身份验证](./auth)。

## 端点

### 初始化与配置

- `GET /api/init/status` — 检查应用是否已初始化
- `POST /api/init/setup` — 执行首次设置（创建数据库表、保存配置）
- `GET /api/init/branding` — 公开接口：获取站点名称和 Logo
- `GET /api/init/config` — 获取应用配置（Prism 设置）
- `PUT /api/init/config` — 更新应用配置（初始化后仅所有者可操作）

### 身份验证

- `GET /api/auth/config` — 获取前端所需的 Prism OAuth 配置
- `GET /api/auth/me` — 获取当前用户（未登录时返回 `null`）
- `POST /api/auth/callback` — 用 OAuth 授权码换取会话
- `POST /api/auth/logout` — 销毁会话

### 团队设置

- `GET /api/teams/:teamId/settings` — 获取团队设置（品牌）
- `PATCH /api/teams/:teamId/settings` — 更新团队设置

### 权限

- `GET /api/teams/:teamId/permissions` — 获取完整权限矩阵
- `GET /api/teams/:teamId/permissions/me` — 获取当前用户的有效权限
- `PUT /api/teams/:teamId/permissions` — 批量更新权限
- `DELETE /api/teams/:teamId/permissions` — 重置某范围的权限

### 待办集合

- `GET /api/teams/:teamId/sets` — 列出集合
- `POST /api/teams/:teamId/sets` — 创建集合
- `PATCH /api/teams/:teamId/sets/:setId` — 重命名集合
- `DELETE /api/teams/:teamId/sets/:setId` — 删除集合
- `POST /api/teams/:teamId/sets/reorder` — 重新排序集合

### 待办事项

- `GET /api/teams/:teamId/sets/:setId/todos` — 列出集合中的待办事项
- `POST /api/teams/:teamId/sets/:setId/todos` — 创建待办事项（或子待办）
- `PATCH /api/teams/:teamId/todos/:id` — 更新待办事项
- `DELETE /api/teams/:teamId/todos/:id` — 删除待办事项
- `POST /api/teams/:teamId/todos/reorder` — 重新排序待办事项

### 评论

- `GET /api/teams/:teamId/todos/:todoId/comments` — 列出评论
- `POST /api/teams/:teamId/todos/:todoId/comments` — 添加评论
- `DELETE /api/teams/:teamId/todos/:todoId/comments/:commentId` — 删除评论

## 错误响应

所有错误返回 JSON：

```json
{ "error": "Description of the error" }
```

常见状态码：`400`（错误请求）、`401`（未授权）、`403`（禁止访问）、`404`（未找到）。
