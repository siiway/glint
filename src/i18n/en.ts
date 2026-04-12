export default {
  // Common
  loading: "Loading...",
  saving: "Saving...",
  save: "Save",
  cancel: "Cancel",
  close: "Close",
  back: "Back",
  delete: "Delete",
  edit: "Edit",
  rename: "Rename",
  add: "Add",
  confirm: "Confirm",

  // Auth / Login
  signingIn: "Signing in...",
  signInWithPrism: "Sign in with Prism",
  signOut: "Sign out",
  tagline: "A simple todo list to keep you on track.",

  // Footer
  footerGitHub: "GitHub",
  footerLicense: "Licensed under the",
  footerLicenseName: "GNU GPL v3.0",

  // Init page
  initWelcome: "Welcome to Glint",
  initConfigSubtitle:
    "Configure your Prism identity provider and app settings.",
  initConfirmSubtitle: "Review your configuration and initialize the database.",
  initPrismOAuth: "Prism OAuth Configuration",
  initPrismBaseUrl: "Prism Base URL",
  initPrismBaseUrlHint: "The base URL of your Prism identity server.",
  initClientId: "Client ID",
  initClientIdHint: "The OAuth client ID from your Prism app.",
  initUsePkce: "Use PKCE (public client)",
  initUsePkceHint:
    "Enable for public clients (no secret). Disable for confidential clients with a client secret.",
  initClientSecret: "Client Secret",
  initClientSecretHint: "Required for confidential clients (non-PKCE).",
  initRedirectUri: "Redirect URI",
  initRedirectUriHint:
    "Must match the redirect URI configured in Prism. Defaults to {origin}/callback.",
  initAccessControl: "Access Control",
  initAllowedTeamId: "Allowed Team ID (optional)",
  initAllowedTeamIdPlaceholder:
    "team_a, team_b (leave empty to allow all teams)",
  initAllowedTeamIdHint:
    "Supports multiple team IDs separated by comma, semicolon, or spaces.",
  initContinue: "Continue",
  initReview: "Review Configuration",
  initAuthFlow: "Auth Flow",
  initPkceFlow: "PKCE (public client)",
  initConfidentialFlow: "Confidential client (with secret)",
  initAutoDetect: "(auto-detect)",
  initAllTeams: "(all teams)",
  initConfirmText:
    "This will create the database tables and save your configuration. You can change these settings later in the admin panel.",
  initSettingUp: "Setting up...",
  initInitialize: "Initialize",

  // Todo page
  todoPlaceholder: "What needs to be done?",
  todoLoadingTodos: "Loading todos...",
  todoEmpty: "No todos yet. Add one above!",
  todoNoTeams: "No teams found",
  todoNoTeamsDesc:
    "You need to be a member of at least one team on Prism to use Glint.",
  todoOpenSets: "Open sets",
  todoCreateSet: "Create a todo set to get started",
  todoSelectSet: "Select a todo set",
  todoSubTodoPlaceholder: "Sub-todo title...",
  todoItemCount: "{count} item | {count} items",
  todoImportMarkdown: "Import from Markdown",
  todoImportMarkdownDesc:
    "Paste a Markdown checklist. Supports nested items via indentation.",
  todoImportMarkdownPlaceholder:
    "- [x] Done task\n- [ ] Open task\n  - [ ] Sub-task",
  todoImporting: "Importing...",
  todoImport: "Import",
  todoImportEmpty: "No valid checklist items found.",

  // Context menu / actions
  actionAddSubTodo: "Add sub-todo",
  actionComments: "Comments",
  actionSelect: "Select",
  actionDeselect: "Deselect",
  actionSelectAll: "Select all",
  actionClaim: "Claim",
  actionUnclaim: "Unclaim",
  actionClaimedBy: "Claimed by {name}",
  actionMarkComplete: "Mark complete",
  actionMarkIncomplete: "Mark incomplete",
  actionDeleteSelected: "Delete selected",
  actionClearSelection: "Clear selection",

  // Selection bar
  selectionCount: "{count} selected",

  // Comments dialog
  commentsTitle: "Comments",
  commentsLoading: "Loading comments...",
  commentsEmpty: "No comments yet.",
  commentsPlaceholder: "Write a comment...",

  // Sidebar
  sidebarNewSet: "New set",
  sidebarSetPlaceholder: "Set name...",
  sidebarRenameSet: "Rename Set",
  sidebarSetSettings: "Set Settings",
  sidebarSettings: "Settings",

  // Share links
  shareManageLinks: "Manage Links",
  shareCopyLink: "Copy Link",
  shareCopied: "Copied!",
  sharedNotFound: "Share link not found or has been removed.",
  sharedGoHome: "Go to Glint",

  // Share link email gate
  sharedEmailRequired: "Email required",
  sharedEmailHint: "This link is restricted. Enter your email to continue.",
  sharedEmailDenied: "Your email does not have access to this link.",
  sharedEmailSubmit: "Continue",

  // Manage links dialog
  linksDialogTitle: "Share Links",
  linksDialogDesc:
    "Create links to share this set. Each link has its own permissions.",
  linksEmpty: "No share links yet.",
  linksCreateNew: "New Link",
  linksLinkName: "Link name",
  linksLinkNamePlaceholder: "e.g. Read-only for stakeholders",
  linksAllowedEmails: "Restrict to emails",
  linksAllowedEmailsPlaceholder: "a@x.com, b@x.com (empty = public)",
  linksPermView: "View",
  linksPermCreate: "Create",
  linksPermEdit: "Edit",
  linksPermComplete: "Complete",
  linksPermDelete: "Delete",
  linksPermComment: "Comment",
  linksPermReorder: "Reorder",
  linksReadOnly: "Read-only",
  linksFullAccess: "Full access",
  linksCustom: "Custom",
  linksSave: "Save",
  linksDelete: "Delete link",
  linksDeleteConfirm: "Are you sure? Anyone using this link will lose access.",

  // Badge
  shareBadge: "Badge",
  shareBadgeDesc: "Embed in your README to show live progress.",
  shareBadgeStyle: "Style",
  shareBadgeLabel: "Label",
  shareBadgeColor: "Color",
  shareBadgeLabelColor: "Label Color",
  shareBadgePreview: "Preview",
  shareBadgeCopyMarkdown: "Copy Markdown",
  shareBadgeCopyUrl: "Copy Image URL",
  shareBadgeAutoColor: "auto (by progress)",

  // Todo List embed
  shareTodoList: "Todo List",
  shareTodoListDesc: "Embed a live checklist image in your README.",
  shareTodoListTheme: "Theme",
  shareTodoListWidth: "Width",
  shareTodoListFontSize: "Font Size",
  shareTodoListMaxItems: "Max Items",
  shareTodoListShowProgress: "Show progress",
  shareTodoListBgColor: "Background",
  shareTodoListTextColor: "Text Color",
  shareTodoListCheckColor: "Check Color",
  shareTodoListBorderColor: "Border Color",
  shareTodoListTitle: "Title",

  // Settings - Share Links tab
  settingsTabShareLinks: "Share Links",
  settingsShareLinksTitle: "All Share Links",
  settingsShareLinksDesc:
    "Manage all share links across all sets in this team.",
  settingsShareLinksSet: "Set",
  settingsShareLinksName: "Name",
  settingsShareLinksPermissions: "Permissions",
  settingsShareLinksRestricted: "Restricted",
  settingsShareLinksPublic: "Public",

  // Set settings
  setAutoRenew: "Auto-renew daily",
  setAutoRenewHint:
    "Reset all completed todos to incomplete at the specified time each day.",
  setRenewTime: "Renew time",
  setTimezone: "Timezone",
  setTimezoneHint: "Leave empty to use the team's default timezone.",
  setLastRenewed: "Last renewed",
  setNeverRenewed: "Never",

  // Global timezone
  settingsDefaultTimezone: "Default Timezone",

  // Settings page
  settingsTitle: "Settings",
  settingsTabBranding: "Branding",
  settingsTabPermissions: "Permissions",
  settingsTabAppConfig: "App Config",
  settingsLoadingSettings: "Loading settings...",

  // Settings - Branding
  brandingSiteTitle: "Site Branding",
  brandingSiteName: "Site Name",
  brandingLogoUrl: "Logo URL",
  brandingAccentColor: "Accent Color",
  brandingDefaults: "Defaults",
  brandingDefaultSetName: "Default Set Name",
  brandingWelcomeMessage: "Welcome Message",
  brandingSaveSettings: "Save Settings",

  // Settings - Permissions
  permissionsTitle: "Permission Rules",
  permissionsViewOnly: "You can view permissions but cannot edit them.",
  permissionsScope: "Scope:",
  permissionsScopeGlobal: "Global (team-wide)",
  permissionsScopeSet: "Set: {name}",
  permissionsSetOverrideHint:
    "Per-set overrides take priority over global rules.",
  permissionsOwnerNote: "Owner always has full access (not shown).",
  permissionsHeaderPermission: "Permission",
  permissionsHeaderCoOwner: "Co-owner",
  permissionsHeaderAdmin: "Admin",
  permissionsHeaderMember: "Member",
  permissionsSave: "Save Permissions",
  permissionsReset: "Reset to Defaults",

  // Settings - App Config
  appConfigPrismOAuth: "Prism OAuth",
  appConfigPrismBaseUrl: "Prism Base URL",
  appConfigClientId: "Client ID",
  appConfigUsePkce: "Use PKCE (public client)",
  appConfigUsePkceHint:
    "Enable for public clients (no secret). Disable for confidential clients.",
  appConfigClientSecret: "Client Secret",
  appConfigRedirectUri: "Redirect URI",
  appConfigSessionTtl: "Session Duration (seconds)",
  appConfigSessionTtlHint:
    "How long a login session lasts. Set to 0 to use the OAuth provider's default.",
  appConfigAccessControl: "Access Control",
  appConfigAllowedTeamId: "Allowed Team ID",
  appConfigAllowedTeamIdHint:
    "Supports multiple team IDs separated by comma, semicolon, or spaces.",
  appConfigSave: "Save App Config",

  // Permission labels
  permLabel_manage_settings: "Manage Settings",
  permDesc_manage_settings: "Edit site name, logo, branding",
  permLabel_manage_permissions: "Manage Permissions",
  permDesc_manage_permissions: "Edit permission rules",
  permLabel_manage_sets: "Manage Sets",
  permDesc_manage_sets: "Create, rename, delete, reorder todo sets",
  permLabel_create_todos: "Create Todos",
  permDesc_create_todos: "Add new todos",
  permLabel_edit_own_todos: "Edit Own Todos",
  permDesc_edit_own_todos: "Edit todos they created",
  permLabel_edit_any_todo: "Edit Any Todo",
  permDesc_edit_any_todo: "Edit todos created by others",
  permLabel_delete_own_todos: "Delete Own Todos",
  permDesc_delete_own_todos: "Delete todos they created",
  permLabel_delete_any_todo: "Delete Any Todo",
  permDesc_delete_any_todo: "Delete todos created by others",
  permLabel_complete_any_todo: "Complete Any Todo",
  permDesc_complete_any_todo: "Toggle completion on others' todos",
  permLabel_add_subtodos: "Add Sub-todos",
  permDesc_add_subtodos: "Create nested sub-todos",
  permLabel_claim_todos: "Claim Todos",
  permDesc_claim_todos: "Claim todos to indicate ownership",
  permLabel_reorder_todos: "Reorder Todos",
  permDesc_reorder_todos: "Drag to reorder todos",
  permLabel_comment: "Comment",
  permDesc_comment: "Add comments to todos",
  permLabel_delete_own_comments: "Delete Own Comments",
  permDesc_delete_own_comments: "Delete comments they posted",
  permLabel_delete_any_comment: "Delete Any Comment",
  permDesc_delete_any_comment: "Delete comments by others",
  permLabel_view_todos: "View Todos",
  permDesc_view_todos: "View todos in a set",

  // Confirmations
  confirmDeleteTodo:
    "Are you sure you want to delete this item? This action cannot be undone.",
  confirmBulkDelete:
    "Are you sure you want to delete {count} selected items? This action cannot be undone.",
  confirmDeleteSet:
    "Are you sure you want to delete this set and all its items? This action cannot be undone.",
  confirmDeleteComment: "Are you sure you want to delete this comment?",
  confirmResetPermissions:
    "Are you sure you want to reset permissions to defaults? All custom permissions for this scope will be lost.",
};
