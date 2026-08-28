import type { Lead, NewLead } from "@/db/models";
import type { AuditActor } from "@/domain/audit/types";

import { createAuditService } from "./audit-event-service";

type LeadRepositoryLike = {
  create: (input: NewLead) => Promise<Lead>;
};

type LeadServiceDependencies = {
  repository: LeadRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
};

export function createLeadService({
  repository,
  auditService = createAuditService(),
}: LeadServiceDependencies) {
  return {
    async createLead(input: NewLead, actor: AuditActor): Promise<Lead> {
      const lead = await repository.create(input);

      await auditService.recordEvent({
        actor,
        action: "lead.created",
        entityType: "lead",
        entityId: lead.id,
        metadata: {
          sourceId: lead.sourceId,
          contactId: lead.contactId,
          companyId: lead.companyId,
          status: lead.status,
        },
        afterState: {
          status: lead.status,
          ownerUserId: lead.ownerUserId,
        },
      });

      return lead;
    },
  };
}
