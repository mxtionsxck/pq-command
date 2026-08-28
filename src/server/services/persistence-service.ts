import { getDb } from "@/db/client";

import { createRepositories } from "../repositories";
import { createAuditService } from "./audit-event-service";
import { createPropertyService } from "./property-service";

export function createPersistenceService() {
  const db = getDb();
  const repositories = createRepositories(db);

  return {
    db,
    repositories,
    auditService: createAuditService({
      repository: repositories.auditEvents,
    }),
    propertyService: createPropertyService({
      repository: repositories.properties,
    }),
  };
}
