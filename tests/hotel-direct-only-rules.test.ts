import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(__dirname, "..");

test("hotel engine includes a direct-only stock subpage and company-let investor criteria", () => {
  const hotelPage = path.join(
    repoRoot,
    "src",
    "app",
    "(internal)",
    "internal",
    "hotel-deals",
    "page.tsx",
  );
  const stockPage = path.join(
    repoRoot,
    "src",
    "app",
    "(internal)",
    "internal",
    "hotel-deals",
    "stock",
    "page.tsx",
  );

  assert.ok(fs.existsSync(hotelPage), "Hotel Engine page should exist");
  assert.ok(fs.existsSync(stockPage), "Hotel stock subpage should exist");

  const hotelContent = fs.readFileSync(hotelPage, "utf8");
  const stockContent = fs.readFileSync(stockPage, "utf8");

  assert.match(
    hotelContent,
    /DIRECT LEADS|NO AGENTS|NO MIDDLE MEN|DIRECT-ONLY/i,
    "Hotel engine should explicitly enforce direct-only sourcing.",
  );
  assert.match(
    hotelContent,
    /15-60\+|3-10.*bedrooms|multiple unit|blocks and houses/i,
    "Company-let investor criteria should include the requested unit and bedroom thresholds.",
  );

  assert.match(
    stockContent,
    /Hotel Stock|CURRENT PQ|VERIFICATION REQUIRED|EmptyState|temporarily unavailable/i,
    "Hotel stock subpage should render safely without runtime error states.",
  );
});
