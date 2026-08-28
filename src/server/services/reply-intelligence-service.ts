import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canSendOutreach } from "@/server/auth/rbac";
import {
  createReplyIntelligenceRepository,
  type ExtractedReplyFact,
  type ReplyFactType,
} from "@/server/repositories/reply-intelligence-repository";

import { createAuditService } from "./audit-event-service";

type ReplyIntent =
  | "HOT"
  | "INTERESTED"
  | "FUTURE"
  | "QUESTION"
  | "UNCLEAR"
  | "NOT_INTERESTED"
  | "OPT_OUT";

type ReplyIntelligenceRepositoryLike = ReturnType<
  typeof createReplyIntelligenceRepository
>;

type ReplyIntelligenceDependencies = {
  repository?: ReplyIntelligenceRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
};

function getRepository(repository?: ReplyIntelligenceRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createReplyIntelligenceRepository(getDb());
}

function ensureAccess(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
  if (actor.role && !canSendOutreach(actor.role)) {
    throw new Error("Only authenticated team members can process replies.");
  }
}

function classifyIntent(text: string): { intent: ReplyIntent; confidence: number } {
  const normalized = text.toLowerCase();

  if (/(opt out|unsubscribe|stop emailing|remove me|do not contact)/i.test(normalized)) {
    return { intent: "OPT_OUT", confidence: 99 };
  }

  if (/(not interested|no thanks|do not proceed|not now)/i.test(normalized)) {
    return { intent: "NOT_INTERESTED", confidence: 92 };
  }

  if (/(call me|let's proceed|ready now|can move quickly|send options now)/i.test(normalized)) {
    return { intent: "HOT", confidence: 90 };
  }

  if (/(interested|sounds good|please share|open to)/i.test(normalized)) {
    return { intent: "INTERESTED", confidence: 82 };
  }

  if (/(next quarter|later|future|next year|not yet)/i.test(normalized)) {
    return { intent: "FUTURE", confidence: 78 };
  }

  if (/(\?|question|clarify|can you|what is|how much)/i.test(normalized)) {
    return { intent: "QUESTION", confidence: 74 };
  }

  return { intent: "UNCLEAR", confidence: 56 };
}

function extractFacts(text: string, sourceMessageId: string): ExtractedReplyFact[] {
  const facts: ExtractedReplyFact[] = [];

  const pushFact = (type: ReplyFactType, value: string, confidence: number) => {
    facts.push({
      type,
      value,
      confidence,
      sourceMessageId,
    });
  };

  const availability = /(available now|available from [^.,\n]+|move in [^.,\n]+)/i.exec(text);
  if (availability?.[1]) {
    pushFact("availability", availability[1], 78);
  }

  const units = /(\d+)\s*(?:units?|homes?|properties)/i.exec(text);
  if (units?.[1]) {
    pushFact("unit_count", units[1], 84);
  }

  const bedroomsRange = /(\d+)\s*(?:-|to)\s*(\d+)\s*bed/i.exec(text);
  if (bedroomsRange?.[1] && bedroomsRange?.[2]) {
    pushFact("bedrooms", `${bedroomsRange[1]}-${bedroomsRange[2]}`, 86);
  } else {
    const bedroomsSingle = /(\d+)\s*bed/i.exec(text);
    if (bedroomsSingle?.[1]) {
      pushFact("bedrooms", bedroomsSingle[1], 77);
    }
  }

  const location = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}|in\s+[A-Za-z\s-]{3,40})\b/i.exec(text);
  if (location?.[1]) {
    pushFact("location", location[1].trim(), 72);
  }

  const budgetRange = /\£?\s*([\d,]{3,})\s*(?:-|to)\s*\£?\s*([\d,]{3,})/i.exec(text);
  if (budgetRange?.[1] && budgetRange?.[2]) {
    pushFact("budget", `${budgetRange[1]}-${budgetRange[2]}`, 88);
  } else {
    const budgetSingle = /(?:budget|up to|max)\s*\£?\s*([\d,]{3,})/i.exec(text);
    if (budgetSingle?.[1]) {
      pushFact("budget", budgetSingle[1], 74);
    }
  }

  const timing = /(asap|immediate|within \d+ weeks?|next month|20\d{2}-\d{2}-\d{2})/i.exec(text);
  if (timing?.[1]) {
    pushFact("timing", timing[1], 76);
  }

  const nextStep = /(call|meeting|viewing|send shortlist|email options)/i.exec(text);
  if (nextStep?.[1]) {
    pushFact("next_step", nextStep[1], 68);
  }

  return facts;
}

