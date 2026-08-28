export const userRoles = ["ADMIN", "MANAGER", "AGENT"] as const;

export type UserRole = (typeof userRoles)[number];

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
}

export type Permission =
  "manageSources" | "sendOutreach" | "manageUsers" | "manageAuditHistory";
