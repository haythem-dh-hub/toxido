import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const rawUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!rawUrl || !anonKey || !serviceKey) {
  console.error("Configuration missing.");
  process.exit(1);
}

const supabaseUrl = new URL(rawUrl);

function authHeaders(key) {
  const headers = { apikey: key, "Content-Type": "application/json" };
  if (key.includes(".")) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

const DUMMY_UUID = "00000000-0000-0000-0000-000000000000";

const rpcSignatures = {
  get_public_order: {
    args: { p_reference: "TX-TEST-NONEXISTENT" },
    expectedStatus: 200,
  },
  flouci_event_is_processed: {
    args: { p_event_id: "evt_verify_only" },
    expectedStatus: 200,
  },
  record_flouci_payment_session: {
    args: {
      p_tracking_id: DUMMY_UUID,
      p_payment_id: "test_pay_id",
      p_payment_url: "https://checkout.flouci.com/test",
    },
    expectedStatus: 200,
  },
  fail_flouci_initialization: {
    args: { p_tracking_id: DUMMY_UUID },
    expectedStatus: 200,
  },
  flag_flouci_payment_review: {
    args: { p_tracking_id: DUMMY_UUID, p_reason: "initialization_timeout" },
    expectedStatus: 200,
  },
  settle_flouci_payment_event: {
    args: {
      p_event_id: "evt_verify",
      p_event_type: "payment.succeeded",
      p_payment_id: "pay_verify",
      p_tracking_id: DUMMY_UUID,
      p_amount_millimes: 1000,
      p_currency: "TND",
      p_verified_status: "SUCCESS",
    },
    expectedStatus: 400,
    expectedMessage: "PAYMENT_DETAILS_MISMATCH",
  },
  create_flouci_order: {
    args: {
      p_idempotency_key: null,
      p_customer: {},
      p_items: [],
      p_fixed_trio: false,
    },
    expectedStatus: 400,
    expectedMessage: "INVALID_ORDER",
  },
  create_cod_order: {
    args: {
      p_idempotency_key: null,
      p_customer: {},
      p_items: [],
    },
    expectedStatus: 400,
    expectedMessage: "INVALID_ORDER",
  },
  create_fixed_trio_cod_order: {
    args: {
      p_idempotency_key: null,
      p_customer: {},
      p_quantity: 0,
    },
    expectedStatus: 400,
    expectedMessage: "INVALID_ORDER",
  },
  create_store_order: {
    args: {
      p_idempotency_key: null,
      p_customer: {},
      p_items: [],
      p_fixed_trio: false,
      p_payment_method: "flouci",
    },
    expectedStatus: 400,
    expectedMessage: "INVALID_ORDER",
  },
};

const results = {};

async function runVerification() {
  // 1. Table public.flouci_payment_events exists
  try {
    const res = await fetch(new URL("/rest/v1/flouci_payment_events?limit=0", supabaseUrl), {
      headers: authHeaders(serviceKey),
    });
    results.flouci_payment_events_table = {
      pass: res.ok,
      status: res.status,
    };
  } catch (e) {
    results.flouci_payment_events_table = { pass: false, error: e.message };
  }

  // 2. All expected Flouci columns in public.orders
  const columns = [
    "payment_status",
    "shipping_millimes",
    "flouci_tracking_id",
    "flouci_payment_id",
    "flouci_payment_url",
    "inventory_released_at",
    "flouci_review_reason",
  ];
  try {
    const res = await fetch(new URL(`/rest/v1/orders?select=${columns.join(",")}&limit=0`, supabaseUrl), {
      headers: authHeaders(serviceKey),
    });
    results.orders_flouci_columns = {
      pass: res.ok,
      status: res.status,
      columns,
    };
  } catch (e) {
    results.orders_flouci_columns = { pass: false, error: e.message };
  }

  // 3. RPC functions exist with correct signatures (tested with service_role)
  results.rpc_functions = {};
  for (const [fnName, config] of Object.entries(rpcSignatures)) {
    try {
      const res = await fetch(new URL(`/rest/v1/rpc/${fnName}`, supabaseUrl), {
        method: "POST",
        headers: authHeaders(serviceKey),
        body: JSON.stringify(config.args),
      });
      const body = await res.text();
      const notFound = res.status === 404 || body.includes("PGRST202");
      let messageMatch = true;
      if (config.expectedMessage) {
        messageMatch = body.includes(config.expectedMessage);
      }
      const pass = !notFound && messageMatch && (res.status === config.expectedStatus);
      results.rpc_functions[fnName] = {
        pass,
        status: res.status,
        bodySnippet: body.slice(0, 80),
      };
    } catch (e) {
      results.rpc_functions[fnName] = { pass: false, error: e.message };
    }
  }

  // 4. RLS enabled on flouci_payment_events (anon access forbidden)
  try {
    const res = await fetch(new URL("/rest/v1/flouci_payment_events?limit=1", supabaseUrl), {
      headers: authHeaders(anonKey),
    });
    const body = await res.text();
    const isBlocked = res.status === 401 || res.status === 403 || body.includes("42501") || body === "[]";
    results.flouci_payment_events_rls = {
      pass: isBlocked,
      status: res.status,
      bodySnippet: body.slice(0, 80),
    };
  } catch (e) {
    results.flouci_payment_events_rls = { pass: false, error: e.message };
  }

  // 5. Function permissions:
  const mutatingFunctions = [
    "create_flouci_order",
    "create_store_order",
    "create_cod_order",
    "create_fixed_trio_cod_order",
    "record_flouci_payment_session",
    "fail_flouci_initialization",
    "settle_flouci_payment_event",
    "flag_flouci_payment_review",
  ];
  results.mutating_functions_anon_denied = {};
  let allMutatingDenied = true;
  for (const fn of mutatingFunctions) {
    try {
      const res = await fetch(new URL(`/rest/v1/rpc/${fn}`, supabaseUrl), {
        method: "POST",
        headers: authHeaders(anonKey),
        body: JSON.stringify(rpcSignatures[fn].args),
      });
      const body = await res.text();
      const denied = res.status === 401 || res.status === 403 || body.includes("permission denied") || body.includes("42501");
      if (!denied) allMutatingDenied = false;
      results.mutating_functions_anon_denied[fn] = {
        pass: denied,
        status: res.status,
        bodySnippet: body.slice(0, 80),
      };
    } catch (e) {
      results.mutating_functions_anon_denied[fn] = { pass: false, error: e.message };
    }
  }
  results.all_mutating_functions_denied_to_anon = allMutatingDenied;

  // get_public_order allowed for anon
  try {
    const res = await fetch(new URL("/rest/v1/rpc/get_public_order", supabaseUrl), {
      method: "POST",
      headers: authHeaders(anonKey),
      body: JSON.stringify({ p_reference: "TX-TEST-NONEXISTENT" }),
    });
    const text = await res.text();
    results.get_public_order_anon_allowed = {
      pass: res.status === 200 && text.trim() === "null",
      status: res.status,
      returned: text.trim(),
    };
  } catch (e) {
    results.get_public_order_anon_allowed = { pass: false, error: e.message };
  }

  // 6. Existing COD orders remain valid
  try {
    const res = await fetch(
      new URL("/rest/v1/orders?payment_method=eq.cash_on_delivery&select=id,reference,payment_method,payment_status,shipping_millimes&limit=10", supabaseUrl),
      { headers: authHeaders(serviceKey) },
    );
    const rows = await res.json();
    const allValid = Array.isArray(rows) && rows.every(
      (r) => r.payment_method === "cash_on_delivery" && r.payment_status === "cod_due" && Number(r.shipping_millimes) >= 0,
    );
    results.existing_cod_orders = {
      pass: res.ok && allValid,
      orderCount: rows.length,
      sampleValid: allValid,
    };
  } catch (e) {
    results.existing_cod_orders = { pass: false, error: e.message };
  }

  // 7. Products, variants and stock intact
  try {
    const res = await fetch(
      new URL("/rest/v1/products?select=id,slug,name,is_active,product_variants(id,name,sku,price_millimes,stock,is_active)&limit=10", supabaseUrl),
      { headers: authHeaders(serviceKey) },
    );
    const rows = await res.json();
    const hasActiveProducts = Array.isArray(rows) && rows.length > 0 && rows.some((p) => p.is_active);
    const variants = rows.flatMap((p) => p.product_variants || []);
    const hasStock = variants.length > 0 && variants.every((v) => typeof v.stock === "number");
    results.products_and_variants = {
      pass: res.ok && hasActiveProducts && hasStock,
      productCount: rows.length,
      variantCount: variants.length,
    };
  } catch (e) {
    results.products_and_variants = { pass: false, error: e.message };
  }

  console.log(JSON.stringify(results, null, 2));
}

runVerification();
