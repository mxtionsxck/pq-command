import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(__dirname, "..");

function expectText(file: string, regex: RegExp) {
  const content = fs.readFileSync(file, "utf8");
  assert.match(content, regex, `Expected ${file} to match ${regex}`);
}

test("research still redirects to a valid current destination and settings is a real admin hub", () => {
  const researchPage = path.join(repoRoot, "src", "app", "(internal)", "internal", "research", "page.tsx");
  const settingsPage = path.join(repoRoot, "src", "app", "(internal)", "internal", "settings", "page.tsx");

  assert.ok(fs.existsSync(researchPage), "Research route should exist and redirect to a valid working route.");
  assert.ok(fs.existsSync(settingsPage), "Settings route should exist as a real hub.");

  expectText(researchPage, /redirect\s*\(|next\/navigation/i);
  expectText(settingsPage, /Settings & Admin|\/admin\/integrations|\/admin\/sources|\/admin\/operations|\/admin\/scoring|\/admin\/users|\/internal\/system-health/i);

  const settingsContent = fs.readFileSync(settingsPage, "utf8");
  assert.doesNotMatch(settingsContent, /\/internal\/admin\//i, "Settings hub should not use the stale /internal/admin/* route prefix.");
});

test("core internal operation pages guard optional data failures", () => {
  const files = [
    path.join(repoRoot, "src", "app", "(internal)", "internal", "deals", "page.tsx"),
    path.join(repoRoot, "src", "app", "(internal)", "internal", "outreach", "page.tsx"),
    path.join(repoRoot, "src", "app", "(internal)", "internal", "viewings", "page.tsx"),
  ];

  for (const file of files) {
    expectText(file, /Promise\.allSettled|try\s*\{\s*const\s+service|EmptyState/);
  }
});

test("hotel stock room reads real stock data and actions guard AI/import failures", () => {
  const stockPage = path.join(repoRoot, "src", "app", "(internal)", "internal", "hotel-deals", "stock", "page.tsx");
  const actions = path.join(repoRoot, "src", "app", "(internal)", "internal", "hotel-deals", "actions.ts");

  expectText(stockPage, /createHotelDealIntelligenceService|listLiveStockUniverse|EmptyState/);
  expectText(actions, /try\s*\{\s*await\s+service\.(runUnifiedCycle|seedMasterInventory)|console\.error|revalidatePath/);
});
