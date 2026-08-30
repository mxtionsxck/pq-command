import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(__dirname, "..");

test("production startup includes database migrations before server or bot boot", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };

  assert.equal(packageJson.scripts?.prestart, "npm run db:migrate");
  assert.equal(packageJson.scripts?.prebot, "npm run db:migrate");

  const dockerfile = fs.readFileSync(
    path.join(repoRoot, "Dockerfile"),
    "utf8",
  );

  assert.match(dockerfile, /npm run db:migrate.*node server\.js/s);
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
    /ALTER TABLE "leads".*ADD COLUMN IF NOT EXISTS "lead_type" "public"\."lead_type"/s,
  );
  assert.match(
    migrationText,
    /ALTER TABLE "leads".*ADD COLUMN IF NOT EXISTS "directness_classification" "public"\."directness_classification"/s,
  );
  assert.match(
    migrationText,
    /ALTER TABLE "leads".*ADD COLUMN IF NOT EXISTS "directness_verified" boolean/s,
  );
});
