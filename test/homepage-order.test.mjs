import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("homepage orders the catalog section after hero", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  const catalog = readFileSync("src/components/home/fragrances-signatures.tsx", "utf8");
  assert.equal(page.includes("<HomeHero />"), true);
  assert.equal(page.includes("<FragrancesSignatures"), true);
  assert.equal(catalog.includes("<ProductGrid"), true);
  assert.equal(page.indexOf("<HomeHero />") < page.indexOf("<FragrancesSignatures"), true);
});
