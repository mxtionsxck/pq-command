import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(__dirname, "..");

const files = [
  "src/app/(internal)/internal/acquisition/page.tsx",
  "src/app/(internal)/internal/company-lets/page.tsx",
  "src/app/(internal)/internal/companies/page.tsx",
  "src/app/(internal)/internal/demand-room/page.tsx",
  "src/app/(internal)/internal/hotel-deals/page.tsx",
  "src/app/(internal)/internal/inbox/page.tsx",
  "src/app/(internal)/internal/stock-room/page.tsx",
];

test("critical internal pages guard database failures with a safe empty state", () => {
  for (const file of files) {
    const content = fs.readFileSync(path.join(repoRoot, file), "utf8");
    assert.match(content, /try\s*\{/);
    assert.match(content, /temporarily unavailable|unavailable|safe fallback/i);
  }
});
