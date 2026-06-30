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
| `POST` | `/api/init/register-permissions` | 将 Glint 的权限作用域注册到 Prism |

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
| `GET` | `/api/user/settings` | 获取用户偏好（操作栏、传输方式、界面） |
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
| `PATCH` | `/api/teams/:teamId/sets/:setId` | 重命名 / 设置自动续期及选项（`manage_sets` 或所有者） |
| `DELETE` | `/api/teams/:teamId/sets/:setId` | 删除分组及其所有待办事项 |
| `POST` | `/api/teams/:teamId/sets/reorder` | 批量更新分组排序 |
| `GET` | `/api/teams/:teamId/sets/:setId/export` | 将分组导出为 Markdown / JSON / YAML（`view_todos`） |
| `POST` | `/api/teams/:teamId/sets/:setId/import` | 将待办事项导入分组（`create_todos`） |
| `POST` | `/api/teams/:teamId/sets/import` | 将内容作为新分组导入（`manage_sets`） |

### 待办事项

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/teams/:teamId/sets/:setId/todos` | 列出分组中的所有待办事项 |
| `POST` | `/api/teams/:teamId/sets/:setId/todos` | 创建待办事项（或子待办） |
| `PATCH` | `/api/teams/:teamId/todos/:id` | 更新待办事项（标题、完成状态、排序） |
| `DELETE` | `/api/teams/:teamId/todos/:id` | 删除待办事项（级联删除子待办） |
| `POST` | `/api/teams/:teamId/todos/reorder` | 批量更新待办事项排序 |
| `POST` | `/api/teams/:teamId/todos/:id/claim` | 认领 / 释放待办事项（`claim_todos`） |

### 评论

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/teams/:teamId/todos/:todoId/comments` | 列出待办事项的所有评论 |
| `POST` | `/api/teams/:teamId/todos/:todoId/comments` | 添加评论 |
| `DELETE` | `/api/teams/:teamId/todos/:todoId/comments/:commentId` | 删除评论 |

### 分享链接

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/teams/:teamId/sets/:setId/share-links` | Session | 列出分组的分享链接 |
| `GET` | `/api/teams/:teamId/share-links` | Session | 列出团队中的所有分享链接 |
| `POST` | `/api/teams/:teamId/sets/:setId/share-links` | Session | 创建分享链接（`manage_set_links`） |
| `PATCH` | `/api/teams/:teamId/share-links/:linkId` | Session | 更新分享链接（`manage_set_links`） |
| `DELETE` | `/api/teams/:teamId/share-links/:linkId` | Session | 删除分享链接（`manage_set_links`） |
| `GET` | `/api/shared/:token` | Token | 公开：读取分享的分组与待办事项 |
| `POST` | `/api/shared/:token/todos` | Token | 公开：创建待办事项（若有 `canCreate`） |
| `PATCH` | `/api/shared/:token/todos/:id` | Token | 公开：更新待办事项（受能力限制） |
| `DELETE` | `/api/shared/:token/todos/:id` | Token | 公开：删除待办事项（若有 `canDelete`） |
| `POST` | `/api/shared/:token/todos/reorder` | Token | 公开：重新排序待办事项（若有 `canReorder`） |
| `GET` | `/api/shared/:token/badge.svg` | Token | 公开：进度徽章 SVG |
| `GET` | `/api/shared/:token/todo-list.svg` | Token | 公开：渲染的清单 SVG |

完整参考见[分享链接](./shares)。

### 实时同步

| 方法 | 路径 | 鉴权 | 说明 |
| --- | --- | --- | --- |
| `GET` | `/api/teams/:teamId/sets/:setId/ws` | Session | WebSocket 升级，用于待办事项实时同步 |
| `GET` | `/api/teams/:teamId/sets/:setId/sse` | Session | Server-Sent Events 实时同步回退 |

详见[实时同步](../guide/realtime)。

### 跨应用访问

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/cross-app/teams` | 列出令牌持有者可访问的团队 |
| `GET` | `/api/cross-app/teams/:teamId/sets` | 列出分组（需要相应的跨应用 scope） |
| `GET` | `/api/cross-app/teams/:teamId/sets/:setId/todos` | 列出待办事项（需要相应的跨应用 scope） |
| `POST` | `/api/cross-app/teams/:teamId/sets/:setId/todos` | 创建待办事项（需要相应的跨应用 scope） |
| `PATCH` | `/api/cross-app/teams/:teamId/todos/:id` | 更新待办事项（需要相应的跨应用 scope） |
| `DELETE` | `/api/cross-app/teams/:teamId/todos/:todoId` | 删除待办事项（需要相应的跨应用 scope） |
| `POST` | `/api/cross-app/teams/:teamId/todos/:todoId/claim` | 认领 / 释放待办事项（需要相应的跨应用 scope） |

此表仅列出最常用的跨应用端点；完整集合（分组、评论、设置、权限、概览/动态以及实时同步）见[跨应用集成](./cross-app)。
