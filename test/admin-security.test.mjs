import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

async function loadTs(path) {
  const source = readFileSync(path, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const security = await loadTs("src/features/admin/admin-security.ts");

test("admin identity allowlist fails closed and requires an exact configured user ID", () => {
  assert.equal(security.isAllowedAdminId("uuid-admin", undefined), false);
  assert.equal(security.isAllowedAdminId("uuid-admin", ""), false);
  assert.equal(security.isAllowedAdminId("uuid-user", "uuid-admin, uuid-user"), true);
  assert.equal(security.isAllowedAdminId("uuid-user", "uuid-admin"), false);
  assert.equal(security.isAllowedAdminId("UUID-ADMIN", "uuid-admin"), false);
});

test("admin order status validation matches the database constraint", () => {
  for (const status of ["pending", "confirmed", "cancelled", "fulfilled"]) assert.equal(security.isDatabaseOrderStatus(status), true);
  for (const status of ["paid", "processing", "shipped", "delivered", "unknown"]) assert.equal(security.isDatabaseOrderStatus(status), false);
});

test("admin product primitives reject invalid slugs, millime prices, and stock quantities", () => {
  assert.equal(security.isSafeProductSlug("toxido-ember"), true);
  assert.equal(security.isSafeProductSlug("../orders"), false);
  assert.equal(security.isValidMillimePrice(35000), true);
  assert.equal(security.isValidMillimePrice(0), false);
  assert.equal(security.isValidMillimePrice("35000"), false);
  assert.equal(security.isValidStock(0), true);
  assert.equal(security.isValidStock(10000), true);
  assert.equal(security.isValidStock(-1), false);
  assert.equal(security.isValidStock(2_147_483_648), false);
});

test("catalog API mutations use server-side validation helpers", () => {
  const productRoute = readFileSync("src/app/api/admin/products/route.ts", "utf8");
  const productDetailRoute = readFileSync("src/app/api/admin/products/[id]/route.ts", "utf8");
  const addVariantRoute = readFileSync("src/app/api/admin/products/[id]/variants/route.ts", "utf8");
  const variantRoute = readFileSync("src/app/api/admin/variants/[id]/route.ts", "utf8");
  assert.match(productRoute, /authorizeAdminRequest\(request, true\)/);
  assert.match(productRoute, /validateProductInput\(body\)/);
  assert.match(productDetailRoute, /authorizeAdminRequest\(request, true\)/);
  assert.match(productDetailRoute, /validateProductPatch\(body\)/);
  assert.match(addVariantRoute, /authorizeAdminRequest\(request, true\)/);
  assert.match(addVariantRoute, /validateNewVariant\(body\)/);
  assert.match(variantRoute, /authorizeAdminRequest\(request, true\)/);
  assert.match(variantRoute, /validateVariantPatch\(body\)/);
  assert.match(variantRoute, /query\.set\("stock", `eq\.\$\{current\.stock\}`\)/);
  assert.match(variantRoute, /query\.set\("price_millimes", `eq\.\$\{current\.price_millimes\}`\)/);
});

test("every admin data endpoint is guarded server-side and the service client is server-only", () => {
  const root = "src/app/api/admin";
  const routeFiles = [];
  function visit(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.name === "route.ts" && !path.endsWith(join("session", "route.ts"))) routeFiles.push(path);
    }
  }
  visit(root);
  assert.ok(routeFiles.length >= 6);
  for (const path of routeFiles) assert.match(readFileSync(path, "utf8"), /authorizeAdminRequest\(request/ , path);
  const client = readFileSync("src/lib/admin-rest.ts", "utf8");
  assert.match(client, /^import "server-only";/);
  assert.match(client, /getSupabaseSettings\(true\)/);
  const adminComponents = ["admin-shell.tsx", "admin-login-form.tsx", "admin-overview.tsx", "admin-orders.tsx", "admin-order-detail.tsx", "admin-products.tsx", "admin-product-editor.tsx"];
  for (const file of adminComponents) assert.doesNotMatch(readFileSync(join("src/components/admin", file), "utf8"), /SUPABASE_SERVICE_ROLE_KEY|serviceRoleKey/);
});

test("admin login only issues a protected cookie for allowlisted users and same-origin requests", () => {
  const session = readFileSync("src/app/api/admin/session/route.ts", "utf8");
  assert.match(session, /sameOrigin\(request\)/);
  assert.match(session, /isConfiguredAdmin\(session\.user\?\.id\)/);
  assert.match(session, /httpOnly:\s*true/);
  assert.match(session, /sameSite:\s*"lax"/);
  assert.match(session, /secure:\s*process\.env\.NODE_ENV === "production"/);
  assert.match(session, /maxAge/);
  assert.doesNotMatch(session, /refresh_token/);
});

test("admin status mutation accepts only existing database statuses", () => {
  const route = readFileSync("src/app/api/admin/orders/[id]/route.ts", "utf8");
  assert.match(route, /isDatabaseOrderStatus\(\(body as \{ status\?: unknown \}\)\.status\)/);
  assert.match(route, /method: "PATCH"/);
  assert.match(route, /status: \(body as \{ status: string \}\)\.status/);
});

test("cron request authentication validates exact bearer token and fails closed when secret is missing or mismatched", async () => {
  const cronAuth = await loadTs("src/lib/cron-auth.ts");
  const secret = "test-cron-secret-12345";
  const req = (authHeader) => new Request("https://example.com/api/admin/orders/reconcile-abandoned", {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : {},
  });

  // Valid secret
  assert.equal(cronAuth.isAuthorizedCronRequest(req(`Bearer ${secret}`), secret), true);
  // Invalid secret
  assert.equal(cronAuth.isAuthorizedCronRequest(req("Bearer wrong-secret"), secret), false);
  // Missing header
  assert.equal(cronAuth.isAuthorizedCronRequest(req(null), secret), false);
  // Missing configured secret in env
  assert.equal(cronAuth.isAuthorizedCronRequest(req(`Bearer ${secret}`), undefined), false);
  assert.equal(cronAuth.isAuthorizedCronRequest(req(`Bearer ${secret}`), ""), false);
  assert.equal(cronAuth.isAuthorizedCronRequest(req(`Bearer ${secret}`), "   "), false);
  // Non-bearer scheme or malformed header
  assert.equal(cronAuth.isAuthorizedCronRequest(req("Basic dXNlcjpwYXNz"), secret), false);
  assert.equal(cronAuth.isAuthorizedCronRequest(req("Bearer "), secret), false);
});

test("cron authentication is isolated to reconcile-abandoned and does not grant access to other admin routes", () => {
  const route = readFileSync("src/app/api/admin/orders/reconcile-abandoned/route.ts", "utf8");
  assert.match(route, /isAuthorizedCronRequest\(request\)/);
  assert.match(route, /authorizeAdminRequest\(request, true\)/);

  // All other admin routes must strictly require authorizeAdminRequest and never accept cron
  const root = "src/app/api/admin";
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory() && entry.name !== "orders" && entry.name !== "session") {
      const routePath = join(path, "route.ts");
      if (existsSync(routePath)) {
        assert.doesNotMatch(readFileSync(routePath, "utf8"), /isAuthorizedCronRequest/);
      }
    }
  }
  assert.doesNotMatch(readFileSync("src/app/api/admin/orders/route.ts", "utf8"), /isAuthorizedCronRequest/);
  assert.doesNotMatch(readFileSync("src/app/api/admin/orders/[id]/route.ts", "utf8"), /isAuthorizedCronRequest/);
  assert.doesNotMatch(readFileSync("src/app/api/admin/orders/[id]/reconcile-payment/route.ts", "utf8"), /isAuthorizedCronRequest/);
});

test("vercel.json configures a 15-minute cron schedule for abandoned session reconciliation", () => {
  const vercelConfig = JSON.parse(readFileSync("vercel.json", "utf8"));
  assert.ok(Array.isArray(vercelConfig.crons));
  const cron = vercelConfig.crons.find((c) => c.path === "/api/admin/orders/reconcile-abandoned");
  assert.ok(cron);
  assert.equal(cron.schedule, "*/15 * * * *");
});
