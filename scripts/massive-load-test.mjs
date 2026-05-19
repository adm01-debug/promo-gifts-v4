import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function runMassiveStressTest() {
  console.log('🚀 Iniciando teste de estresse massivo (Metas de Prontidão de Produção)...');
  
  const totalRequests = 1000;
  const concurrentBatches = 10;
  const requestsPerBatch = totalRequests / concurrentBatches;

  console.log(`Simulando ${totalRequests} execuções em ${concurrentBatches} lotes paralelos...`);

  const startTime = Date.now();
  const results = [];

  for (let i = 0; i < concurrentBatches; i++) {
    console.log(`Lote ${i + 1}/${concurrentBatches} disparado...`);
    results.push(
      supabase.functions.invoke('simulation-orchestrator', {
        body: { count: requestsPerBatch, mode: 'load' }
      })
    );
  }

  const reports = await Promise.all(results);
  const endTime = Date.now();

  let totalSuccess = 0;
  let totalFail = 0;
  let totalScenarios = 0;

  reports.forEach((r, idx) => {
    if (r.error) {
      console.error(`Lote ${idx + 1} falhou:`, r.error);
      totalFail += requestsPerBatch;
    } else {
      totalSuccess += r.data.successes;
      totalFail += r.data.failures;
      totalScenarios += r.data.totalScenarios;
    }
  });

  const duration = (endTime - startTime) / 1000;
  console.log('\n--- RELATÓRIO FINAL DE ESTRESSE ---');
  console.log(`Total de Cenários: ${totalScenarios}`);
  console.log(`Sucessos: ${totalSuccess}`);
  console.log(`Falhas: ${totalFail}`);
  console.log(`Taxa de Sucesso: ${((totalSuccess / totalScenarios) * 100).toFixed(2)}%`);
  console.log(`Duração Total: ${duration}s`);
  console.log(`RPS (Requisições por Segundo): ${(totalScenarios / duration).toFixed(2)}`);
  console.log('------------------------------------\n');

  if (totalFail > totalScenarios * 0.05) {
    console.error('❌ Teste falhou: Taxa de erro superior a 5%!');
    process.exit(1);
  } else {
    console.log('✅ Teste concluído com sucesso! Sistema estável sob carga.');
  }
}

runMassiveStressTest().catch(console.error);
