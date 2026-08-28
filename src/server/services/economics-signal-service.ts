import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { AuditActor } from "@/domain/audit/types";
import { appEnv } from "@/lib/env";
import { canManageSources } from "@/server/auth/rbac";
import { createEconomicsSignalRepository } from "@/server/repositories/economics-signal-repository";

import { createAuditService } from "./audit-event-service";

type EconomicsRepositoryLike = ReturnType<typeof createEconomicsSignalRepository>;

type EconomicsDependencies = {
  repository?: EconomicsRepositoryLike;
  auditService?: ReturnType<typeof createAuditService>;
};

function getRepository(repository?: EconomicsRepositoryLike) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createEconomicsSignalRepository(getDb());
}

function ensureManager(actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" }) {
  if (!actor.role || !canManageSources(actor.role)) {
    throw new Error("Only management can manage economics signals.");
  }
}

function inferBedroomBand(bedrooms: number | null) {
  if (!bedrooms || bedrooms <= 1) {
    return "1";
  }

  if (bedrooms === 2) {
    return "2";
  }

  if (bedrooms === 3) {
    return "3";
  }

  return "4+";
}

export function createEconomicsSignalService(
  dependencies: EconomicsDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const auditService = dependencies.auditService ?? createAuditService();

  return {
    async addLhaRate(
      input: {
        borough?: string;
        area?: string;
        bedroomBand: string;
        monthlyRateCents: number;
        rateSource: string;
        rateReference: string;
        rateDate: Date;
        rateVersion: string;
        sourceApproved: boolean;
        notes?: string;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureManager(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before economics signals can run.");
      }

      if (!input.sourceApproved) {
        throw new Error("LHA rates must come from an approved source.");
      }

      const created = await repository.createLhaRate({
        borough: input.borough ?? null,
        area: input.area ?? null,
        bedroomBand: input.bedroomBand,
        monthlyRateCents: input.monthlyRateCents,
        rateSource: input.rateSource,
        rateReference: input.rateReference,
        rateDate: input.rateDate,
        rateVersion: input.rateVersion,
        sourceApproved: input.sourceApproved,
        notes: input.notes ?? null,
      });

      await auditService.recordEvent({
        actor,
        action: "economics.lha_rate.created",
        entityType: "lha_rate",
        entityId: created?.id ?? "unknown",
        metadata: {
          rateSource: input.rateSource,
          rateReference: input.rateReference,
          rateVersion: input.rateVersion,
        },
      });

      return created;
    },

    async evaluateProperty(
      input: {
        propertyId: string;
        bedroomBand?: string;
        rateVersion?: string;
        notifyManagerUserId?: string;
        notifyEnabled: boolean;
      },
      actor: AuditActor & { role?: "ADMIN" | "MANAGER" | "AGENT" },
    ) {
      ensureManager(actor);

      if (!repository) {
        throw new Error("DATABASE_URL is required before economics signals can run.");
      }

      const property = await repository.getProperty(input.propertyId);
      if (!property) {
        throw new Error("Property not found.");
      }

      if (property.monthlyRentCents === null) {
        throw new Error("Property must have known rent before economics evaluation.");
      }

      const bedroomBand = input.bedroomBand ?? inferBedroomBand(property.bedrooms);
      const rate = await repository.findLhaRate({
        borough: property.borough,
        area: property.city,
        bedroomBand,
        ...(input.rateVersion ? { rateVersion: input.rateVersion } : {}),
      });

      if (!rate || !rate.sourceApproved) {
        throw new Error("No approved LHA rate found for this property filter.");
      }

      const differenceCents = rate.monthlyRateCents - property.monthlyRentCents;
      const signal = await repository.upsertEconomicsSignal({
        propertyId: property.id,
        lhaRateId: rate.id,
        bedroomBand,
        knownRentCents: property.monthlyRentCents,
        lhaRateCents: rate.monthlyRateCents,
        differenceCents,
        signalStatus: "informational",
        notifyEnabled: input.notifyEnabled,
        notes:
          "Informational only. Does not imply council acceptance and does not auto-place property.",
      });

      let notificationId: string | undefined;
      if (input.notifyEnabled && input.notifyManagerUserId) {
        const notification = await repository.createNotification({
          userId: input.notifyManagerUserId,
          title: "LHA economics signal",
          body:
            `Property ${property.title} has LHA delta ${differenceCents / 100} GBP against approved rate ${rate.rateVersion}. Informational only.`,
          linkHref: `/internal/economics-signals?propertyId=${property.id}`,
        });

        notificationId = notification?.id;
      }

      await auditService.recordEvent({
        actor,
        action: "economics.signal.evaluated",
        entityType: "property",
        entityId: property.id,
        metadata: {
          propertyId: property.id,
          lhaRateId: rate.id,
          differenceCents,
          notifyEnabled: input.notifyEnabled,
          notificationId,
          autoPlacement: false,
        },
      });

      return {
        signal,
        rate,
        notificationId,
      };
    },

    async listSignals() {
      if (!repository) {
        return [];
      }

      return repository.listSignals();
    },
  };
}