function factsToRequirementPatch(facts: ExtractedReplyFact[]) {
  const patch: {
    preferredArea?: string;
    unitCount?: number;
    bedroomsMin?: number;
    bedroomsMax?: number;
    budgetMinCents?: number;
    budgetMaxCents?: number;
  } = {};

  for (const fact of facts) {
    if (fact.confidence < 65) {
      continue;
    }

    switch (fact.type) {
      case "location":
        patch["preferredArea"] = fact.value;
        break;
      case "unit_count": {
        const parsed = Number.parseInt(fact.value, 10);
        if (Number.isFinite(parsed)) {
          patch["unitCount"] = parsed;
        }
        break;
      }
      case "bedrooms": {
        const range = /(\d+)\s*[-]\s*(\d+)/.exec(fact.value);
        if (range?.[1] && range?.[2]) {
          patch["bedroomsMin"] = Number.parseInt(range[1], 10);
          patch["bedroomsMax"] = Number.parseInt(range[2], 10);
        } else {
          const exact = Number.parseInt(fact.value, 10);
          if (Number.isFinite(exact)) {
            patch["bedroomsMin"] = exact;
            patch["bedroomsMax"] = exact;
          }
        }
        break;
      }
      case "budget": {
        const range = /([\d,]{3,})\s*[-]\s*([\d,]{3,})/.exec(fact.value);
        if (range?.[1] && range?.[2]) {
          patch["budgetMinCents"] =
            Number.parseInt(range[1].replace(/,/g, ""), 10) * 100;
          patch["budgetMaxCents"] =
            Number.parseInt(range[2].replace(/,/g, ""), 10) * 100;
        } else {
          const max = Number.parseInt(fact.value.replace(/,/g, ""), 10);
          if (Number.isFinite(max)) {
            patch["budgetMaxCents"] = max * 100;
          }
        }
        break;
      }
      case "timing":
      case "next_step":
      case "availability":
        break;
    }
  }

  return patch;
}

export function createReplyIntelligenceService(
  dependencies: ReplyIntelligenceDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const getAuditService = () => dependencies.auditService ?? createAuditService();

  return {
    classifyIntent,

    async processInboundMessage(
      input: {
        messageId: string;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureAccess(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before reply intelligence can run.");
      }

      const context = await repository.getMessageContext(input.messageId);
      if (!context) {
        throw new Error("Message not found.");
      }

      if (!context.conversation) {
        throw new Error("Message conversation not found.");
      }

      if (context.message.direction !== "inbound") {
        throw new Error("Reply intelligence only processes inbound messages.");
      }

      const { intent, confidence } = classifyIntent(context.message.bodyText);
      const facts = extractFacts(context.message.bodyText, context.message.id);

      await repository.createReplyIntelligenceEvent({
        conversationId: context.conversation.id,
        messageId: context.message.id,
        leadId: context.conversation.leadId,
        intent,
        confidence,
        extractedFacts: facts,
      });

      const summary = `intent=${intent} confidence=${confidence} facts=${facts.length}`;
      await repository.updateConversationCategory(context.conversation.id, intent, summary);

      if (intent === "OPT_OUT" && context.contact?.id && context.contact.email) {
        await repository.suppressContactImmediately({
          contactId: context.contact.id,
          email: context.contact.email,
          ...(actor.userId ? { createdByUserId: actor.userId } : {}),
          notes: `Auto-suppressed from inbound message ${context.message.id}`,
        });
      }

      if (intent !== "UNCLEAR" && context.conversation.leadId) {
        const requirement = await repository.findRequirementByLead(context.conversation.leadId);
        const patch = factsToRequirementPatch(facts);

        if (Object.keys(patch).length > 0) {
          if (requirement) {
            await repository.updateRequirement(requirement.id, patch);
          } else {
            const created = await repository.createRequirementForLead({
              leadId: context.conversation.leadId,
              companyId: null,
              contactId: context.conversation.contactId,
              ownerUserId: actor.userId ?? null,
              notes: "Created from reply intelligence",
            });

            if (created) {
              await repository.updateRequirement(created.id, patch);
            }
          }
        }
      }

      await getAuditService().recordEvent({
        actor,
        action: "inbox.reply.intelligence.processed",
        entityType: "message",
        entityId: context.message.id,
        metadata: {
          conversationId: context.conversation.id,
          intent,
          confidence,
          factCount: facts.length,
          escalatedToHuman: intent === "UNCLEAR",
          autoSuppressed: intent === "OPT_OUT",
        },
      });

      return {
        intent,
        confidence,
        extractedFacts: facts,
        escalatedToHuman: intent === "UNCLEAR",
      };
    },
  };
}
