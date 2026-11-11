import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

test("product detail route and component exist", () => {
  assert.equal(existsSync("src/app/products/[slug]/page.tsx"), true);
  assert.equal(existsSync("src/components/product/product-details.tsx"), true);
});
