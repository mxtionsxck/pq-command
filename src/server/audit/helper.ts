import "server-only";

import type { CurrentUser } from "@/domain/auth/types";
import { requireCurrentUser } from "@/server/auth/session";

import { createAuditService } from "@/server/services/audit-event-service";

export function createAuditActor(user: CurrentUser) {
  return {
    type: "user" as const,
    id: user.id,
    userId: user.id,
  };
}

export async function requireAuditActor() {
  const user = await requireCurrentUser();

  return createAuditActor(user);
}

export async function recordAuditEventForCurrentUser(
  input: Omit<
    Parameters<ReturnType<typeof createAuditService>["recordEvent"]>[0],
    "actor"
  >,
) {
  const actor = await requireAuditActor();
  const auditService = createAuditService();

  return auditService.recordEvent({
    ...input,
    actor,
  });
}
