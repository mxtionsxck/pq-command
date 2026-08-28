import { createBackgroundJobInfrastructureService } from "@/server/services/background-job-infrastructure-service";

export interface JobDescriptor {
  name: string;
  schedule: string;
  run: (input: {
    sourceId?: string;
    idempotencyKey: string;
  }) => Promise<unknown>;
}

export function listJobs(): JobDescriptor[] {
  const service = createBackgroundJobInfrastructureService();

  return service.workerNames.map((workerName) => ({
    name: workerName,
    schedule: "*/15 * * * *",
    run: (input) =>
      service.enqueueJob({
        workerName,
        idempotencyKey: input.idempotencyKey,
        payload: {
          ...(input.sourceId ? { sourceId: input.sourceId } : {}),
        },
      }),
  }));
}
