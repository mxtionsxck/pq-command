import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(__dirname, "..");

test("production startup includes database migrations before server or bot boot", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };

  assert.equal(packageJson.scripts?.["prestart"], "npm run db:migrate");
  assert.equal(packageJson.scripts?.["prebot"], "npm run db:migrate");

  const dockerfile = fs.readFileSync(
    path.join(repoRoot, "Dockerfile"),
    "utf8",
  );

  const migrationIndex = dockerfile.indexOf("RUN npm run db:migrate");
  const serverIndex = dockerfile.indexOf('CMD ["node", "server.js"]');

  assert.notEqual(migrationIndex, -1, "Dockerfile should run database migrations");
  assert.notEqual(serverIndex, -1, "Dockerfile should start the server with CMD [\"node\", \"server.js\"]");
  assert.ok(
    migrationIndex < serverIndex,
    "Database migration must run before the server starts",
  );
});

test("lead schema migration includes the columns expected by the live lead room", () => {
  const migrationFiles = fs.readdirSync(path.join(repoRoot, "drizzle"));
  const migrationText = migrationFiles
    .filter((file) => file.endsWith(".sql"))
    .map((file) => fs.readFileSync(path.join(repoRoot, "drizzle", file), "utf8"))
    .join("\n");

  assert.match(
    migrationText,
    /CREATE TYPE "public"\."lead_type" AS ENUM\('supply', 'demand', 'ai_discovered'\)/,
  );
  assert.match(
    migrationText,
    /ALTER TABLE "leads"[\s\S]*ADD COLUMN IF NOT EXISTS "lead_type" "public"\."lead_type"/,
  );
  assert.match(
    migrationText,
    /ALTER TABLE "leads"[\s\S]*ADD COLUMN IF NOT EXISTS "directness_classification" "public"\."directness_classification"/,
  );
  assert.match(
    migrationText,
    /ALTER TABLE "leads"[\s\S]*ADD COLUMN IF NOT EXISTS "directness_verified" boolean/,
  );
});

test("runtime repair ensures the shared internal pages have their required tables and enums", () => {
  const migrateSource = fs.readFileSync(
    path.join(repoRoot, "src", "db", "migrate.ts"),
    "utf8",
  );

  assert.match(migrateSource, /CREATE TABLE IF NOT EXISTS requirements/);
  assert.match(migrateSource, /CREATE TABLE IF NOT EXISTS tasks/);
  assert.match(migrateSource, /CREATE TABLE IF NOT EXISTS deals/);
  assert.match(migrateSource, /CREATE TABLE IF NOT EXISTS viewings/);
  assert.match(migrateSource, /CREATE TABLE IF NOT EXISTS shortage_intelligence_rows/);
});
