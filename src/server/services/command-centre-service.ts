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
import { createHotelDealIntelligenceService } from "./hotel-deal-intelligence-service";

type CommandCentreDependencies = {
  repository?: CommandCentreRepository;
  jobsService?: ReturnType<typeof createBackgroundJobInfrastructureService>;
  hotelService?: {
    getPipelineSnapshot: () => Promise<{
      hotDirectStock: number;
      hotDirectBuyers: number;
      readyToReachOut: number;
      respondedHumanActionRequired: number;
      dealsInProgress: number;
    }>;
  };
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
  const hotelService =
    dependencies.hotelService ??
    (getDatabaseConfig(appEnv).configured
      ? createHotelDealIntelligenceService()
      : {
          async getPipelineSnapshot() {
            return {
              hotDirectStock: 0,
              hotDirectBuyers: 0,
              readyToReachOut: 0,
              respondedHumanActionRequired: 0,
              dealsInProgress: 0,
            };
          },
        });
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
          hotel: {
            hotDirectStock: 0,
            hotDirectBuyers: 0,
            readyToReachOut: 0,
            respondedHumanActionRequired: 0,
            dealsInProgress: 0,
          },
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
        hotelSnapshot,
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
        hotelService.getPipelineSnapshot(),
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
        hotel: {
          hotDirectStock: hotelSnapshot.hotDirectStock,
          hotDirectBuyers: hotelSnapshot.hotDirectBuyers,
          readyToReachOut: hotelSnapshot.readyToReachOut,
          respondedHumanActionRequired: hotelSnapshot.respondedHumanActionRequired,
          dealsInProgress: hotelSnapshot.dealsInProgress,
        },
      };
    },
  };
}
