import assert from "node:assert/strict";
import test from "node:test";

import { buildHealthSnapshot } from "../src/server/services/health-service";
import { loadAppEnv } from "../src/lib/env";

test("buildHealthSnapshot returns baseline operational state", () => {
  const env = loadAppEnv({ NODE_ENV: "test" });
  const snapshot = buildHealthSnapshot(
    new Date("2026-08-28T00:00:00.000Z"),
    env,
  );

  assert.equal(snapshot.service, "PQ COMMAND");
  assert.equal(snapshot.environment, "test");
  assert.equal(snapshot.status, "ok");
  assert.equal(snapshot.timestamp, "2026-08-28T00:00:00.000Z");
  assert.equal(snapshot.checks.length, 5);
  assert.match(snapshot.checks[1]?.detail ?? "", /DATABASE_URL not configured/);
});
