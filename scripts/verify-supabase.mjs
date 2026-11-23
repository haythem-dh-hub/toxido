import nextEnv from "@next/env";
import { lookup } from "node:dns/promises";

nextEnv.loadEnvConfig(process.cwd());

const REQUEST_TIMEOUT_MS = 8_000;
const newKeyPattern = /^sb_(publishable|secret)_[A-Za-z0-9_-]{22}_[A-Za-z0-9_-]{8}$/;

function hasLegacyRole(key, role) {
  const parts = key.split(".");
  if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[1])) return false;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role === role;
  } catch {
    return false;
  }
}

function getKeyKind(key, expectedRole) {
  if (expectedRole === "anon" && newKeyPattern.test(key) && key.startsWith("sb_publishable_")) return "publishable";
  if (expectedRole === "service_role" && newKeyPattern.test(key) && key.startsWith("sb_secret_")) return "secret";
  if (hasLegacyRole(key, expectedRole)) return "legacy-jwt";
  return null;
}

function logRequestFailure(label, response) {
  if (response.status === 401) {
    console.error(`${label} authentication failed (HTTP 401); check the key and project match.`);
  } else if (response.status === 403) {
    console.error(`${label} authorization failed (HTTP 403); check the key role and REST permissions.`);
  } else if (response.status >= 500) {
    console.error(`${label} database/service error (HTTP ${response.status}).`);
  } else {
    console.error(`${label} REST query/configuration error (HTTP ${response.status}).`);
  }
  process.exitCode = 1;
}

async function readOnlyGet(label, endpoint, key, keyKind, { checkArray = false } = {}) {
  const headers = { apikey: key };
  if (keyKind === "legacy-jwt") headers.Authorization = `Bearer ${key}`;

  try {
    const response = await fetch(endpoint, {
      headers,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      logRequestFailure(label, response);
      return null;
    }
    if (!checkArray) return response;

    const rows = await response.json().catch(() => null);
    if (!Array.isArray(rows)) {
      console.error(`${label} REST query returned an unexpected response format.`);
      process.exitCode = 1;
      return null;
    }
    return rows;
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      console.error(`${label} request timed out after ${REQUEST_TIMEOUT_MS} ms.`);
    } else {
      console.error(`${label} network error (${error?.cause?.code || error?.code || error?.name || "unknown error"}).`);
    }
    process.exitCode = 1;
    return null;
  }
}

const rawUrl = process.env.SUPABASE_URL;
if (!rawUrl) {
  console.error("Supabase configuration error: SUPABASE_URL is missing.");
  process.exitCode = 2;
} else {
  let supabaseUrl;
  try {
    supabaseUrl = new URL(rawUrl);
    if (supabaseUrl.protocol !== "https:" || supabaseUrl.username || supabaseUrl.password) throw new Error("invalid URL");
  } catch {
    console.error("Supabase configuration error: SUPABASE_URL must be a valid HTTPS URL without embedded credentials.");
    process.exitCode = 2;
  }

  if (supabaseUrl) {
    let dnsReady = false;
    try {
      const addresses = await lookup(supabaseUrl.hostname, { all: true });
      if (!addresses.length) throw new Error("No DNS addresses returned.");
      dnsReady = true;
      console.log(`DNS resolution succeeded (${addresses.length} address${addresses.length === 1 ? "" : "es"}).`);
    } catch (error) {
      const code = error?.code;
      console.error(code === "ENOTFOUND" || code === "EAI_AGAIN"
        ? `Supabase DNS error: could not resolve the configured project hostname (${code}).`
        : `Supabase DNS check failed (${code || "unknown DNS error"}).`);
      process.exitCode = 1;
    }

    if (!dnsReady) {
      console.error("Public anon-key test skipped because DNS resolution failed.");
      console.error("Privileged service-key test skipped because DNS resolution failed.");
    } else {
      const anonKey = process.env.SUPABASE_ANON_KEY;
      const anonKeyKind = anonKey ? getKeyKind(anonKey, "anon") : null;
      if (!anonKey) {
        console.error("Public connectivity test failed: SUPABASE_ANON_KEY is missing.");
        process.exitCode = 1;
      } else if (!anonKeyKind) {
        console.error("Public connectivity test failed: SUPABASE_ANON_KEY has an unsupported format.");
        process.exitCode = 1;
      } else {
        const endpoint = new URL("/rest/v1/products", supabaseUrl);
        endpoint.searchParams.set("select", "id,category,product_categories(slug),product_variants(id)");
        endpoint.searchParams.set("is_active", "eq.true");
        endpoint.searchParams.set("product_variants.is_active", "eq.true");
        endpoint.searchParams.set("limit", "1");
        const products = await readOnlyGet("Public anon-key test", endpoint, anonKey, anonKeyKind, { checkArray: true });
        if (products) console.log(`Public anon-key REST query succeeded (${products.length ? "at least 1 active product" : "no active products"}).`);
      }

      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const serviceKeyKind = serviceKey ? getKeyKind(serviceKey, "service_role") : null;
      if (!serviceKey) {
        console.error("Privileged service-key authentication failed: SUPABASE_SERVICE_ROLE_KEY is missing.");
        process.exitCode = 1;
      } else if (serviceKey === anonKey || !serviceKeyKind) {
        console.error("Privileged service-key authentication failed: SUPABASE_SERVICE_ROLE_KEY has an unsupported format or duplicates the anon key.");
        process.exitCode = 1;
      } else {
        const endpoint = new URL("/rest/v1/product_categories?select=slug&limit=0", supabaseUrl);
        const response = await readOnlyGet("Privileged service-key test", endpoint, serviceKey, serviceKeyKind);
        if (response) console.log("Privileged service-key REST authentication succeeded (read-only; no rows requested).");
      }
    }
  }
}
