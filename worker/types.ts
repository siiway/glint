export type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  TODO_SYNC?: DurableObjectNamespace;
  ALLOWED_TEAM_ID?: string;
};

export type AppConfig = {
  prism_base_url: string;
  prism_client_id: string;
  prism_client_secret: string;
  prism_redirect_uri: string;
  use_pkce: boolean;
  allowed_team_id: string;
  /**
   * Restricts who can view/change the app config and register permissions to
   * owners of these team(s). If empty, falls back to allowed_team_id.
   * Supports multiple team IDs separated by comma, semicolon, or spaces.
   */
  owner_team_id: string;
  session_ttl: number;
  /** Message shown to every user once, right after they sign in. Empty = disabled. */
  welcome_message: string;
  /** Default quick-action keys shown in the todo action bar. Not set = use built-in default. */
  action_bar_defaults?: string[];
  /** How long to cache resolved user profile names/avatars in KV, in seconds. 0 = no cache. Default 86400 (1 day). */
  user_profile_cache_ttl?: number;
  /** True when allowed_team_id is overridden by environment variable. Not stored in KV. */
  allowed_team_id_from_env?: boolean;
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  prism_base_url: "",
  prism_client_id: "",
  prism_client_secret: "",
  prism_redirect_uri: "",
  use_pkce: true,
  allowed_team_id: "",
  owner_team_id: "",
  session_ttl: 0,
  welcome_message: "",
};

export type TeamRole = "owner" | "co-owner" | "admin" | "member";

/** A user a todo is assigned to, with resolved profile fields for display. */
export type Assignee = {
  userId: string;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
};

export type TeamInfo = {
  id: string;
  name: string;
  role: TeamRole;
  avatarUrl?: string;
};

export type SessionData = {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  accessToken: string;
  /** Unix ms when the Prism access token expires. Present when offline_access was granted. */
  accessTokenExpiresAt?: number;
  /** Prism refresh token. Present when offline_access was granted. */
  refreshToken?: string;
  expiresAt: number;
  teams: TeamInfo[];
  /** True when the access token was issued to an external app, not to Glint directly. */
  isAppToken?: boolean;
};

export type Variables = {
  session: SessionData;
  /** Inner scopes (without the app:clientId: prefix) granted to the cross-app bearer token. */
  crossAppScopes?: string[];
};

export type UserSettings = {
  /** User's personal action bar key order. Null = use workspace/site default. */
  action_bar?: string[] | null;
  /** Preferred realtime transport. "auto" tries WS then falls back to SSE. */
  realtime_transport?: "ws" | "sse" | "auto";
  /** Whether browser favicon follows the currently selected workspace icon. */
  workspace_favicon?: boolean;
  /** Whether to show completed/remaining counts in the header. */
  detailed_status?: boolean;
  /** Whether to use the personal avatar as the personal workspace icon/favicon. */
  personal_avatar_icon?: boolean;
  /** Whether to play a sound when a todo is marked complete. */
  complete_sound_enabled?: boolean;
  /** URL of the sound file to play on completion when complete_sound_enabled. */
  complete_sound_url?: string;
};

export type TeamSettings = {
  site_name: string;
  site_logo_url: string;
  accent_color: string;
  default_set_name: string;
  allow_member_create_sets: boolean;
  default_timezone: string;
};

export const DEFAULT_SETTINGS: TeamSettings = {
  site_name: "Glint",
  site_logo_url: "",
  accent_color: "",
  default_set_name: "Not Grouped",
  allow_member_create_sets: false,
  default_timezone: "UTC",
};

export const PERMISSION_KEYS = [
  "manage_settings",
  "manage_permissions",
  "manage_sets",
  "manage_set_links",
  "create_todos",
  "edit_own_todos",
  "edit_any_todo",
  "delete_own_todos",
  "delete_any_todo",
  "complete_any_todo",
  "add_subtodos",
  "assign_todos",
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
    manage_set_links: true,
    create_todos: true,
    edit_own_todos: true,
    edit_any_todo: true,
    delete_own_todos: true,
    delete_any_todo: true,
    complete_any_todo: true,
    add_subtodos: true,
    assign_todos: true,
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
    manage_set_links: true,
    create_todos: true,
    edit_own_todos: true,
    edit_any_todo: true,
    delete_own_todos: true,
    delete_any_todo: true,
    complete_any_todo: true,
    add_subtodos: true,
    assign_todos: true,
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
    manage_set_links: false,
    create_todos: true,
    edit_own_todos: true,
    edit_any_todo: false,
    delete_own_todos: true,
    delete_any_todo: false,
    complete_any_todo: false,
    add_subtodos: true,
    assign_todos: true,
    reorder_todos: false,
    comment: true,
    delete_own_comments: true,
    delete_any_comment: false,
    view_todos: true,
  },
};
