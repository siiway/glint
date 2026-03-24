export type Todo = {
  id: string;
  userId: string;
  parentId: string | null;
  title: string;
  completed: boolean;
  sortOrder: number;
  commentCount: number;
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

export type TeamRole = "owner" | "admin" | "member";

export const ROLE_COLORS: Record<
  TeamRole,
  "brand" | "success" | "informative"
> = {
  owner: "brand",
  admin: "success",
  member: "informative",
};
