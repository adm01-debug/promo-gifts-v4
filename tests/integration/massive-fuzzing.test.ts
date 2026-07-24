import { describe, expect, it } from 'vitest';

/**
 * Script para rodar simulações de fuzzing massivas via Edge Function simulation-orchestrator.
 * Isso não é um teste unitário puro, mas sim um orquestrador de testes de integração real.
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SIMULATION_BYPASS_KEY;

describe("Massive Webhook & Edge Function Fuzzing", () => {
  it("deve executar 1000 cenários de fuzzing com sucesso (status codes esperados)", async () => {
    if (!SERVICE_ROLE_KEY) {
      console.warn("PULANDO: SERVICE_ROLE_KEY não configurada.");
      return;
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/simulation-orchestrator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({
        mode: 'fuzzing',
        count: 1000,
        targetFunctions: ["webhook-inbound", "product-webhook", "external-db-bridge"]
      })
    });

    expect(response.status).toBe(200);
    const report = await response.json();
    
    console.log("--- RELATÓRIO DE FUZZING ---");
    console.log(`Total Scenarios: ${report.totalScenarios}`);
    console.log(`Successes: ${report.successes}`);
    console.log(`Failures: ${report.failures}`);
    console.log(`Avg Latency: ${report.avg_latency_ms || report.avgLatency}ms`);
    
    // No fuzzing, esperamos falhas (400, 422), mas não erros de servidor (500)
    // O simulation-orchestrator já mapeia o que é "sucesso esperado" no array de status.
    expect(report.failures).toBeLessThan(report.totalScenarios * 0.1); // Toleramos 10% de erros reais de rede/timeout
  }, 120000); // 2 minutos de timeout
});
