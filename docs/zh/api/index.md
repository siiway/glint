# API 参考

Glint 在 Cloudflare Worker 上提供 REST API。大多数端点需要通过会话 Cookie 进行身份验证。

## 基础 URL

所有端点路径相对于 Worker 源（例如 `https://glint.your-domain.com`）。

## 身份验证

身份验证通过 Prism OAuth 2.0 处理（支持 PKCE 和机密客户端）。会话存储在 KV 中，并通过 `httpOnly` Session Cookie 进行追踪。详见[身份验证](./auth)。

跨应用访问（来自其他应用的 Bearer 令牌）通过 `Authorization: Bearer <token>` 请求头处理。详见[跨应用集成](./cross-app)。

## 通用错误格式

所有错误响应返回 JSON：

```json
{ "error": "错误描述" }
```

## 常见状态码

| 状态码 | 含义 |
| --- | --- |
| `200` | 成功 |
| `201` | 已创建（POST 创建新资源时返回） |
| `400` | 请求无效（缺少必填字段、格式错误等） |
| `401` | 未授权（未登录） |
| `403` | 禁止访问（已登录但权限不足） |
| `404` | 未找到（资源不存在） |
| `409` | 冲突（例如重复创建） |
| `500` | 服务器内部错误 |

---

## 端点列表

### 初始化与配置

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/init/status` | 检查应用是否已初始化 |
| `GET` | `/api/init/branding` | 公开接口：获取站点名称和 Logo |
| `GET` | `/api/init/config` | 获取应用配置（Prism OAuth 设置） |
| `PUT` | `/api/init/config` | 更新应用配置（初始化后仅所有者可操作） |
| `POST` | `/api/init/setup` | 执行首次设置（创建数据库表并保存配置） |

### 身份验证

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/auth/config` | 获取前端所需的 Prism OAuth 配置 |
| `GET` | `/api/auth/me` | 获取当前用户（未登录时返回 `null`） |
| `POST` | `/api/auth/callback` | 用 OAuth 授权码换取会话 |
| `POST` | `/api/auth/logout` | 销毁当前会话 |

### 用户设置

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/user/settings` | 获取用户偏好（操作栏、实时传输方式） |
| `PUT` | `/api/user/settings` | 更新用户偏好 |

### 团队设置

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/teams/:teamId/settings` | 获取团队设置（品牌和行为配置） |
| `PATCH` | `/api/teams/:teamId/settings` | 更新团队设置 |

### 权限

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/teams/:teamId/permissions` | 获取完整权限矩阵（默认值、全局覆盖、按分组覆盖） |
| `GET` | `/api/teams/:teamId/permissions/me` | 获取当前用户的有效权限 |
| `PUT` | `/api/teams/:teamId/permissions` | 批量更新某个范围的权限 |
| `DELETE` | `/api/teams/:teamId/permissions` | 重置某个范围的权限为默认值 |

### 待办分组

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/teams/:teamId/sets` | 列出所有分组（若无则自动创建默认分组） |
| `POST` | `/api/teams/:teamId/sets` | 创建新分组 |
| `PATCH` | `/api/teams/:teamId/sets/:setId` | 重命名分组或修改选项 |
| `DELETE` | `/api/teams/:teamId/sets/:setId` | 删除分组及其所有待办事项 |
| `POST` | `/api/teams/:teamId/sets/reorder` | 批量更新分组排序 |

### 待办事项

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/teams/:teamId/sets/:setId/todos` | 列出分组中的所有待办事项 |
| `POST` | `/api/teams/:teamId/sets/:setId/todos` | 创建待办事项（或子待办） |
| `PATCH` | `/api/teams/:teamId/todos/:id` | 更新待办事项（标题、完成状态、排序） |
| `DELETE` | `/api/teams/:teamId/todos/:id` | 删除待办事项（级联删除子待办） |
| `POST` | `/api/teams/:teamId/todos/reorder` | 批量更新待办事项排序 |

### 评论

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/teams/:teamId/todos/:todoId/comments` | 列出待办事项的所有评论 |
| `POST` | `/api/teams/:teamId/todos/:todoId/comments` | 添加评论 |
| `DELETE` | `/api/teams/:teamId/todos/:todoId/comments/:commentId` | 删除评论 |

### 跨应用访问

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/cross-app/teams` | 列出令牌持有者可访问的团队 |
| `GET` | `/api/cross-app/teams/:teamId/sets` | 列出分组（需要相应的跨应用 scope） |
| `GET` | `/api/cross-app/teams/:teamId/sets/:setId/todos` | 列出待办事项（需要相应的跨应用 scope） |
| `POST` | `/api/cross-app/teams/:teamId/sets/:setId/todos` | 创建待办事项（需要相应的跨应用 scope） |
| `PATCH` | `/api/cross-app/teams/:teamId/todos/:id` | 更新待办事项（需要相应的跨应用 scope） |
