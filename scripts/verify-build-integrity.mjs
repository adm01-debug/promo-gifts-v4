#!/usr/bin/env node
/**
 * verify-build-integrity.mjs
 *
 * Validação real de integridade JSX: roda `vite build` em modo silencioso.
 * O parser do esbuild/SWC é o único validador 100% confiável de tags JSX
 * pareadas (incluindo `<motion.*>` que devem fechar como `</motion.*>`).
 *
 * Heurísticas regex (contar `<motion.div` vs `</motion.div>`) produzem
 * falsos positivos massivos por causa de `</div>` filhos legítimos
 * aninhados — não use.
 *
 * Exit codes:
 *   0  → build OK, integridade JSX verificada
 *   1  → build falhou (sintaxe JSX, import quebrado, etc.)
 */
import { spawnSync } from 'node:child_process';

console.log('🔎 [integrity] Rodando vite build para validar JSX...');
const result = spawnSync('npx', ['vite', 'build', '--logLevel', 'error'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
});

if (result.status !== 0) {
  console.error('\n❌ [integrity] Build falhou — provavelmente há tag JSX/motion mal fechada.');
  process.exit(1);
}

console.log('\n✅ [integrity] Build OK — todas as tags JSX/motion estão sintaticamente corretas.');
process.exit(0);
