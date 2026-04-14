export type Todo = {
  id: string;
  userId: string;
  parentId: string | null;
  title: string;
  completed: boolean;
  sortOrder: number;
  commentCount: number;
  claimedBy: string | null;
  claimedByName: string | null;
  claimedByAvatar: string | null;

  createdAt: string;
  updatedAt: string;
};

export type TodoSet = {
  id: string;
  userId: string;
  name: string;
  sortOrder: number;
  autoRenew: boolean;
  renewTime: string;
  timezone: string;
  lastRenewedAt: string | null;
  // If true, show incomplete and completed root todos separately in the UI
  splitCompleted?: boolean;
  createdAt: string;
};

export type Comment = {
  id: string;
  userId: string;
  username: string;
  body: string;
  createdAt: string;
};

export type ShareLink = {
  id: string;
  setId: string;
  setName?: string;
  token: string;
  name: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canComplete: boolean;
  canDelete: boolean;
  canComment: boolean;
  canReorder: boolean;
  allowedEmails: string;
  createdBy: string;
  createdAt: string;
};

export type ShareLinkPermissions = {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canComplete: boolean;
  canDelete: boolean;
  canComment: boolean;
  canReorder: boolean;
};

export type TeamRole = "owner" | "co-owner" | "admin" | "member";

export type TodoSpace = {
  id: string;
  name: string;
  kind: "personal" | "team";
  role: TeamRole;
  avatarUrl?: string;
};

export const ROLE_COLORS: Record<
  TeamRole,
  "brand" | "success" | "informative" | "warning"
> = {
  owner: "brand",
  "co-owner": "warning",
  admin: "success",
  member: "informative",
};
