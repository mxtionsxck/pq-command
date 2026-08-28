import type { CurrentUser, Permission, UserRole } from "@/domain/auth/types";

export class AuthenticationRequiredError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "AuthenticationRequiredError";
  }
}

export class AuthorizationError extends Error {
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}.`);
    this.name = "AuthorizationError";
  }
}

function getRole(
  subject: CurrentUser | UserRole | null | undefined,
): UserRole | null {
  if (!subject) {
    return null;
  }

  return typeof subject === "string" ? subject : subject.role;
}

export function canManageSources(
  subject: CurrentUser | UserRole | null | undefined,
): boolean {
  const role = getRole(subject);

  return role === "ADMIN" || role === "MANAGER";
}

export function canSendOutreach(
  subject: CurrentUser | UserRole | null | undefined,
): boolean {
  const role = getRole(subject);

  return role === "ADMIN" || role === "MANAGER" || role === "AGENT";
}

export function canManageUsers(
  subject: CurrentUser | UserRole | null | undefined,
): boolean {
  return getRole(subject) === "ADMIN";
}

export function canManageAuditHistory(
  subject: CurrentUser | UserRole | null | undefined,
): boolean {
  return getRole(subject) === "ADMIN";
}

export function requireAuthenticatedUser(
  user: CurrentUser | null | undefined,
): CurrentUser {
  if (!user) {
    throw new AuthenticationRequiredError();
  }

  return user;
}

export function hasPermission(
  user: CurrentUser | UserRole | null | undefined,
  permission: Permission,
): boolean {
  switch (permission) {
    case "manageSources":
      return canManageSources(user);
    case "sendOutreach":
      return canSendOutreach(user);
    case "manageUsers":
      return canManageUsers(user);
    case "manageAuditHistory":
      return canManageAuditHistory(user);
  }
}

export function requirePermission(
  user: CurrentUser | null | undefined,
  permission: Permission,
): CurrentUser {
  const authenticatedUser = requireAuthenticatedUser(user);

  if (!hasPermission(authenticatedUser, permission)) {
    throw new AuthorizationError(permission);
  }

  return authenticatedUser;
}
