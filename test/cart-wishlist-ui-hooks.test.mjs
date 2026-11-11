import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

test("cart and wishlist UI hook files exist", () => {
  assert.equal(existsSync("src/features/cart/use-cart.ts"), true);
  assert.equal(existsSync("src/features/wishlist/use-wishlist.ts"), true);
});
