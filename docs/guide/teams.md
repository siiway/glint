# Teams & Roles

Glint uses Prism teams for access control. Every todo set belongs to a team, and your role determines your default permissions.

## Roles

There are three roles, in order of privilege:

- **Owner** — full access to everything, including settings and permissions. Cannot be restricted.
- **Admin** — broad access by default, but permissions can be customized by the owner.
- **Member** — limited to their own items by default, but permissions can be expanded.

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

## Team Selection

If you belong to multiple teams, use the dropdown in the sidebar to switch between them. Your role badge is shown next to your name in the sidebar footer.

## Managing Teams

Teams are managed on your Prism instance. Glint reads team memberships at login time. Changes to team membership take effect on next sign-in.

## Allowed Team ID

If `allowed_team_id` is set in the app config, only members of that specific Prism team can sign in to Glint. Others will see a 403 error.
