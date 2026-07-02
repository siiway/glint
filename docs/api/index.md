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
| `POST`   | `/api/init/register-permissions` | Session | Register Glint's permission scopes into Prism |

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
| `GET`    | `/api/user/settings`               | Session | Get user preferences (action bar, transport, UI) |
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
| `PATCH`  | `/api/teams/:teamId/sets/:setId`        | Session | Rename / set auto-renew & options (`manage_sets` or owner) |
| `DELETE` | `/api/teams/:teamId/sets/:setId`        | Session | Delete a set and all todos (`manage_sets`)     |
| `POST`   | `/api/teams/:teamId/sets/reorder`       | Session | Batch update set sort orders (`manage_sets`)   |
| `GET`    | `/api/teams/:teamId/sets/:setId/export` | Session | Export a set as Markdown / JSON / YAML (`view_todos`) |
| `POST`   | `/api/teams/:teamId/sets/:setId/import` | Session | Import todos into a set (`create_todos`)        |
| `POST`   | `/api/teams/:teamId/sets/import`        | Session | Import a payload as a new set (`manage_sets`)   |

### Todos

| Method   | Path                                         | Auth    | Description                                    |
| -------- | -------------------------------------------- | ------- | ---------------------------------------------- |
| `GET`    | `/api/teams/:teamId/sets/:setId/todos`       | Session | List todos in a set (`view_todos`)             |
| `POST`   | `/api/teams/:teamId/sets/:setId/todos`       | Session | Create a todo or sub-todo                      |
| `PATCH`  | `/api/teams/:teamId/todos/:id`               | Session | Update title, completion, or sort order        |
| `DELETE` | `/api/teams/:teamId/todos/:id`               | Session | Delete todo and its sub-todos (cascade)        |
| `POST`   | `/api/teams/:teamId/todos/reorder`           | Session | Batch update todo sort orders (`reorder_todos`)|
| `PUT`    | `/api/teams/:teamId/todos/:id/assignees`     | Session | Set a todo's assignees (`assign_todos`)        |
| `GET`    | `/api/teams/:teamId/members`                 | Session | List assignable members                        |
| `GET`    | `/api/teams/:teamId/assigned-to-me`          | Session | Todos assigned to me, grouped by list          |
| `POST`   | `/api/teams/:teamId/assigned-expand`         | Session | Persist "Assigned to me" list expand state     |

### Comments

| Method   | Path                                                       | Auth    | Description                             |
| -------- | ---------------------------------------------------------- | ------- | --------------------------------------- |
| `GET`    | `/api/teams/:teamId/todos/:todoId/comments`                | Session | List comments on a todo                 |
| `POST`   | `/api/teams/:teamId/todos/:todoId/comments`                | Session | Add a comment (`comment`)               |
| `DELETE` | `/api/teams/:teamId/todos/:todoId/comments/:commentId`     | Session | Delete a comment                        |

### Share Links

| Method   | Path                                                  | Auth    | Description                                    |
| -------- | ---------------------------------------------------- | ------- | ---------------------------------------------- |
| `GET`    | `/api/teams/:teamId/sets/:setId/share-links`         | Session | List share links for a set                     |
| `GET`    | `/api/teams/:teamId/share-links`                     | Session | List all share links in the team               |
| `POST`   | `/api/teams/:teamId/sets/:setId/share-links`         | Session | Create a share link (`manage_set_links`)       |
| `PATCH`  | `/api/teams/:teamId/share-links/:linkId`             | Session | Update a share link (`manage_set_links`)       |
| `DELETE` | `/api/teams/:teamId/share-links/:linkId`             | Session | Delete a share link (`manage_set_links`)       |
| `GET`    | `/api/shared/:token`                                 | Token   | Public: read shared set & todos                |
| `POST`   | `/api/shared/:token/todos`                           | Token   | Public: create a todo (if `canCreate`)         |
| `PATCH`  | `/api/shared/:token/todos/:id`                       | Token   | Public: update a todo (capability-gated)       |
| `DELETE` | `/api/shared/:token/todos/:id`                       | Token   | Public: delete a todo (if `canDelete`)         |
| `POST`   | `/api/shared/:token/todos/reorder`                   | Token   | Public: reorder todos (if `canReorder`)        |
| `GET`    | `/api/shared/:token/badge.svg`                       | Token   | Public: progress badge SVG                      |
| `GET`    | `/api/shared/:token/todo-list.svg`                   | Token   | Public: rendered checklist SVG                  |

See [Share Links](./shares) for the full reference.

### Realtime

| Method   | Path                                                  | Auth    | Description                                    |
| -------- | ---------------------------------------------------- | ------- | ---------------------------------------------- |
| `GET`    | `/api/teams/:teamId/sets/:setId/ws`                  | Session | WebSocket upgrade for live todo sync           |
| `GET`    | `/api/teams/:teamId/sets/:setId/sse`                 | Session | Server-Sent Events fallback for live sync      |

See [Realtime Sync](../guide/realtime) for details.

### Cross-App (Bearer Token)

| Method   | Path                                                        | Auth   | Scope           | Description                      |
| -------- | ----------------------------------------------------------- | ------ | --------------- | -------------------------------- |
| `GET`    | `/api/cross-app/teams/:teamId/sets`                         | Bearer | `read_todos`    | List sets                        |
| `GET`    | `/api/cross-app/teams/:teamId/sets/:setId/todos`            | Bearer | `read_todos`    | List todos in a set              |
| `POST`   | `/api/cross-app/teams/:teamId/sets/:setId/todos`            | Bearer | `write_todos`   | Create a todo                    |
| `PATCH`  | `/api/cross-app/teams/:teamId/todos/:todoId`                | Bearer | `write_todos`   | Update todo title or completion  |
| `DELETE`  | `/api/cross-app/teams/:teamId/todos/:todoId`                | Bearer | `delete_todos`  | Delete a todo                    |
| `PUT`    | `/api/cross-app/teams/:teamId/todos/:todoId/assignees`     | Bearer | `assign_todos`  | Set a todo's assignees           |
| `GET`    | `/api/cross-app/teams/:teamId/assigned-to-me`              | Bearer | `read_todos`    | Todos assigned to me (one team)  |
| `GET`    | `/api/cross-app/assigned-to-me`                            | Bearer | `read_todos`    | Todos assigned to me (all teams) |

This table lists only the most common cross-app endpoints; see [Cross-App](./cross-app) for the complete set (sets, comments, settings, permissions, overview/feed, and realtime).

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
