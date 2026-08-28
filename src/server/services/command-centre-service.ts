import { getDb } from "@/db/client";
import { getDatabaseConfig } from "@/db/config";
import { appEnv } from "@/lib/env";
import {
  createCommandCentreRepository,
  type CommandCentreRepository,
} from "@/server/repositories/command-centre-repository";
import type { QueueWorkerName } from "@/server/repositories/background-jobs-repository";

import {
  createBackgroundJobInfrastructureService,
} from "./background-job-infrastructure-service";

type CommandCentreDependencies = {
  repository?: CommandCentreRepository;
  jobsService?: ReturnType<typeof createBackgroundJobInfrastructureService>;
  now?: () => Date;
};

function getRepository(repository?: CommandCentreRepository) {
  if (repository) {
    return repository;
  }

  if (!getDatabaseConfig(appEnv).configured) {
    return null;
  }

  return createCommandCentreRepository(getDb());
}

export function createCommandCentreService(
  dependencies: CommandCentreDependencies = {},
) {
  const repository = getRepository(dependencies.repository);
  const jobsService =
    dependencies.jobsService ?? createBackgroundJobInfrastructureService();
  const now = dependencies.now ?? (() => new Date());

  return {
    async getSnapshot() {
      if (!repository) {
        return {
          qualifiedSupply: 0,
          directDemand: 0,
          supplyGap: 0,
          hotReplies: 0,
          viewingsToday: 0,
          activeDeals: 0,
          stalledItems: 0,
          overnightIntelligence: 0,
          queueDepth: 0,
          topAcquisitionTargets: [],
          nextActions: [],
          workerHealth: [] as Array<{
            workerName: QueueWorkerName;
            status: string;
            queueDepth: number;
            runningCount: number;
            recentFailures: number;
            paused: boolean;
            lastRun: Date | null;
          }>,
        };
      }

      const currentTime = now();
      const [
        qualifiedSupply,
        directDemand,
        supplyGap,
        hotReplies,
        viewingsToday,
        activeDeals,
        stalledItems,
        overnightIntelligence,
        queueDepth,
        topAcquisitionTargets,
        nextActions,
        workerHealth,
      ] = await Promise.all([
        repository.countQualifiedSupply(),
        repository.countDirectDemand(),
        repository.sumSupplyGap(),
        repository.countHotReplies(),
        repository.countViewingsToday(currentTime),
        repository.countActiveDeals(),
        repository.countStalledItems(currentTime),
        repository.countOvernightIntelligence(currentTime),
        repository.queueDepth(),
        repository.listTopAcquisitionTargets(),
        repository.listNextActions(),
        jobsService.workerHealth(),
      ]);

      return {
        qualifiedSupply,
        directDemand,
        supplyGap,
        hotReplies,
        viewingsToday,
        activeDeals,
        stalledItems,
        overnightIntelligence,
        queueDepth,
        topAcquisitionTargets,
        nextActions,
        workerHealth,
      };
    },
  };
}
