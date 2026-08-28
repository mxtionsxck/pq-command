import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import type { Company } from "@/db/models";
import type { PropertyRoomRecord } from "@/domain/property/room-types";
import { appEnv } from "@/lib/env";
import { createRepositories } from "@/server/repositories";
import { createAuditService } from "@/server/services/audit-event-service";
import { createPropertyAssetsService } from "@/server/services/property-assets-service";

import { createPropertyRepository } from "../repositories/property-repository";

export function createPropertyRoomService() {
  return {
    async getPropertyRoom(
      propertyId: string,
    ): Promise<PropertyRoomRecord | null> {
      if (!getDatabaseConfig(appEnv).configured) {
        return null;
      }

      const db = getDb();
      const repositories = createRepositories(db);
      const propertyRepository = createPropertyRepository(db);
      const property = await propertyRepository.findById(propertyId);

      if (!property) {
        return null;
      }

      const assetsService = createPropertyAssetsService();
      const company = await (async (): Promise<Company | null> => {
        if (!property.companyId) {
          return null;
        }

        return (
          (await repositories.companies.findById(property.companyId)) ?? null
        );
      })();

      const media = await assetsService.listMedia(propertyId);
      const documents = await assetsService.listDocuments(propertyId);

      return {
        property,
        company,
        media,
        documents,
      };
    },

    async listPropertyActivity(propertyId: string) {
      if (!getDatabaseConfig(appEnv).configured) {
        return [];
      }

      return createAuditService().listRecent({
        entityType: "property",
        entityId: propertyId,
        limit: 100,
      });
    },
  };
}
