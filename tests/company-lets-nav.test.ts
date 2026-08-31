import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(__dirname, "..");

test("company lets is surfaced in the internal navigation and page set", () => {
  const appShell = fs.readFileSync(
    path.join(repoRoot, "src", "components", "layout", "app-shell.tsx"),
    "utf8",
  );

  assert.match(appShell, /Company Lets/i);

  const companyLetsPage = path.join(
    repoRoot,
    "src",
    "app",
    "(internal)",
    "internal",
    "company-lets",
    "page.tsx",
  );

  assert.ok(fs.existsSync(companyLetsPage));
});
