import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.log("⚠️ Credenciais ausentes. Pulando Contract Testing.");
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CONTRACTS = [
  {
    name: "product-webhook",
    endpoint: "product-webhook",
    headers: { "x-webhook-secret": process.env.N8N_PRODUCT_WEBHOOK_SECRET || "sim-secret" },
    scenarios: [
      {
        description: "Valid upsert payload",
        payload: {
          action: "upsert",
          product: { sku: "TEST-SKU-1", name: "Test Product", price: 10.5 }
        },
        expectedStatus: 200,
        validateResponse: (data) => data.success === true && typeof data.sync_log_id === 'string'
      },
      {
        description: "Invalid action enum",
        payload: { action: "invalid-action", product: { sku: "T", name: "T", price: 0 } },
        expectedStatus: 400,
        validateResponse: (data) => data.error === "Validation failed" && data.details.action !== undefined
      },
      {
        description: "Missing required fields in product",
        payload: { action: "upsert", product: { sku: "T" } }, // Missing name and price
        expectedStatus: 400,
        validateResponse: (data) => data.error === "Validation failed" && data.details.product !== undefined
      }
    ]
  },
  {
    name: "cnpj-lookup",
    endpoint: "cnpj-lookup",
    scenarios: [
      {
        description: "Valid CNPJ format",
        payload: { cnpj: "00.000.000/0001-91" },
        expectedStatus: 200,
        validateResponse: (data) => data.cnpj !== undefined || data.error !== undefined // Might fail externally but 200 for valid format
      },
      {
        description: "Invalid CNPJ format",
        payload: { cnpj: "123" },
        expectedStatus: 400,
        validateResponse: (data) => data.error !== undefined
      }
    ]
  },
  {
    name: "external-db-bridge",
    endpoint: "external-db-bridge",
    scenarios: [
      {
        description: "Valid select operation",
        payload: { operation: "select", table: "products", limit: 1 },
        expectedStatus: 200,
        validateResponse: (data) => Array.isArray(data.records)
      },
      {
        description: "Invalid table name",
        payload: { operation: "select", table: "non_existent_table" },
        expectedStatus: 400,
        validateResponse: (data) => data.error !== undefined
      }
    ]
  }
];

async function runContractTests() {
  console.log("🚀 Iniciando Testes de Contrato (Schema Validation)...");
  let passed = 0;
  let failedCount = 0;

  for (const contract of CONTRACTS) {
    console.log(`\n📦 Contrato: ${contract.name}`);
    for (const scenario of contract.scenarios) {
      process.stdout.write(`  - ${scenario.description}: `);
      try {
        const { data, error, status } = await supabase.functions.invoke(contract.endpoint, {
          body: scenario.payload,
          headers: contract.headers || {}
        });

        // status is usually available in the error object if not 200, 
        // but supabase-js invoke handles it. Actually, invoke returns { data, error }.
        // If error is present, it might have status.
        
        let actualStatus = 200;
        let responseData = data;
        
        if (error) {
           // supabase-js throws or returns error for non-2xx
           // We need to parse the error to get the actual status if possible
           // or just check the data if it was returned with the error.
           // Newer versions of supabase-js might return status in error.
           actualStatus = error.status || (error.message?.includes("400") ? 400 : (error.message?.includes("401") ? 401 : 500));
           try {
             responseData = JSON.parse(await error.context?.json() || "{}");
           } catch {
             responseData = { error: error.message };
           }
        }

        const statusMatch = actualStatus === scenario.expectedStatus;
        const validationMatch = scenario.validateResponse ? scenario.validateResponse(responseData || {}) : true;

        if (statusMatch && validationMatch) {
          console.log("✅ PASS");
          passed++;
        } else {
          console.log("❌ FAIL");
          console.log(`    Esperado: ${scenario.expectedStatus}, Obtido: ${actualStatus}`);
          console.log(`    Resposta: ${JSON.stringify(responseData)}`);
          failedCount++;
        }
      } catch (err) {
        console.log("💥 CRASH");
        console.error(err);
        failedCount++;
      }
    }
  }

  console.log(`\n--- RESULTADO DOS TESTES DE CONTRATO ---`);
  console.log(`Sucessos: ${passed}`);
  console.log(`Falhas: ${failedCount}`);
  console.log(`----------------------------------------\n`);

  if (failedCount > 0) process.exit(1);
}

runContractTests().catch(err => {
  console.error(err);
  process.exit(1);
});
