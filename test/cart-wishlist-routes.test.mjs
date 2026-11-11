import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

test("cart and wishlist route files exist", () => {
  assert.equal(existsSync("src/app/cart/page.tsx"), true);
  assert.equal(existsSync("src/app/wishlist/page.tsx"), true);
});
