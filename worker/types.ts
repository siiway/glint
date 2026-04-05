export type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
};

export type AppConfig = {
  prism_base_url: string;
  prism_client_id: string;
  prism_client_secret: string;
  prism_redirect_uri: string;
  use_pkce: boolean;
  allowed_team_id: string;
  session_ttl: number;
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  prism_base_url: "",
  prism_client_id: "",
  prism_client_secret: "",
  prism_redirect_uri: "",
  use_pkce: true,
  allowed_team_id: "",
  session_ttl: 0,
};

export type TeamRole = "owner" | "co-owner" | "admin" | "member";

export type TeamInfo = {
  id: string;
  name: string;
  role: TeamRole;
};

export type SessionData = {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  accessToken: string;
  expiresAt: number;
  teams: TeamInfo[];
};

export type Variables = {
  session: SessionData;
};

export type TeamSettings = {
  site_name: string;
  site_logo_url: string;
  accent_color: string;
  welcome_message: string;
  default_set_name: string;
  allow_member_create_sets: boolean;
  default_timezone: string;
};

export const DEFAULT_SETTINGS: TeamSettings = {
  site_name: "Glint",
  site_logo_url: "",
  accent_color: "",
  welcome_message: "",
  default_set_name: "Not Grouped",
  allow_member_create_sets: false,
  default_timezone: "UTC",
};

export const PERMISSION_KEYS = [
  "manage_settings",
  "manage_permissions",
  "manage_sets",
  "create_todos",
  "edit_own_todos",
  "edit_any_todo",
  "delete_own_todos",
  "delete_any_todo",
  "complete_any_todo",
  "add_subtodos",
  "claim_todos",
  "reorder_todos",
  "comment",
  "delete_own_comments",
  "delete_any_comment",
  "view_todos",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const DEFAULT_PERMISSIONS: Record<
  "co-owner" | "admin" | "member",
  Record<PermissionKey, boolean>
> = {
  "co-owner": {
    manage_settings: true,
    manage_permissions: true,
    manage_sets: true,
    create_todos: true,
    edit_own_todos: true,
    edit_any_todo: true,
    delete_own_todos: true,
    delete_any_todo: true,
    complete_any_todo: true,
    add_subtodos: true,
    claim_todos: true,
    reorder_todos: true,
    comment: true,
    delete_own_comments: true,
    delete_any_comment: true,
    view_todos: true,
  },
  admin: {
    manage_settings: false,
    manage_permissions: false,
    manage_sets: true,
    create_todos: true,
    edit_own_todos: true,
    edit_any_todo: true,
    delete_own_todos: true,
    delete_any_todo: true,
    complete_any_todo: true,
    add_subtodos: true,
    claim_todos: true,
    reorder_todos: true,
    comment: true,
    delete_own_comments: true,
    delete_any_comment: true,
    view_todos: true,
  },
  member: {
    manage_settings: false,
    manage_permissions: false,
    manage_sets: false,
    create_todos: true,
    edit_own_todos: true,
    edit_any_todo: false,
    delete_own_todos: true,
    delete_any_todo: false,
    complete_any_todo: false,
    add_subtodos: true,
    claim_todos: true,
    reorder_todos: false,
    comment: true,
    delete_own_comments: true,
    delete_any_comment: false,
    view_todos: true,
  },
};
