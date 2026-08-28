import type { UserRole } from "@/domain/auth/types";
import type { AppEnv } from "@/lib/env";

export function isAuthProviderConfigured(env: AppEnv): boolean {
  return Boolean(
    env.AUTH_SECRET &&
    env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
    env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
  );
}

export function isLocalAdminAuthConfigured(env: AppEnv): boolean {
  return Boolean(env.AUTH_LOCAL_ADMIN_USERNAME && env.AUTH_LOCAL_ADMIN_PASSWORD);
}

export function isAnyAuthProviderConfigured(env: AppEnv): boolean {
  return isAuthProviderConfigured(env) || isLocalAdminAuthConfigured(env);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function resolveUserRole(email: string, env: AppEnv): UserRole {
  const normalizedEmail = normalizeEmail(email);

  if (env.AUTH_ADMIN_EMAILS.includes(normalizedEmail)) {
    return "ADMIN";
  }

  if (env.AUTH_MANAGER_EMAILS.includes(normalizedEmail)) {
    return "MANAGER";
  }

  return "AGENT";
}
