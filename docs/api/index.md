# API Reference

Glint exposes a REST API served by a Cloudflare Worker. All requests and responses use JSON (`Content-Type: application/json`).

## Base URL

All endpoints are relative to the Glint worker origin:

```
https://glint.your-domain.com
```

## Authentication

Most endpoints require an authenticated session established via Prism OAuth. Authentication is tracked with an `httpOnly` cookie named `session`. Cross-app endpoints use `Authorization: Bearer <token>` instead.

See [Authentication API](./auth) for full details on the login flow.

## Endpoint Index

### Init & Config

| Method   | Path                  | Auth     | Description                                    |
| -------- | --------------------- | -------- | ---------------------------------------------- |
| `GET`    | `/api/init/status`    | None     | Check if the app has been initialized          |
| `POST`   | `/api/init/setup`     | None     | First-time setup: create tables, save config   |
| `GET`    | `/api/init/branding`  | None     | Public: get site name and logo URL             |
| `GET`    | `/api/init/config`    | None     | Get full app config (Prism settings)           |
| `PUT`    | `/api/init/config`    | Session  | Update app config (owner only after init)      |

### Auth

| Method   | Path                    | Auth     | Description                                       |
| -------- | ----------------------- | -------- | ------------------------------------------------- |
| `GET`    | `/api/auth/config`      | None     | Get Prism OAuth config for the frontend           |
| `GET`    | `/api/auth/me`          | Cookie   | Get current user (or `null`); renews session      |
| `POST`   | `/api/auth/callback`    | None     | Exchange OAuth code for session; sets cookie      |
| `POST`   | `/api/auth/logout`      | Cookie   | Destroy session; clears cookie                    |

### User Settings

| Method   | Path                               | Auth    | Description                                    |
| -------- | ---------------------------------- | ------- | ---------------------------------------------- |
| `GET`    | `/api/user/settings`               | Session | Get user preferences (action bar, transport)   |
| `PUT`    | `/api/user/settings`               | Session | Update user preferences                        |

### Team Settings

| Method   | Path                               | Auth    | Description                                    |
| -------- | ---------------------------------- | ------- | ---------------------------------------------- |
| `GET`    | `/api/teams/:teamId/settings`      | Session | Get team branding & settings                   |
| `PATCH`  | `/api/teams/:teamId/settings`      | Session | Update team settings (`manage_settings`)       |

### Permissions

| Method   | Path                                   | Auth    | Description                                    |
| -------- | -------------------------------------- | ------- | ---------------------------------------------- |
| `GET`    | `/api/teams/:teamId/permissions`       | Session | Full permission matrix (defaults + overrides)  |
| `GET`    | `/api/teams/:teamId/permissions/me`    | Session | Effective permissions for current user         |
| `PUT`    | `/api/teams/:teamId/permissions`       | Session | Batch update permissions (`manage_permissions`)|
| `DELETE` | `/api/teams/:teamId/permissions`       | Session | Reset permissions for a scope to defaults      |

### Todo Sets

| Method   | Path                                    | Auth    | Description                                    |
| -------- | --------------------------------------- | ------- | ---------------------------------------------- |
| `GET`    | `/api/teams/:teamId/sets`               | Session | List all sets (auto-creates default if empty)  |
| `POST`   | `/api/teams/:teamId/sets`               | Session | Create a set (`manage_sets`)                   |
| `PATCH`  | `/api/teams/:teamId/sets/:setId`        | Session | Rename a set (`manage_sets` or owner)          |
| `DELETE` | `/api/teams/:teamId/sets/:setId`        | Session | Delete a set and all todos (`manage_sets`)     |
| `POST`   | `/api/teams/:teamId/sets/reorder`       | Session | Batch update set sort orders (`manage_sets`)   |

### Todos

| Method   | Path                                         | Auth    | Description                                    |
| -------- | -------------------------------------------- | ------- | ---------------------------------------------- |
| `GET`    | `/api/teams/:teamId/sets/:setId/todos`       | Session | List todos in a set (`view_todos`)             |
| `POST`   | `/api/teams/:teamId/sets/:setId/todos`       | Session | Create a todo or sub-todo                      |
| `PATCH`  | `/api/teams/:teamId/todos/:id`               | Session | Update title, completion, or sort order        |
| `DELETE` | `/api/teams/:teamId/todos/:id`               | Session | Delete todo and its sub-todos (cascade)        |
| `POST`   | `/api/teams/:teamId/todos/reorder`           | Session | Batch update todo sort orders (`reorder_todos`)|

### Comments

| Method   | Path                                                       | Auth    | Description                             |
| -------- | ---------------------------------------------------------- | ------- | --------------------------------------- |
| `GET`    | `/api/teams/:teamId/todos/:todoId/comments`                | Session | List comments on a todo                 |
| `POST`   | `/api/teams/:teamId/todos/:todoId/comments`                | Session | Add a comment (`comment`)               |
| `DELETE` | `/api/teams/:teamId/todos/:todoId/comments/:commentId`     | Session | Delete a comment                        |

### Cross-App (Bearer Token)

| Method   | Path                                                        | Auth   | Scope           | Description                      |
| -------- | ----------------------------------------------------------- | ------ | --------------- | -------------------------------- |
| `GET`    | `/api/cross-app/teams/:teamId/sets`                         | Bearer | `read_todos`    | List sets                        |
| `GET`    | `/api/cross-app/teams/:teamId/sets/:setId/todos`            | Bearer | `read_todos`    | List todos in a set              |
| `POST`   | `/api/cross-app/teams/:teamId/sets/:setId/todos`            | Bearer | `write_todos`   | Create a todo                    |
| `PATCH`  | `/api/cross-app/teams/:teamId/todos/:todoId`                | Bearer | `write_todos`   | Update todo title or completion  |
| `DELETE` | `/api/cross-app/teams/:teamId/todos/:todoId`                | Bearer | `delete_todos`  | Delete a todo                    |

---

## Error Responses

All errors return JSON with an `error` field:

```json
{ "error": "Human-readable description" }
```

### Common Status Codes

| Code  | Meaning                                                                          |
| ----- | -------------------------------------------------------------------------------- |
| `400` | Bad request — missing or invalid fields                                          |
| `401` | Unauthenticated — no session cookie, session expired, or bearer token inactive   |
| `403` | Forbidden — valid session/token but insufficient permission or team membership   |
| `404` | Not found — resource does not exist or does not belong to the given team         |
| `502` | Bad gateway — Glint could not reach Prism (for cross-app introspection calls)   |
