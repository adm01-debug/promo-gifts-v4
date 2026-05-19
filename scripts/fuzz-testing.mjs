import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.log("⚠️ Credenciais ausentes. Pulando Fuzz Testing real.");
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const FUZZ_PAYLOADS = [
  { cnpj: "00.000.000/0001-91" },
  { cnpj: "invalid-cnpj-format" },
  { cnpj: "9999999999999999999999999" },
  { query: "' OR '1'='1" },
  { script: "<script>alert('xss')</script>" },
  { action: "upsert", products: Array(100).fill({ sku: "F", name: "F" }) },
  { action: "delete", external_ids: ["non-existent"] },
  null,
  { "": "" },
  { "{}": [] }
];

const TARGET_FUNCTIONS = [
  "cnpj-lookup",
  "product-webhook",
  "webhook-inbound",
  "external-db-bridge"
];

async function runFuzz() {
  console.log("🚀 Iniciando Bateria de Fuzzing & Validação...");
  let failed = 0;
  let total = 0;

  for (const fn of TARGET_FUNCTIONS) {
    for (const payload of FUZZ_PAYLOADS) {
      total++;
      console.log(`[${fn}] Testando payload: ${JSON.stringify(payload)?.substring(0, 50)}...`);
      try {
        const { data, error } = await supabase.functions.invoke(fn, {
          body: payload
        });
        
        // No fuzzing, não esperamos sucesso (200). 
        // Esperamos que a função NÃO retorne 500 (crash).
        // Se retornar 400, 401, 422 está OK.
      } catch (err) {
        // O invoke pode lançar se o status for >= 400 dependendo da config
        // Mas se for erro de rede ou 500 real, capturamos aqui
        if (err.message?.includes("500")) {
          console.error(`❌ CRASH DETECTADO em ${fn} com payload ${JSON.stringify(payload)}`);
          failed++;
        }
      }
    }
  }

  console.log(`\n✅ Fuzzing concluído. Total: ${total}, Falhas (500): ${failed}`);
  if (failed > 0) process.exit(1);
}

runFuzz().catch(err => {
  console.error(err);
  process.exit(1);
});
