import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(__dirname, "..");

const filePath = path.join(
  repoRoot,
  "src",
  "server",
  "hotel",
  "pq-master-inventory.ts",
);

test("hotel master inventory loads the current 123-record PQ stock set and excludes the distressed UK portfolio", () => {
  const content = fs.readFileSync(filePath, "utf8");

  const match = content.match(/const PQ_SUPPLIED_HOTEL_INVENTORY_TEXT = `([\s\S]*?)`;/);
  assert.ok(match, "PQ_SUPPLIED_HOTEL_INVENTORY_TEXT should be defined");

  const inventoryText = match?.[1] ?? "";
  const lines = inventoryText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && /^\d+\./.test(line));

  assert.equal(lines.length, 123, "The imported current stock list should contain 123 records");
  assert.doesNotMatch(
    content,
    /Distressed UK Hotel Portfolio|DISTRESSED UK HOTEL PORTFOLIO/i,
    "The distressed UK portfolio must remain excluded from the current imported stock list.",
  );
  assert.match(
    content,
    /REMOVAL REQUESTED.*EXCLUDED FROM CURRENT PQ STOCK|EXCLUDED FROM CURRENT PQ STOCK.*REMOVAL REQUESTED/i,
    "Excluded records must be explicitly flagged as removal requested and excluded from current stock.",
  );
  assert.match(content, /VERIFICATION REQUIRED/i, "PQ supplied stock should remain verification-required.");
});
