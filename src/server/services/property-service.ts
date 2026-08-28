import type { NewProperty, Property } from "@/db/models";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import type {
  PropertyFilters,
  PropertyMutationInput,
  StockRoomPropertyCard,
} from "@/domain/property/types";
import { appEnv } from "@/lib/env";
import { canManageSources } from "@/server/auth/rbac";
import { createRepositories } from "@/server/repositories";

import { createAuditService } from "./audit-event-service";

type NewPropertyInput = Omit<NewProperty, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

type PropertyRepositoryLike = {
  createWithDefaults: (input: NewPropertyInput) => Promise<Property>;
  findById: (id: string) => Promise<Property | undefined>;
  listStockRoom: (
    filters?: PropertyFilters,
    pagination?: { limit?: number; offset?: number },
  ) => Promise<StockRoomPropertyCard[]>;
  updateById: (
    id: string,
    input: Partial<NewProperty>,
  ) => Promise<Property | undefined>;
  archiveById: (id: string) => Promise<Property | undefined>;
};

type PropertyServiceDependencies = {
  repository?: PropertyRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
};

function buildPropertyInsert(
  input: PropertyMutationInput,
  actor: AuditActor,
): NewPropertyInput {
  return {
    ...input,
    createdByUserId: actor.type === "user" ? actor.id : undefined,
  };
}

function ensurePropertyMutationAccess(
  actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
) {
  if (actor.role && !canManageSources(actor.role)) {
    throw new Error(
      "Only managers and admins can mutate stock room properties.",
    );
  }
}

function getRepository(
  repository?: PropertyRepositoryLike,
): PropertyRepositoryLike | null {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createRepositories().properties;
}

export function createPropertyService(
  dependencies: PropertyServiceDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const getAuditService = () =>
    dependencies.auditService ?? createAuditService();

  return {
    async listStockRoom(
      filters: PropertyFilters = {},
      pagination?: { limit?: number; offset?: number },
    ): Promise<StockRoomPropertyCard[]> {
      if (!repository) {
        return [];
      }

      return repository.listStockRoom(filters, pagination);
    },

    async createProperty(
      input: PropertyMutationInput,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ): Promise<Property> {
      ensurePropertyMutationAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before properties can be created.",
        );
      }

      const property = await repository.createWithDefaults(
        buildPropertyInsert(input, actor),
      );

      await getAuditService().recordEvent({
        actor,
        action: "property.created",
        entityType: "property",
        entityId: property.id,
        metadata: {
          postcode: property.postcode,
          borough: property.borough,
          status: property.status,
          companyLetFit: property.companyLetFit,
        },
        afterState: {
          status: property.status,
          monthlyRentCents: property.monthlyRentCents,
          availability: property.availability,
        },
      });

      return property;
    },

    async updateProperty(
      id: string,
      input: Partial<PropertyMutationInput>,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ): Promise<Property | undefined> {
      ensurePropertyMutationAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before properties can be updated.",
        );
      }

      const before = await repository.findById(id);

      if (!before) {
        return undefined;
      }

      const updated = await repository.updateById(id, input);

      if (!updated) {
        return undefined;
      }

      await getAuditService().recordEvent({
        actor,
        action: "property.updated",
        entityType: "property",
        entityId: updated.id,
        metadata: {
          changedFields: Object.keys(input),
        },
        beforeState: {
          status: before.status,
          monthlyRentCents: before.monthlyRentCents,
          availability: before.availability,
          companyLetFit: before.companyLetFit,
        },
        afterState: {
          status: updated.status,
          monthlyRentCents: updated.monthlyRentCents,
          availability: updated.availability,
          companyLetFit: updated.companyLetFit,
        },
      });

      return updated;
    },

    async archiveProperty(
      id: string,
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ): Promise<Property | undefined> {
      ensurePropertyMutationAccess(actor);

      if (!repository) {
        throw new Error(
          "DATABASE_URL is required before properties can be archived.",
        );
      }

      const before = await repository.findById(id);

      if (!before) {
        return undefined;
      }

      const archived = await repository.archiveById(id);

      if (!archived) {
        return undefined;
      }

      await getAuditService().recordEvent({
        actor,
        action: "property.archived",
        entityType: "property",
        entityId: archived.id,
        metadata: {
          status: archived.status,
        },
        beforeState: {
          status: before.status,
          archivedAt: before.archivedAt,
        },
        afterState: {
          status: archived.status,
          archivedAt: archived.archivedAt,
        },
      });

      return archived;
    },
  };
}
