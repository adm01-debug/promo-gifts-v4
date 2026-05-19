import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "https://pqpdolkaeqlyzpdpbizo.supabase.co";
// Usando a chave de simulação estável definida para este projeto
const SERVICE_ROLE_KEY = "a46c3981-244a-4f81-9f57-bab5c45b5cde"; 

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
          product: { sku: `TEST-${Date.now()}`, name: "Test Product", price: 10.5 }
        },
        expectedStatus: 200,
        validateResponse: (data) => data.success === true && typeof data.sync_log_id === 'string'
      },
      {
        description: "Invalid action enum",
        payload: { action: "invalid-action", product: { sku: "T", name: "T", price: 0 } },
        expectedStatus: 400,
        validateResponse: (data) => data.error === "Validation failed" && data.details.action !== undefined
      }
    ]
  },
  {
    name: "cnpj-lookup",
    endpoint: "cnpj-lookup",
    scenarios: [
      {
        description: "Valid format simulation",
        payload: { cnpj: "00.000.000/0001-91" },
        expectedStatus: 200,
        validateResponse: (data) => data.cnpj !== undefined || data.error !== undefined
      }
    ]
  },
  {
    name: "external-db-bridge",
    endpoint: "external-db-bridge",
    scenarios: [
      {
        description: "Valid select simulation",
        payload: { operation: "select", table: "products", limit: 1 },
        expectedStatus: 200,
        validateResponse: (data) => Array.isArray(data.records || data.data?.records)
      }
    ]
  }
];

async function runContractTests() {
  console.log("🚀 Iniciando Testes de Contrato (Simulation Mode)...");
  let passed = 0;
  let failedCount = 0;

  for (const contract of CONTRACTS) {
    console.log(`\n📦 Contrato: ${contract.name}`);
    for (const scenario of contract.scenarios) {
      process.stdout.write(`  - ${scenario.description}: `);
      try {
        const url = `${SUPABASE_URL}/functions/v1/${contract.endpoint}`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            ...contract.headers
          },
          body: JSON.stringify(scenario.payload)
        });

        const actualStatus = response.status;
        const responseData = await response.json().catch(() => ({}));

        const statusMatch = actualStatus === scenario.expectedStatus;
        const validationMatch = scenario.validateResponse ? scenario.validateResponse(responseData) : true;

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
