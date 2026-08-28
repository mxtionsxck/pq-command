import assert from "node:assert/strict";
import test from "node:test";

import { loadAppEnv } from "../src/lib/env";

test("loadAppEnv applies safe defaults", () => {
  const env = loadAppEnv({ NODE_ENV: "test" });

  assert.equal(env.APP_NAME, "PQ COMMAND");
  assert.equal(env.APP_ENV, "test");
  assert.equal(env.DATABASE_URL, undefined);
});

test("loadAppEnv validates URL values", () => {
  assert.throws(
    () => loadAppEnv({ NODE_ENV: "test", SLACK_WEBHOOK_URL: "not-a-url" }),
    /SLACK_WEBHOOK_URL must be a valid URL/,
  );
});

test("loadAppEnv requires paired public business connector credentials", () => {
  assert.throws(
    () =>
      loadAppEnv({
        NODE_ENV: "test",
        PUBLIC_BUSINESS_DATA_API_URL: "https://api.public.example.org",
      }),
    /PUBLIC_BUSINESS_DATA_API_URL and PUBLIC_BUSINESS_DATA_API_KEY must be configured together/,
  );
});

test("loadAppEnv requires paired local admin credentials", () => {
  assert.throws(
    () =>
      loadAppEnv({
        NODE_ENV: "test",
        AUTH_LOCAL_ADMIN_USERNAME: "PQADMIN",
      }),
    /AUTH_LOCAL_ADMIN_USERNAME and AUTH_LOCAL_ADMIN_PASSWORD must be configured together/,
  );
});
