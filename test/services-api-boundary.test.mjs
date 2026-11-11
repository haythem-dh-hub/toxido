import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

test("service layer and API boundary types exist", () => {
  assert.equal(existsSync("src/services/products-service.ts"), true);
  assert.equal(existsSync("src/services/cart-service.ts"), true);
  assert.equal(existsSync("src/types/api.ts"), true);
});
