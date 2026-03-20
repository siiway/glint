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

export type TeamRole = "owner" | "admin" | "member";

export const ROLE_COLORS: Record<
  TeamRole,
  "brand" | "success" | "informative"
> = {
  owner: "brand",
  admin: "success",
  member: "informative",
};
