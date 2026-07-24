/**
 * Cross-check de gaps: garante que os data-testid do bloco Frete
 * (`shipping-type-select`, `shipping-cost-input`, `freight-grid`)
 * são exclusivos do QuoteBuilderPage. Qualquer outro consumidor
 * ficaria acoplado à estrutura interna e quebraria em silêncio.
 *
 * Se um dia surgir um consumidor legítimo, atualize este contrato
 * incluindo-o na allowlist e adicione o teste espelho correspondente.
 */
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

const TESTIDS = ['shipping-type-select', 'shipping-cost-input', 'freight-grid'];
const ALLOWLIST = new Set([
  'src/pages/quotes/QuoteBuilderPage.tsx',
]);

function grepInProd(testid: string): string[] {
  const cmd = `grep -RIln --include="*.ts" --include="*.tsx" "${testid}" src \
    | grep -v "__tests__" \
    | grep -v "\\.test\\." \
    | grep -v "\\.spec\\." \
    || true`;
  const out = execSync(cmd, { encoding: 'utf8' }).trim();
  return out ? out.split('\n') : [];
}

describe('Bloco Frete — cross-check de consumidores em produção', () => {
  it.each(TESTIDS)(
    'testid "%s" só aparece em arquivos autorizados',
    (tid) => {
      const files = grepInProd(tid);
      const disallowed = files.filter((f) => !ALLOWLIST.has(f));
      expect(disallowed, `Consumidores fora da allowlist para "${tid}": ${JSON.stringify(disallowed)}`).toEqual([]);
    },
  );
});
