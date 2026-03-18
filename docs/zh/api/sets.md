# 待办集合 API

待办集合是团队内用于分组待办事项的容器。所有端点需要身份验证和团队成员身份。

## `GET /api/teams/:teamId/sets`

列出团队的所有集合，按 `sort_order` 排序。如果不存在任何集合，会自动创建一个默认集合。

**响应：**

```json
{
  "sets": [
    {
      "id": "uuid",
      "userId": "creator-uuid",
      "name": "Sprint 12",
      "sortOrder": 1,
      "createdAt": "2026-03-17T12:00:00.000Z"
    }
  ],
  "role": "owner"
}
```

## `POST /api/teams/:teamId/sets`

创建新集合。需要 `manage_sets` 权限。

**请求体：**

```json
{ "name": "Sprint 12" }
```

**响应（201）：**

```json
{
  "set": {
    "id": "uuid",
    "userId": "creator-uuid",
    "name": "Sprint 12",
    "sortOrder": 3,
    "createdAt": "2026-03-17T12:00:00.000Z"
  }
}
```

## `PATCH /api/teams/:teamId/sets/:setId`

重命名集合。需要 `manage_sets` 权限或集合所有权。

**请求体：**

```json
{ "name": "Sprint 13" }
```

**响应：**

```json
{ "ok": true }
```

## `DELETE /api/teams/:teamId/sets/:setId`

删除集合及其所有待办事项（级联删除）。需要 `manage_sets` 权限或集合所有权。

**响应：**

```json
{ "ok": true }
```

## `POST /api/teams/:teamId/sets/reorder`

批量更新集合的排序。需要 `manage_sets` 权限。

**请求体：**

```json
{
  "items": [
    { "id": "uuid-1", "sortOrder": 1 },
    { "id": "uuid-2", "sortOrder": 2 }
  ]
}
```

**响应：**

```json
{ "ok": true }
```
