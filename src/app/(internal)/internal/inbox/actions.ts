"use server";

import { revalidatePath } from "next/cache";

import { createAuditActor } from "@/server/audit/helper";
import { requireCurrentUser } from "@/server/auth/session";
import { createInboxService } from "@/server/services/inbox-service";
import { createReplyIntelligenceService } from "@/server/services/reply-intelligence-service";

function readText(formData: FormData, key: string) {
  const value = formData.get(key);

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readDate(formData: FormData, key: string) {
  const value = readText(formData, key);
  if (!value) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function revalidateInbox() {
  revalidatePath("/internal/inbox");
}

export async function assignConversationAction(formData: FormData) {
  const conversationId = readText(formData, "conversationId");
  const ownerUserId = readText(formData, "ownerUserId");

  if (!conversationId || !ownerUserId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createInboxService();

  await service.assign(conversationId, ownerUserId, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateInbox();
}

export async function snoozeConversationAction(formData: FormData) {
  const conversationId = readText(formData, "conversationId");
  const snoozedUntil = readDate(formData, "snoozedUntil");

  if (!conversationId || !snoozedUntil) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createInboxService();

  await service.snooze(conversationId, snoozedUntil, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateInbox();
}

export async function saveReplyDraftAction(formData: FormData) {
  const conversationId = readText(formData, "conversationId");
  const bodyText = readText(formData, "bodyText");

  if (!conversationId || !bodyText) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createInboxService();

  await service.saveReplyDraft(conversationId, bodyText, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateInbox();
}

export async function linkPropertyAction(formData: FormData) {
  const conversationId = readText(formData, "conversationId");
  const propertyId = readText(formData, "propertyId");

  if (!conversationId || !propertyId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createInboxService();

  await service.linkProperty(conversationId, propertyId, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateInbox();
}

export async function linkCompanyAction(formData: FormData) {
  const conversationId = readText(formData, "conversationId");
  const companyId = readText(formData, "companyId");

  if (!conversationId || !companyId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createInboxService();

  await service.linkCompany(conversationId, companyId, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateInbox();
}

export async function createRequirementAction(formData: FormData) {
  const conversationId = readText(formData, "conversationId");
  if (!conversationId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createInboxService();

  await service.createRequirement(conversationId, readText(formData, "notes"), {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateInbox();
}

export async function createTaskAction(formData: FormData) {
  const conversationId = readText(formData, "conversationId");
  const title = readText(formData, "title");

  if (!conversationId || !title) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createInboxService();
  const description = readText(formData, "description");
  const assignedToUserId = readText(formData, "assignedToUserId");

  await service.createTask(
    {
      conversationId,
      title,
      ...(description ? { description } : {}),
      ...(assignedToUserId ? { assignedToUserId } : {}),
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidateInbox();
}

export async function suppressContactAction(formData: FormData) {
  const conversationId = readText(formData, "conversationId");
  const reason = readText(formData, "reason") as
    "bounced" | "opt_out" | "manual" | "legal" | undefined;

  if (!conversationId || !reason) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createInboxService();

  await service.suppress(conversationId, reason, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateInbox();
}

export async function setCategoryAction(formData: FormData) {
  const conversationId = readText(formData, "conversationId");
  const category = readText(formData, "category") as
    | "HOT"
    | "INTERESTED"
    | "FUTURE"
    | "QUESTION"
    | "UNCLEAR"
    | "NOT_INTERESTED"
    | "OPT_OUT"
    | undefined;

  if (!conversationId || !category) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createInboxService();

  await service.setCategory(conversationId, category, {
    ...createAuditActor(user),
    role: user.role,
  });

  revalidateInbox();
}

export async function processReplyIntelligenceAction(formData: FormData) {
  const messageId = readText(formData, "messageId");

  if (!messageId) {
    return;
  }

  const user = await requireCurrentUser();
  const service = createReplyIntelligenceService();

  await service.processInboundMessage(
    {
      messageId,
    },
    {
      ...createAuditActor(user),
      role: user.role,
    },
  );

  revalidateInbox();
}
