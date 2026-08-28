import assert from "node:assert/strict";
import test from "node:test";

import type { CurrentUser } from "../src/domain/auth/types";
import { loadAppEnv } from "../src/lib/env";
import {
  buildSignInLocation,
  resolveProtectedPageAccess,
  sanitizeCallbackUrl,
} from "../src/server/auth/access-control";
import {
  AuthenticationRequiredError,
  AuthorizationError,
  canManageSources,
  canManageUsers,
  canSendOutreach,
  requirePermission,
} from "../src/server/auth/rbac";
import {
  isAnyAuthProviderConfigured,
  isAuthProviderConfigured,
  isLocalAdminAuthConfigured,
  resolveUserRole,
} from "../src/server/auth/role-resolution";

const adminUser: CurrentUser = {
  id: "admin-1",
  email: "admin@pqrealestate.example",
  name: "Admin User",
  image: null,
  role: "ADMIN",
};

const managerUser: CurrentUser = {
  id: "manager-1",
  email: "manager@pqrealestate.example",
  name: "Manager User",
  image: null,
  role: "MANAGER",
};

const agentUser: CurrentUser = {
  id: "agent-1",
  email: "agent@pqrealestate.example",
  name: "Agent User",
  image: null,
  role: "AGENT",
};

test("auth provider stays disabled until all auth variables are configured", () => {
  const disabledEnv = loadAppEnv({ NODE_ENV: "test" });
  const enabledEnv = loadAppEnv({
    NODE_ENV: "test",
    AUTH_SECRET: "secret",
    AUTH_MICROSOFT_ENTRA_ID_ID: "client-id",
    AUTH_MICROSOFT_ENTRA_ID_SECRET: "client-secret",
    AUTH_MICROSOFT_ENTRA_ID_ISSUER:
      "https://login.microsoftonline.com/tenant/v2.0",
  });

  assert.equal(isAuthProviderConfigured(disabledEnv), false);
  assert.equal(isAuthProviderConfigured(enabledEnv), true);
});

test("local private admin auth enables sign-in without Entra", () => {
  const localOnlyEnv = loadAppEnv({
    NODE_ENV: "test",
    AUTH_LOCAL_ADMIN_USERNAME: "PQADMIN",
    AUTH_LOCAL_ADMIN_PASSWORD: "password123",
  });

  assert.equal(isAuthProviderConfigured(localOnlyEnv), false);
  assert.equal(isLocalAdminAuthConfigured(localOnlyEnv), true);
  assert.equal(isAnyAuthProviderConfigured(localOnlyEnv), true);
});

test("role resolution uses configured email lists", () => {
  const env = loadAppEnv({
    NODE_ENV: "test",
    AUTH_ADMIN_EMAILS: "admin@pqrealestate.example",
    AUTH_MANAGER_EMAILS: "manager@pqrealestate.example",
  });

  assert.equal(resolveUserRole("admin@pqrealestate.example", env), "ADMIN");
  assert.equal(resolveUserRole("manager@pqrealestate.example", env), "MANAGER");
  assert.equal(resolveUserRole("agent@pqrealestate.example", env), "AGENT");
});

test("permission helpers enforce role boundaries", () => {
  assert.equal(canManageSources(adminUser), true);
  assert.equal(canManageSources(managerUser), true);
  assert.equal(canManageSources(agentUser), false);
  assert.equal(canSendOutreach(agentUser), true);
  assert.equal(canManageUsers(managerUser), false);
  assert.equal(canManageUsers(adminUser), true);
});

test("unauthenticated and unauthorized access are rejected server-side", () => {
  assert.throws(
    () => requirePermission(null, "sendOutreach"),
    AuthenticationRequiredError,
  );
  assert.throws(
    () => requirePermission(agentUser, "manageUsers"),
    AuthorizationError,
  );
  assert.equal(requirePermission(adminUser, "manageUsers"), adminUser);
});

test("protected route access redirects or forbids appropriately", () => {
  assert.deepEqual(resolveProtectedPageAccess("/internal", null), {
    type: "redirect",
    location: buildSignInLocation("/internal"),
  });
  assert.deepEqual(resolveProtectedPageAccess("/admin/users", managerUser), {
    type: "forbidden",
  });
  assert.deepEqual(resolveProtectedPageAccess("/admin/users", adminUser), {
    type: "allow",
  });
});

test("callback sanitization only allows local paths", () => {
  assert.equal(sanitizeCallbackUrl("/admin/users"), "/admin/users");
  assert.equal(sanitizeCallbackUrl("https://example.com"), "/internal");
  assert.equal(sanitizeCallbackUrl("//evil.example"), "/internal");
});
