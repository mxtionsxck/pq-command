import type { CurrentUser } from "@/domain/auth/types";

import { canManageUsers } from "./rbac";

export type ProtectedPageAccessResult =
  | { type: "allow" }
  | { type: "redirect"; location: string }
  | { type: "forbidden" };

const protectedPathPrefixes = ["/internal", "/admin"] as const;

export function buildSignInLocation(callbackUrl: string): string {
  const params = new URLSearchParams({ callbackUrl });

  return `/auth/sign-in?${params.toString()}`;
}

export function sanitizeCallbackUrl(value: string | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/internal";
  }

  return value;
}

export function isProtectedPagePath(pathname: string): boolean {
  return protectedPathPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function resolveProtectedPageAccess(
  pathname: string,
  user: CurrentUser | null,
): ProtectedPageAccessResult {
  if (!isProtectedPagePath(pathname)) {
    return { type: "allow" };
  }

  if (!user) {
    return {
      type: "redirect",
      location: buildSignInLocation(pathname),
    };
  }

  if (pathname.startsWith("/admin") && !canManageUsers(user)) {
    return { type: "forbidden" };
  }

  return { type: "allow" };
}
