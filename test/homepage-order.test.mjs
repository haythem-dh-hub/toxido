import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("homepage orders product grid after hero", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  assert.equal(page.includes("<HomeHero />"), true);
  assert.equal(page.includes("<ProductGrid"), true);
  assert.equal(page.indexOf("<HomeHero />") < page.indexOf("<ProductGrid"), true);
});
