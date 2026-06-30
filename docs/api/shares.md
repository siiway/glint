# Share Links API

Share links expose a single todo set to people **outside** the team through a public, unguessable URL — no Prism account required. Each link carries its own fine-grained capabilities (view, create, edit, complete, delete, comment, reorder) and an optional email allow-list. Links also power read-only **badge** and **todo-list** SVGs for embedding in READMEs and dashboards.

Share-link management endpoints require an authenticated session and the `manage_set_links` permission. The public endpoints under `/api/shared/:token` require no session — access is governed entirely by the token and the link's capabilities.

---

## Link object

```json
{
  "id": "link-uuid",
  "setId": "set-uuid",
  "setName": "Sprint 12",
  "token": "32charhextoken",
  "name": "Public roadmap",
  "canView": true,
  "canCreate": false,
  "canEdit": false,
  "canComplete": false,
  "canDelete": false,
  "canComment": false,
  "canReorder": false,
  "allowedEmails": "",
  "createdBy": "creator-user-id",
  "createdAt": "2026-06-01T10:00:00.000Z"
}
```

| Field | Type | Description |
| --- | --- | --- |
| `id` | string (UUID) | Internal link identifier (used for update/delete). |
| `setId` | string (UUID) | The set this link exposes. |
| `setName` | string | Set name. Only included by the team-wide listing endpoint. |
| `token` | string | The public, URL-safe token. Used in `/api/shared/:token`. |
| `name` | string | Human-readable label for the link. |
| `canView` | boolean | Allows reading the set and its todos. Defaults to `true`. |
| `canCreate` | boolean | Allows creating todos via the public API. |
| `canEdit` | boolean | Allows editing todo titles. |
| `canComplete` | boolean | Allows toggling completion. |
| `canDelete` | boolean | Allows deleting todos. |
| `canComment` | boolean | Reserved for future public commenting. |
| `canReorder` | boolean | Allows reordering todos. |
| `allowedEmails` | string | Comma-separated email allow-list. Empty = no restriction. |
| `createdBy` | string (UUID) | User who created the link. |
| `createdAt` | string (ISO 8601) | Creation timestamp. |

---

## `GET /api/teams/:teamId/sets/:setId/share-links`

List all share links for a specific set.

**Auth required:** Yes — team member

**Response:**

```json
{ "links": [ /* link objects */ ] }
```

---

## `GET /api/teams/:teamId/share-links`

List **all** share links across the team, each annotated with its `setName`. Used by the team-wide management panel.

**Auth required:** Yes — team member

**Response:**

```json
{ "links": [ /* link objects, each with setName */ ] }
```

---

## `POST /api/teams/:teamId/sets/:setId/share-links`

Create a new share link for a set. A random `token` is generated server-side.

**Auth required:** Yes — `manage_set_links`

**Request body** (all fields optional):

```json
{
  "name": "Public roadmap",
  "canView": true,
  "canCreate": false,
  "canEdit": false,
  "canComplete": false,
  "canDelete": false,
  "canComment": false,
  "canReorder": false,
  "allowedEmails": "alice@example.com, bob@example.com"
}
```

`canView` defaults to `true`; all other capabilities default to `false`. `allowedEmails` is a comma-separated list — when non-empty, public requests must supply a matching `email`.

**Response (201):**

