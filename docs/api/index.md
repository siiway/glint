# API Reference

Glint exposes a REST API on the Cloudflare Worker. Most endpoints require authentication via session cookie.

## Base URL

All endpoints are relative to the worker origin (e.g. `https://glint.your-domain.com`).

## Authentication

Authentication is handled via Prism OAuth 2.0 with PKCE. Sessions are stored in KV and tracked with an `httpOnly` cookie. See [Authentication](./auth) for details.

## Endpoints

### Init & Config

- `GET /api/init/status` — Check if the app is initialized
- `POST /api/init/setup` — Run first-time setup (creates DB tables, saves config)
- `GET /api/init/branding` — Public: get site name and logo
- `GET /api/init/config` — Get app config (Prism settings)
- `PUT /api/init/config` — Update app config (owner only after init)

### Auth

- `GET /api/auth/config` — Get Prism OAuth config for the frontend
- `GET /api/auth/me` — Get current user (or `null`)
- `POST /api/auth/callback` — Exchange OAuth code for session
- `POST /api/auth/logout` — Destroy session

### Team Settings

- `GET /api/teams/:teamId/settings` — Get team settings (branding)
- `PATCH /api/teams/:teamId/settings` — Update team settings

### Permissions

- `GET /api/teams/:teamId/permissions` — Get full permission matrix
- `GET /api/teams/:teamId/permissions/me` — Get effective permissions for current user
- `PUT /api/teams/:teamId/permissions` — Batch update permissions
- `DELETE /api/teams/:teamId/permissions` — Reset permissions for a scope

### Todo Sets

- `GET /api/teams/:teamId/sets` — List sets
- `POST /api/teams/:teamId/sets` — Create a set
- `PATCH /api/teams/:teamId/sets/:setId` — Rename a set
- `DELETE /api/teams/:teamId/sets/:setId` — Delete a set
- `POST /api/teams/:teamId/sets/reorder` — Reorder sets

### Todos

- `GET /api/teams/:teamId/sets/:setId/todos` — List todos in a set
- `POST /api/teams/:teamId/sets/:setId/todos` — Create a todo (or sub-todo)
- `PATCH /api/teams/:teamId/todos/:id` — Update a todo
- `DELETE /api/teams/:teamId/todos/:id` — Delete a todo
- `POST /api/teams/:teamId/todos/reorder` — Reorder todos

### Comments

- `GET /api/teams/:teamId/todos/:todoId/comments` — List comments
- `POST /api/teams/:teamId/todos/:todoId/comments` — Add a comment
- `DELETE /api/teams/:teamId/todos/:todoId/comments/:commentId` — Delete a comment

## Error Responses

All errors return JSON:

```json
{ "error": "Description of the error" }
```

Common status codes: `400` (bad request), `401` (unauthorized), `403` (forbidden), `404` (not found).
