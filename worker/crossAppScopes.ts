/**
 * Source of truth for the cross-app inner OAuth scopes Glint exposes.
 *
 * Registered with Prism via the admin "Register Permissions" action so the
 * scopes appear with friendly names on the consent screen when other apps
 * request `app:<glint_client_id>:<scope>`.
 */

export interface CrossAppScopeDef {
  scope: string;
  title: string;
  description: string;
}

export const CROSS_APP_SCOPES: CrossAppScopeDef[] = [
  {
    scope: "read_todos",
    title: "Read todos",
    description: "List sets, read todos, and read comments.",
  },
  {
    scope: "create_todos",
    title: "Create todos",
    description: "Add new todos and sub-todos.",
  },
  {
    scope: "edit_todos",
    title: "Edit todos",
    description: "Edit todo titles.",
  },
  {
    scope: "complete_todos",
    title: "Complete todos",
    description: "Toggle completion on todos.",
  },
  {
    scope: "delete_todos",
    title: "Delete todos",
    description: "Delete todos.",
  },
  {
    scope: "reorder_todos",
    title: "Reorder todos",
    description: "Change todo sort order (drag-and-drop equivalent).",
  },
  {
    scope: "claim_todos",
    title: "Claim todos",
    description: "Assign or release a todo to/from yourself.",
  },
  {
    scope: "write_todos",
    title: "Write todos (legacy)",
    description:
      "Legacy catch-all covering create, edit, and complete. Prefer the more specific scopes.",
  },
  {
    scope: "manage_sets",
    title: "Manage sets",
    description:
      "Create, rename, delete, reorder, and configure todo sets (auto-renew, timezone, split-completed). Also covers bulk import/export of set contents.",
  },
  {
    scope: "comment",
    title: "Post comments",
    description: "Add comments to todos.",
  },
  {
    scope: "delete_comments",
    title: "Delete comments",
    description: "Delete own comments, or any comment with team permission.",
  },
  {
    scope: "read_settings",
    title: "Read team settings",
    description: "Read team branding and preferences.",
  },
  {
    scope: "manage_settings",
    title: "Manage team settings",
    description: "Edit team branding and preferences.",
  },
];
