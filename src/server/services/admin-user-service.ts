import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";

import { createRepositories } from "../repositories";

export function createAdminUserService() {
  return {
    async listUsers(limit = 100) {
      const database = getDatabaseConfig(appEnv);

      if (!database.configured) {
        return [];
      }

      const repositories = createRepositories();

      return repositories.users.list(limit);
    },
  };
}
