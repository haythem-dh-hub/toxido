import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

async function loadTypeScriptModule(path) {
  const source = readFileSync(path, "utf8").replace(/^import ["']server-only["'];\r?\n/m, "");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const cartUtils = await loadTypeScriptModule("src/features/cart/cart-utils.ts");
const pricing = await loadTypeScriptModule("src/features/products/variant-pricing.ts");
const variantImage = await loadTypeScriptModule("src/features/products/variant-image.ts");
const supabaseServer = await loadTypeScriptModule("src/lib/supabase-server.ts");
const {
  addVariantToCart,
  buildCheckoutItems,
  calculateCartSubtotal,
  cartItemKey,
  isVariantAvailable,
  normalizeCartItems,
  resolveCartLines,
  resolveCartVariant,
} = cartUtils;
const { cartLineTotal, moneyFromMillimes } = pricing;
const { imageForVariant } = variantImage;

const variants = [
  { id: "variant-50", name: "50 ml", size: "50 ml", sku: "TX-EMBER-50", stock: 4, price: moneyFromMillimes(35000) },
  { id: "variant-100", name: "100 ml", size: "100 ml", sku: "TX-EMBER-100", stock: 2, price: moneyFromMillimes(50000) },
];
const product = { id: "product-ember", slug: "toxido-ember", variants };

test("selected fragrance size maps to the matching database image with a safe fallback", () => {
  const images = [
    { id: "toxido-ember-50", alt: "Toxido Ember 50 ml", url: "/images/products/toxido-ember-50.png", width: 1, height: 1 },
    { id: "toxido-ember-100", alt: "Toxido Ember 100 ml", url: "/images/products/toxido-ember-100.png", width: 1, height: 1 },
  ];

  assert.equal(imageForVariant(images, variants[0]), images[0]);
  assert.equal(imageForVariant(images, variants[1]), images[1]);
  assert.equal(imageForVariant([images[1]], variants[0]), images[1]);
  assert.equal(imageForVariant(images, { ...variants[1], name: "Signature size", size: undefined }), images[0]);
});

test("50 ml and 100 ml variants display the configured TND prices and line totals", () => {
  assert.deepEqual(variants.map((variant) => [variant.size, variant.price.amount]), [["50 ml", 35], ["100 ml", 50]]);
  assert.equal(cartLineTotal(variants[0].price, 2).amount, 70);
  assert.equal(cartLineTotal(variants[1].price, 2).amount, 100);
  assert.equal(resolveCartVariant({ productSlug: product.slug, variantId: "variant-100", quantity: 1 }, product).sku, "TX-EMBER-100");
});

test("cart persistence keeps separate selected variant IDs and SKUs for both sizes", () => {
  let cart = [];
  cart = addVariantToCart(cart, product.slug, variants[0], variants[0].id);
  cart = addVariantToCart(cart, product.slug, variants[1], variants[0].id);
  const persisted = normalizeCartItems(JSON.parse(JSON.stringify(cart)));
  const lines = resolveCartLines(persisted, [product]);

  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map((line) => [line.variant.id, line.item.variantSku]), [
    ["variant-50", "TX-EMBER-50"],
    ["variant-100", "TX-EMBER-100"],
  ]);
  assert.deepEqual(lines.map(({ item }) => cartItemKey(item)), ["toxido-ember:variant-50", "toxido-ember:variant-100"]);
  assert.deepEqual(buildCheckoutItems(lines), [
    { slug: "toxido-ember", variantId: "variant-50", quantity: 1 },
    { slug: "toxido-ember", variantId: "variant-100", quantity: 1 },
  ]);
  assert.equal(calculateCartSubtotal(lines), 85);
});

test("out-of-stock sizes are unavailable and cannot pass checkout validation", () => {
  const unavailable100 = { ...variants[1], stock: 0 };
  const unavailableProduct = { ...product, variants: [variants[0], unavailable100] };
  const lines = resolveCartLines([
    { productSlug: product.slug, variantId: unavailable100.id, variantSku: unavailable100.sku, variantName: unavailable100.name, quantity: 1 },
  ], [unavailableProduct]);

  assert.equal(isVariantAvailable(unavailable100), false);
  assert.equal(buildCheckoutItems(lines), null);
  assert.equal(isVariantAvailable(variants[1], 2), true);
  assert.equal(isVariantAvailable(variants[1], 3), false);
});

test("fixed promotional RPC is pinned to the three 50 ml variants at individual price", () => {
  const migration = readFileSync("supabase/migrations/202611160001_toxido_fixed_trio.sql", "utf8");
  const route = readFileSync("src/app/api/orders/route.ts", "utf8");
  for (const slug of ["toxido-ember", "toxido-wanted-night", "toxido-erba"]) assert.ok(migration.includes(`('${slug}')`));
  assert.match(migration, /v\.name = '50 ml'/);
  assert.doesNotMatch(migration, /100 ml/);
  assert.match(migration, /v_product\.price_millimes <> 35000/);
  assert.match(migration, /v_product\.stock < p_quantity/);
  assert.match(migration, /v_discount := 55000 \* p_quantity/);
  assert.match(migration, /v_total <> 50000 \* p_quantity/);
  assert.match(route, /create_fixed_trio_cod_order/);
});

test("individual COD RPC resolves the requested variant ID from the database", () => {
  const migration = readFileSync("supabase/migrations/202611160002_order_selected_variants.sql", "utf8");
  assert.match(migration, /v\.id = \(v_line->>'variantId'\)::uuid/);
  assert.match(migration, /v_product\.stock < v_quantity/);
  assert.match(migration, /v_product\.price_millimes \* v_quantity/);
});

test("production Supabase settings reject unencrypted remote URLs", () => {
  const names = ["NODE_ENV", "SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const anonKey = `sb_publishable_${"A".repeat(22)}_${"B".repeat(8)}`;
  const secretKey = `sb_secret_${"C".repeat(22)}_${"D".repeat(8)}`;
  try {
    process.env.NODE_ENV = "production";
    process.env.SUPABASE_ANON_KEY = anonKey;
    process.env.SUPABASE_SERVICE_ROLE_KEY = secretKey;
    process.env.SUPABASE_URL = "http://db.example.test";
    assert.equal(supabaseServer.getSupabaseSettings(true), null);
    process.env.SUPABASE_URL = "http://127.0.0.1:54321";
    assert.equal(supabaseServer.getSupabaseSettings(true), null);
    process.env.SUPABASE_URL = "https://db.example.test";
    assert.equal(supabaseServer.getSupabaseSettings(true)?.url.protocol, "https:");
    assert.equal(supabaseServer.getSupabaseSettings(true)?.serviceRoleKeyKind, "secret");
    process.env.NODE_ENV = "development";
    process.env.SUPABASE_URL = "http://localhost:54321";
    assert.equal(supabaseServer.getSupabaseSettings(true)?.url.protocol, "http:");
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_incomplete";
    assert.equal(supabaseServer.getSupabaseSettings(true), null);
    const claims = Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url");
    process.env.SUPABASE_SERVICE_ROLE_KEY = `eyJhbGciOiJIUzI1NiJ9.${claims}.signature`;
    assert.equal(supabaseServer.getSupabaseSettings(true)?.serviceRoleKeyKind, "legacy-service-role-jwt");
  } finally {
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
});
