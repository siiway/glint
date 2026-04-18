# Teams & Roles

Glint uses Prism teams for access control. Every todo set belongs to a team, and your role in that team determines your default permissions. Teams are managed entirely within Prism — Glint reads membership and role data at login time.

---

## Roles

Four roles exist, from highest to lowest privilege:

| Role           | Description                                                                     |
| -------------- | ------------------------------------------------------------------------------- |
| **Owner**      | Full access to everything including settings and permissions. Cannot be restricted. |
| **Co-owner**   | Near-identical access to owner; can manage settings and permissions.            |
| **Admin**      | Broad access by default; permissions are customizable by the owner.             |
| **Member**     | Limited to their own content by default; can be expanded via permissions.       |

Owner and co-owner permissions are always complete and unaffected by permission rules.

---

## Default Permissions

| Permission          | Admin | Member |
| ------------------- | ----- | ------ |
| Manage settings     | No    | No     |
| Manage permissions  | No    | No     |
| Manage sets         | Yes   | No     |
| Create todos        | Yes   | Yes    |
| Edit own todos      | Yes   | Yes    |
| Edit any todo       | Yes   | No     |
| Delete own todos    | Yes   | Yes    |
| Delete any todo     | Yes   | No     |
| Complete any todo   | Yes   | No     |
| Add sub-todos       | Yes   | Yes    |
| Reorder todos       | Yes   | No     |
| Comment             | Yes   | Yes    |
| Delete own comments | Yes   | Yes    |
| Delete any comment  | Yes   | No     |
| View todos          | Yes   | Yes    |

All defaults can be overridden globally or per-set. See [Permissions](./permissions).

---

## Switching Teams (Workspaces)

If you belong to multiple teams, use the workspace switcher at the top of the sidebar to switch between them. Your personal space (private to you) also appears in this list.

The URL updates as you switch workspaces (`/<teamId>` or `/personal:<userId>`), making it bookmarkable.

---

## Personal Space

Every user has a **personal space** visible only to themselves. Permission rules do not apply in personal space — you always have full control over your own content there.

---

## Managing Teams

Teams are managed in your Prism instance (create, invite, change roles, etc.). Glint reads membership via the `teams:read` OAuth scope when the user logs in.

**Team membership changes take effect on next login.** Users who need the change immediately can sign out and sign back in.

---

## Allowed Team ID

If `allowed_team_id` is configured in the app settings, only members of that Prism team (or teams) can sign in. Others see a "Not Authorized" page.

⚠️ **Important distinction:** `allowed_team_id` is an **authentication control** — it restricts who can log in. Once logged in, users can access all teams they are a member of. This is not a visibility or permissions boundary.

Multiple team IDs can be allowed, separated by commas, semicolons, or spaces:

```
team_a, team_b
```

When set via the `ALLOWED_TEAM_ID` environment variable, the value overrides any KV-stored setting and cannot be changed from the UI.
