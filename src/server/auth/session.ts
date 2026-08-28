import "server-only";

import type { Session } from "next-auth";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import type { CurrentUser, Permission } from "@/domain/auth/types";

import { requirePermission } from "./rbac";

function mapSessionUser(session: Session | null): CurrentUser | null {
  if (!session?.user?.email || !session.user.role || !session.user.id) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    role: session.user.role,
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();

  return mapSessionUser(session);
}

export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  return user;
}

export async function requireCurrentUserPermission(
  permission: Permission,
): Promise<CurrentUser> {
  const user = await getCurrentUser();

  return requirePermission(user, permission);
}
