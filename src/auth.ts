import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

import { userRoles, type UserRole } from "@/domain/auth/types";
import { appEnv } from "@/lib/env";
import {
  isLocalAdminAuthConfigured,
  isAuthProviderConfigured,
  resolveUserRole,
} from "@/server/auth/role-resolution";
import { consumeRateLimit } from "@/server/security/rate-limit";

function safeEqualText(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

function normalizeUsername(value: string) {
  return value.trim().toUpperCase();
}

const providers = [
  ...(isAuthProviderConfigured(appEnv)
    ? [
        MicrosoftEntraID({
          clientId: appEnv.AUTH_MICROSOFT_ENTRA_ID_ID!,
          clientSecret: appEnv.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
          issuer: appEnv.AUTH_MICROSOFT_ENTRA_ID_ISSUER!,
        }),
      ]
    : []),
  ...(isLocalAdminAuthConfigured(appEnv)
    ? [
        Credentials({
          name: "Private Admin",
          credentials: {
            username: { label: "Username", type: "text" },
            password: { label: "Password", type: "password" },
          },
          async authorize(credentials) {
            const expectedUsername = appEnv.AUTH_LOCAL_ADMIN_USERNAME;
            const expectedPassword = appEnv.AUTH_LOCAL_ADMIN_PASSWORD;

            if (!expectedUsername || !expectedPassword) {
              return null;
            }

            const submittedUsername =
              typeof credentials?.username === "string"
                ? normalizeUsername(credentials.username)
                : "";
            const submittedPassword =
              typeof credentials?.password === "string"
                ? credentials.password
                : "";

            const matchesUsername = safeEqualText(
              submittedUsername,
              normalizeUsername(expectedUsername),
            );

            const authRate = consumeRateLimit({
              key: `credentials:${submittedUsername || "unknown"}`,
              max: 10,
              windowMs: 5 * 60_000,
            });

            if (!authRate.allowed) {
              return null;
            }

            const matchesPassword = safeEqualText(
              submittedPassword,
              expectedPassword,
            );

            if (!matchesUsername || !matchesPassword) {
              return null;
            }

            const normalized = normalizeUsername(expectedUsername).toLowerCase();

            return {
              id: `local-admin:${normalized}`,
              name: "PQ Private Admin",
              email: `${normalized}@local.pq`,
              role: "ADMIN" as const,
            };
          },
        }),
      ]
    : []),
];

export const { auth, handlers, signIn, signOut } = NextAuth({
  trustHost: true,
  ...(appEnv.AUTH_SECRET ? { secret: appEnv.AUTH_SECRET } : {}),
  pages: {
    signIn: "/auth/sign-in",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
    updateAge: 60 * 60,
  },
  useSecureCookies: appEnv.NODE_ENV === "production",
  providers,
  callbacks: {
    jwt({ token, user }) {
      const userWithRole = user as typeof user & { role?: UserRole };

      if (userWithRole?.role) {
        token["role"] = userWithRole.role;
      }

      const email = user?.email ?? token.email;

      if (email) {
        token.email = email;
        if (!token["role"]) {
          token["role"] = resolveUserRole(email, appEnv);
        }
      }

      if (user?.id) {
        token["userId"] = user.id;
      }

      return token;
    },
    session({ session, token }) {
      const tokenUserId = token["userId"];
      const tokenRole = token["role"];
      const resolvedRole =
        typeof tokenRole === "string" &&
        userRoles.includes(tokenRole as UserRole)
          ? (tokenRole as UserRole)
          : "AGENT";

      if (session.user) {
        session.user.id =
          typeof tokenUserId === "string"
            ? tokenUserId
            : typeof token.sub === "string"
              ? token.sub
              : "";
        session.user.role = resolvedRole;
        session.user.email = session.user.email ?? token.email ?? "";
      }

      return session;
    },
  },
});
