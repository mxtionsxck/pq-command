import { createBackgroundJobInfrastructureService } from "@/server/services/background-job-infrastructure-service";

function readPollMs() {
  const raw = Number.parseInt(process.env["PQ_BOT_POLL_MS"] ?? "", 10);

  if (!Number.isFinite(raw) || raw < 5_000) {
    return 60_000;
  }

  return raw;
}

async function main() {
  const service = createBackgroundJobInfrastructureService();
  const pollMs = readPollMs();
  const workerId = `constant-sourcing-bot-${process.pid}`;
  let stopped = false;
  const intervalRef: { current?: NodeJS.Timeout } = {};
  let warnedMissingDatabase = false;

  const tick = async () => {
    if (stopped) {
      return;
    }

    try {
      const result = await service.runAutomationTick({ workerId });
      warnedMissingDatabase = false;
      console.log(
        `[pq-bot] ${new Date().toISOString()} scheduled=${result.scheduledCount} processed=${result.processed}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (message.includes("DATABASE_URL is required")) {
        if (!warnedMissingDatabase) {
          console.warn(
            "[pq-bot] waiting for DATABASE_URL before constant sourcing can run.",
          );
          warnedMissingDatabase = true;
        }

        return;
      }

      console.error(`[pq-bot] tick failed: ${message}`);
    }
  };

  const shutdown = async (signal: string) => {
    stopped = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    try {
      await service.requestGracefulShutdown();
    } finally {
      console.log(`[pq-bot] shutdown requested via ${signal}`);
      process.exit(0);
    }
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await tick();
  intervalRef.current = setInterval(() => {
    void tick();
  }, pollMs);
}

void main();
