#!/usr/bin/env node
/**
 * check-client-structured-logging.mjs
 * ----------------------------------------------------------------
 * Gate de CI — espelho do check-edge-structured-logging.mjs para o
 * cliente. Garante que rotas/módulos críticos usem
 * `createClientLogger` de `@/lib/telemetry/structuredLogger` e
 * propaguem `X-Request-Id` via `log.headers()`.
 *
 * Política:
 *   - CRITICAL_MODULES: lista congelada de arquivos onde o logger é
 *     obrigatório. NÃO ADICIONAR entradas frouxas — a lista existe
 *     para proteger regressão nas rotas sensíveis (auth, quote,
 *     mcp, magic-up, comparison, connections).
 *   - LEGACY_ALLOWLIST: caminhos onde o logger ainda não foi
 *     adotado por dívida técnica. Não deve crescer.
 *
 * Saída:
 *   exit 0 → ok.
 *   exit 1 → falta `createClientLogger` em algum CRITICAL_MODULE ou
 *            allowlist cresceu.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();

// Rotas/módulos onde o logger estruturado é obrigatório.
// Snapshot congelado 2026-07-13. Adições exigem revisão manual.
const CRITICAL_MODULES = [
  'src/contexts/AuthContext.tsx',
  'src/lib/auth/session-recovery.ts',
  'src/services/quoteService.ts',
  'src/hooks/quotes/useQuotes.ts',
  'src/hooks/ui/useErrorHandler.ts',
  'src/hooks/ui/useWorkspaceNotifications.tsx',
  'src/components/admin/security/keys/useMcpKeys.ts',
  'src/hooks/intelligence/useMagicUpGeneration.ts',
  'src/hooks/intelligence/useConnectionTester.ts',
  'src/components/layout/ProtectedRoute.tsx',
  'src/hooks/auth/useProfileRoles.ts',
  'src/hooks/products/useSellerCarts.ts',
  'src/lib/telemetry/quoteStatusTelemetry.ts',
  'src/pages/mockups/MockupGenerator.tsx',
  // Onda 20 — wrapper SSOT da superfície `functions.invoke` DEVE instrumentar
  // com createClientLogger('edge.invoke'). Regressão silenciosa aqui faz sumir
  // p95/erros de toda a superfície de Edge Functions no /admin/telemetria.
  'src/lib/edge/safeInvokeCall.ts',
];

// Legados aceitos temporariamente. NÃO adicionar novos.
const LEGACY_ALLOWLIST = new Set([]);
const LEGACY_SNAPSHOT_SIZE = 0;

const LOGGER_IMPORT_RE =
  /from\s+["']@\/lib\/telemetry\/structuredLogger["']|createClientLogger\s*\(/;

function checkFile(rel) {
  const abs = resolve(ROOT, rel);
  if (!existsSync(abs)) return { rel, ok: false, missing: true };
  const src = readFileSync(abs, 'utf8');
  return { rel, ok: LOGGER_IMPORT_RE.test(src), missing: false };
}

function main() {
  const violations = [];
  const missingFiles = [];

  for (const rel of CRITICAL_MODULES) {
    if (LEGACY_ALLOWLIST.has(rel)) continue;
    const res = checkFile(rel);
    if (res.missing) missingFiles.push(rel);
    else if (!res.ok) violations.push(rel);
  }

  const sizeDelta = LEGACY_ALLOWLIST.size - LEGACY_SNAPSHOT_SIZE;

  let exit = 0;
  if (missingFiles.length) {
    console.error('\n⚠️  Arquivos CRITICAL_MODULES ausentes (renomeados/removidos?):');
    for (const f of missingFiles) console.error(`   • ${f}`);
    console.error(
      '\n   → Atualize CRITICAL_MODULES em scripts/check-client-structured-logging.mjs.',
    );
    exit = 1;
  }
  if (violations.length) {
    console.error('\n❌ Módulos críticos sem createClientLogger:');
    for (const v of violations) console.error(`   • ${v}`);
    console.error(
      "\n   → Importe: import { createClientLogger } from '@/lib/telemetry/structuredLogger';",
    );
    console.error(
      "   → Uso: const log = createClientLogger('scope.name'); log.info('event_start', {...});",
    );
    console.error('   → Propague X-Request-Id em fetch/invoke com log.headers().');
    console.error('   → Veja docs/OBSERVABILITY.md.\n');
    exit = 1;
  }
  if (sizeDelta > 0) {
    console.error(
      `\n❌ Allowlist cresceu (${LEGACY_SNAPSHOT_SIZE} → ${LEGACY_ALLOWLIST.size}). ` +
        'Não adicione novos legados; adote o logger SSOT.',
    );
    exit = 1;
  }

  if (exit === 0) {
    console.log(
      `✅ Client structured-logging gate OK — ${CRITICAL_MODULES.length} módulos críticos, ` +
        `${LEGACY_ALLOWLIST.size} legados.`,
    );
  }
  process.exit(exit);
}

main();
