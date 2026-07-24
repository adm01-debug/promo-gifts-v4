import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

/**
 * Teste de carga e estresse agressivo para o dashboard e backend.
 * Simula milhares de requisições simultâneas em ondas de choque.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function runShockWave(concurrency: number, total: number) {
  console.log(`🌊 Onda de Choque: Concorrência ${concurrency}, Total ${total}`);
  
  const results = await fetch(`${SUPABASE_URL}/functions/v1/load-test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({
      concurrency,
      totalRequests: total,
      targetEndpoint: "/health-check",
      method: "GET"
    })
  });

  return await results.json();
}

async function main() {
  const stages = [
    { c: 50, t: 500 },
    { c: 100, t: 1000 },
    { c: 200, t: 2000 }
  ];

  for (const stage of stages) {
    const res = await runShockWave(stage.c, stage.t);
    console.log(`Resultados (c=${stage.c}): ${res.stats.successRate} success, avg ${res.performanceMs.avg}ms`);
    if (res.stats.errorCount > stage.t * 0.05) {
      console.error("🛑 Erros acima do limite tolerado (5%)!");
      Deno.exit(1);
    }
  }
  
  console.log("✅ Teste de estresse concluído com sucesso.");
}

if (import.meta.main) {
  main();
}
