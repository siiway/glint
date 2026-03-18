# 快速开始

Glint 是一款基于 Cloudflare Workers 构建的团队待办事项应用。它使用 D1 进行数据存储，KV 管理会话和配置，Prism 进行身份验证。

## 前置条件

- [Bun](https://bun.sh)（包管理器）
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)（Cloudflare Workers）
- 一个用于身份验证的 [Prism](https://github.com/siiway/prism) 实例

## 安装

```bash
git clone https://github.com/siiway/glint.git
cd glint
bun install
```

## 设置 Cloudflare 资源

### 1. 创建 D1 数据库

```bash
wrangler d1 create glint-db
```

将输出中的 `database_id` 复制到 `wrangler.jsonc` 中。

### 2. 创建 KV 命名空间

```bash
wrangler kv namespace create KV
```

将输出中的 `id` 复制到 `wrangler.jsonc` 中。

### 3. 应用迁移

```bash
wrangler d1 migrations apply glint-db --local  # 本地开发
wrangler d1 migrations apply glint-db           # 远程部署
```

### 4. 注册 Prism OAuth 应用

在你的 Prism 实例上创建一个 OAuth 应用：

- **重定向 URI**：`http://localhost:5173/callback`（开发环境）或 `https://your-domain.com/callback`
- **权限范围**：`openid`、`profile`、`email`、`teams:read`
- **客户端类型**：公开（PKCE）或机密（使用客户端密钥）

记下**客户端 ID**（如果使用机密客户端，还需记下**客户端密钥**）——你将在初始化向导中输入它们。

初始化向导允许你在 PKCE（推荐用于 SPA）和机密客户端流程之间进行选择。

## 开发

```bash
bun run dev
```

首次访问时，Glint 会显示一个**初始化向导**，该向导将：

1. 收集你的 Prism 配置（基础 URL、客户端 ID、重定向 URI）
2. 可选设置允许的团队 ID 以限制访问
3. 创建数据库表

所有配置存储在 KV 中——无需环境变量。

## 部署

```bash
bun run deploy
```

部署后，访问你的域名。如果尚未初始化，初始化向导将自动出现。
