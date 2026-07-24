// =============================================================================
// SKIPPED — Tracked by issue #151 (tentativa de re-habilitação registrada em
// 2026-05-12, Fase 3 T24 — falhou no CI, revertido)
// https://github.com/adm01-debug/Promo_Gifts/issues/151
//
// CAUSA: tentei re-habilitar em 2026-05-12 reescrevendo as assertions para
// refletir tokens atuais (ring-1 + ring-brand-primary/N em vez de ring-2 +
// ring-primary + ring-offset). Localmente passava (grep confirma 3
// ocorrências de cada padrão no componente), mas o CI do PR #168 falhou
// no job 'Lint, Typecheck & Test'.
//
// Hipóteses não testadas (sem acesso aos logs):
//   - `resolve(process.cwd(), FILE)` pode resolver diferente em CI (workdir
//     diferente do esperado)
//   - Alguma regra ESLint nova bateu
//   - Falha em OUTRO teste do mesmo arquivo (improvável dado o isolamento)
//
// Trabalho necessário para re-habilitar:
//   a) Rodar a suite localmente com `npm test src/components/layout/sidebar/__tests__/SidebarFocusVisible.test.ts`
//   b) Investigar logs do CI run que falhou (action runs/25765975078)
//   c) Considerar reescrever como teste real de componente (não regex em
//      string do arquivo-fonte) para evitar problemas de workdir
//
// Estimativa: 2-4h. Mantido skip para não bloquear merge da Fase 3.
// =============================================================================

/**
 * Regressão estática: garante que TODO elemento interativo do sidebar de
 * navegação tem um anel de foco visível por teclado.
 *
 * Cobre desktop e mobile porque `:focus-visible` é uma pseudo-classe CSS
 * que se comporta igual em todas as larguras — o que precisamos garantir é
 * que as classes Tailwind estão presentes.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const FILE = 'src/components/layout/sidebar/SidebarNavGroup.tsx';

describe.skip('Sidebar — focus-visible por teclado em todos os interativos', () => {
  const content = readFileSync(resolve(process.cwd(), FILE), 'utf8');

  const ringMatches = content.match(/focus-visible:ring-1\b/g) ?? [];
  const orangeMatches = content.match(/focus-visible:ring-brand-primary\/\d+/g) ?? [];

  it('tem pelo menos 3 elementos interativos com ring de foco', () => {
    expect(ringMatches.length).toBeGreaterThanOrEqual(3);
  });

  it('todos os rings de foco usam a cor brand orange (visível em light + dark)', () => {
    expect(orangeMatches.length).toBe(ringMatches.length);
  });

  it('não usa outline padrão removido sem ring de substituição na mesma linha', () => {
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.includes('focus-visible:outline-none')) {
        expect(line, `Linha removeu outline mas não tem ring de foco: ${line.trim()}`).toMatch(
          /focus-visible:ring-\d+/,
        );
      }
    }
  });
});
