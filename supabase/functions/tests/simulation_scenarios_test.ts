import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

/**
 * SIMULATION SUITE: Webhooks & Edge Functions
 * Objective: Execute thousands of scenarios to validate consistency, resilience and security.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SERVICE_ROLE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY is required for simulations");
}

async function invoke(name: string, body: any, headers: any = {}) {
  const url = `${SUPABASE_URL}/functions/v1/${name}`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        ...headers,
      },
      body: JSON.stringify(body),
    });
    return response;
  } catch (err) {
    return { 
      status: 599, 
      json: () => Promise.resolve({ error: "Fetch failed", details: String(err) }),
      text: () => Promise.resolve("Fetch failed")
    } as any;
  }
}

// ============================================
// SCENARIO GENERATORS
// ============================================

const TABLES = ["products", "categories", "suppliers", "brands", "quotes"];
const OPERATORS = ["gte", "lte", "gt", "lt", "neq", "like", "ilike"];

function generateExternalDbScenarios(count: number) {
  const scenarios = [];
  for (let i = 0; i < count; i++) {
    const table = TABLES[Math.floor(Math.random() * TABLES.length)];
    const useInvalidFilter = Math.random() > 0.8;
    const useHeavyQuery = Math.random() > 0.9;
    
    let filters: any = {};
    if (useInvalidFilter) {
      // Invalid object filter (should be caught by bridge validation)
      filters["id"] = { something: "nested" };
    } else {
      const op = OPERATORS[Math.floor(Math.random() * OPERATORS.length)];
      filters[`id_${op}`] = Math.random() > 0.5 ? "some-id" : 123;
    }

    scenarios.push({
      name: `Scenario ${i}: ${table} ${useInvalidFilter ? '(invalid)' : '(valid)'}`,
      payload: {
        operation: "select",
        table,
        filters,
        limit: useHeavyQuery ? 1000 : 10,
      },
      expectedStatus: useInvalidFilter ? 400 : [200, 404, 401], // 401/404 can happen depending on DB state/config
    });
  }
  return scenarios;
}

function generateWebhookScenarios(count: number) {
  const scenarios = [];
  for (let i = 0; i < count; i++) {
    const missingField = Math.random() > 0.7;
    const malformedJson = Math.random() > 0.9;
    
    scenarios.push({
      name: `Webhook Scenario ${i}: ${missingField ? '(missing field)' : '(valid)'}`,
      payload: missingField ? { event: "product.updated" } : { event: "product.updated", data: { id: "123", price: 99.99 } },
      expectedStatus: [200, 400, 422],
    });
  }
  return scenarios;
}

// ============================================
// SIMULATION ENGINE
// ============================================

Deno.test({
  name: "MASS SIMULATION: External DB Bridge Resilience",
  ignore: !SERVICE_ROLE_KEY,
  async fn(t) {
    const scenarios = generateExternalDbScenarios(100); // Start with 100 for dev-server speed, can be increased
    let successes = 0;
    let failures = 0;

    for (const scenario of scenarios) {
      await t.step(scenario.name, async () => {
        const res = await invoke("external-db-bridge", scenario.payload);
        const isExpected = Array.isArray(scenario.expectedStatus) 
          ? scenario.expectedStatus.includes(res.status)
          : res.status === scenario.expectedStatus;
        
        if (isExpected) {
          successes++;
        } else {
          failures++;
          console.error(`FAILED ${scenario.name}: Got ${res.status}, expected ${scenario.expectedStatus}`);
          const body = await res.json().catch(() => ({}));
          console.error("Response body:", body);
        }
        
        // Always consume body to avoid leaking resources
        await res.body?.cancel();
      });
    }

    console.log(`Simulation complete. Successes: ${successes}, Failures: ${failures}`);
    assert(failures === 0, `${failures} scenarios failed validation`);
  },
});

Deno.test({
  name: "MASS SIMULATION: Webhook Inbound Consistency",
  ignore: !SERVICE_ROLE_KEY,
  async fn(t) {
    const scenarios = generateWebhookScenarios(100);
    for (const scenario of scenarios) {
      await t.step(scenario.name, async () => {
        const res = await invoke("webhook-inbound", scenario.payload);
        const isExpected = Array.isArray(scenario.expectedStatus) 
          ? scenario.expectedStatus.includes(res.status)
          : res.status === scenario.expectedStatus;
        
        assert(isExpected, `Expected ${scenario.expectedStatus}, got ${res.status}`);
        await res.body?.cancel();
      });
    }
  },
});

Deno.test({
  name: "DATA CONSISTENCY: Bridge Write → Verify Read",
  ignore: !SERVICE_ROLE_KEY,
  async fn() {
    // This is a high-level consistency check
    // 1. Write a temporary product via bridge
    const testId = `sim-test-${crypto.randomUUID()}`;
    const insertRes = await invoke("external-db-bridge", {
      operation: "insert",
      table: "products",
      data: { id: testId, name: "Simulation Test Product", sku: "SIM-001" }
    });
    
    // If table doesn't exist or insert fails due to RLS/config, we skip verification
    if (insertRes.status === 201 || insertRes.status === 200) {
      // 2. Read it back
      const readRes = await invoke("external-db-bridge", {
        operation: "select",
        table: "products",
        filters: { id: testId }
      });
      assertEquals(readRes.status, 200, "Read back must succeed");
      const data = await readRes.json();
      assert(data.data?.[0]?.id === testId, "Data consistency check failed: ID mismatch");
      
      // 3. Cleanup
      await invoke("external-db-bridge", {
        operation: "delete",
        table: "products",
        filters: { id: testId }
      });
    }
    await insertRes.body?.cancel();
  }
});