```json
{ "link": { /* link object */ } }
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `403` | `"No permission to manage set links"` | Lacks `manage_set_links`. |

---

## `PATCH /api/teams/:teamId/share-links/:linkId`

Update a link's name, capabilities, or email allow-list. Only provided fields change.

**Auth required:** Yes — `manage_set_links`

**Request body** (all fields optional): same shape as create.

**Response:**

```json
{ "ok": true }
```

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `400` | `"No updates"` | No recognized fields provided. |
| `403` | `"No permission to manage set links"` | Lacks `manage_set_links`. |

---

## `DELETE /api/teams/:teamId/share-links/:linkId`

Permanently delete a share link. The token immediately stops working; the underlying set and todos are unaffected.

**Auth required:** Yes — `manage_set_links`

**Response:**

```json
{ "ok": true }
```

---

## Public Endpoints

The endpoints below require **no session**. Authorization is derived from the `token` and the link's capability flags. When a link has an `allowedEmails` restriction, callers must pass a matching `email` (as a query parameter for `GET`/`DELETE`, or in the JSON body for `POST`/`PATCH`).

### `GET /api/shared/:token`

Fetch the shared set, its todos, and the capabilities granted by the link.

**Query parameters:**

| Parameter | Description |
| --- | --- |
| `email` | Required only when the link has an email allow-list. |

**Response:**

```json
{
  "set": { "id": "set-uuid", "name": "Sprint 12" },
  "permissions": {
    "canView": true,
    "canCreate": false,
    "canEdit": false,
    "canComplete": false,
    "canDelete": false,
    "canComment": false,
    "canReorder": false
  },
  "requiresEmail": false,
  "todos": [
    {
      "id": "uuid",
      "userId": "creator-uuid",
      "parentId": null,
      "title": "First todo",
      "completed": false,
      "sortOrder": 1,
      "commentCount": 0,
      "claimedBy": null,
      "claimedByName": null,
      "claimedByAvatar": null,
      "createdAt": "2026-06-01T10:00:00.000Z",
      "updatedAt": "2026-06-01T10:00:00.000Z"
    }
  ]
}
```

`requiresEmail` is `true` when the link is email-restricted, signalling the public page to prompt for an email before granting access.

**Error responses:**

| Status | `error` | Cause |
| --- | --- | --- |
| `403` | `"Access denied"` (`requiresEmail: true`) | Email restriction active and no/invalid email supplied. |
| `404` | `"Share link not found"` | Unknown token. |
| `404` | `"Set not found"` | The underlying set was deleted. |

---

### `POST /api/shared/:token/todos`

Create a todo through the link. Requires `canCreate`.

**Request body:**

```json
{ "title": "New todo", "parentId": null, "email": "alice@example.com" }
```

Public-created todos are stored with the synthetic user id `"shared"`.

**Response (201):** `{ "todo": { /* todo object */ } }`

**Error responses:** `400` empty title; `403` `"Access denied"` or `"This link does not allow creating todos"`; `404` link or parent not found; `409` duplicate sibling title.

---

### `PATCH /api/shared/:token/todos/:id`

Update a todo's `title`, `completed`, or `sortOrder`. Each field requires the matching capability (`canEdit`, `canComplete`, `canReorder`).

**Request body:**

```json
{ "completed": true, "email": "alice@example.com" }
```

**Response:** `{ "ok": true }`

**Error responses:** `400` empty title; `403` `"Access denied"` or a `"This link does not allow ..."` message for the disallowed field; `404` link or todo not found; `409` duplicate sibling title.

---

### `DELETE /api/shared/:token/todos/:id`

Delete a todo. Requires `canDelete`.

**Query parameters:** `email` (when the link is email-restricted).

**Response:** `{ "ok": true }`

**Error responses:** `403` `"Access denied"` or `"This link does not allow deleting"`; `404` link or todo not found.

---

### `POST /api/shared/:token/todos/reorder`

Batch-update sort order. Requires `canReorder`.

**Request body:**

```json
{
  "items": [
    { "id": "uuid-1", "sortOrder": 1 },
    { "id": "uuid-2", "sortOrder": 2 }
  ],
  "email": "alice@example.com"
}
```

**Response:** `{ "ok": true }`

**Error responses:** `400` empty `items`; `403` `"Access denied"` or `"This link does not allow reordering"`; `404` link not found.

---

## Embeddable SVGs

These endpoints render images directly (`Content-Type: image/svg+xml`) and are cached for 60 seconds. They are always read-only and ignore capability flags and email restrictions — anyone with the token can render them.

### `GET /api/shared/:token/badge.svg`

A shields.io-style progress badge showing `completed/total`.

**Query parameters:**

| Parameter | Default | Description |
| --- | --- | --- |
| `style` | `flat` | `flat` or `flat-square`. |
| `label` | set name | Left-hand label text. |
| `message` | `done/total` | Right-hand message text. |
| `color` | auto (by progress) | Right-hand background color. |
| `labelColor` | `#555` | Left-hand background color. |

Returns a `404` badge ("not found") for unknown tokens or deleted sets.

### `GET /api/shared/:token/todo-list.svg`

Renders the set's todos as a checklist image, honoring the set's split-completed ordering and sub-todo nesting.

**Query parameters:**

| Parameter | Default | Description |
| --- | --- | --- |
| `theme` | `light` | `light` or `dark`. |
| `title` | set name | Heading text (pass empty to hide). |
| `width` | auto | Width in px, clamped to `200`–`1000`. |
| `fontSize` | auto | Font size in px, clamped to `10`–`24`. |
| `maxItems` | all | Maximum number of rows, clamped to `1`–`100`. |
| `showProgress` | `true` | Set to `false` to hide the progress summary. |
| `bgColor` | theme | Background color override. |
| `textColor` | theme | Text color override. |
| `checkColor` | theme | Checkbox/check color override. |
| `borderColor` | theme | Border color override. |

---

See the [Share Links guide](../guide/shares) for UI workflow and embedding examples.
