/**
 * Contract test — Handoffs do QuoteBuilder DEVEM chamar `clearAutoSave()`
 * ANTES de aplicar `setItems`/`setClientId` vindos de fontes externas
 * (carrinho, coleção, simulador, URL params).
 *
 * BUG histórico (BUG-CART-HANDOFF, 2026-07):
 *   1. Usuário clica em "Orçamento" num carrinho → navega para /orcamentos/novo
 *      com `location.state.fromCart=true` + companyId/items.
 *   2. Efeito `Pre-fill from cart` chama setClientId(companyId) + setItems(cartItems).
 *   3. Isso liga o hook `useAutoSaveQuote` (enabled = clientId||items.length>0).
 *   4. O efeito de restore do autosave lê o rascunho anterior do localStorage
 *      e chama onRestore, que sobrescreve clientId/items com a "Sicoob" antiga.
 *
 * Fix: chamar `clearAutoSave()` DENTRO de cada handoff, ANTES do setItems, para
 * que quando o autosave finalmente restaurar não encontre nada.
 *
 * Também garante que o log de telemetria (`logger.info('[QuoteBuilder handoff]…`)
 * está presente — permite auditoria rápida em produção.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  resolve(__dirname, '../useQuoteBuilderState.ts'),
  'utf8',
);

/**
 * Extrai o corpo de um `useEffect` que contenha uma marca inicial
 * (ex.: `fromCart?:` na tipagem do `state`). Retorna o texto do bloco
 * do useEffect que abre logo antes.
 */
function extractEffectContaining(marker: string): string {
  const idx = SRC.indexOf(marker);
  expect(idx, `marker "${marker}" não encontrado`).toBeGreaterThan(-1);
  // Volta até o `useEffect(` mais próximo
  const effectStart = SRC.lastIndexOf('useEffect(', idx);
  expect(effectStart, `useEffect antes de "${marker}" não encontrado`).toBeGreaterThan(-1);
  // Encontra o `}, [` de dependência que fecha esse useEffect
  const closeIdx = SRC.indexOf('}, [', idx);
  expect(closeIdx, `fechamento do useEffect "${marker}" não encontrado`).toBeGreaterThan(-1);
  return SRC.slice(effectStart, closeIdx);
}

describe('QuoteBuilder handoffs — clearAutoSave() precede setItems/setClientId', () => {
  const cases: Array<{ label: string; marker: string; telemetryTag: string }> = [
    {
      label: 'fromCart (carrinho)',
      marker: 'fromCart?: boolean;',
      telemetryTag: '[QuoteBuilder handoff] fromCart',
    },
    {
      label: 'fromCollection (coleção)',
      marker: 'fromCollection?: string;',
      telemetryTag: '[QuoteBuilder handoff] fromCollection',
    },
    {
      label: 'fromSimulator (simulador)',
      marker: 'fromSimulator?: boolean;',
      telemetryTag: '[QuoteBuilder handoff] fromSimulator',
    },
  ];

  for (const c of cases) {
    it(`${c.label}: clearAutoSave() antes do primeiro setItems/setClientId`, () => {
      const body = extractEffectContaining(c.marker);

      const clearIdx = body.indexOf('clearAutoSave()');
      expect(
        clearIdx,
        `clearAutoSave() ausente no handoff ${c.label}`,
      ).toBeGreaterThan(-1);

      const setItemsIdx = body.indexOf('setItems(');
      const setClientIdIdx = body.indexOf('setClientId(');
      const firstMutation = [setItemsIdx, setClientIdIdx]
        .filter((n) => n >= 0)
        .sort((a, b) => a - b)[0];

      expect(
        firstMutation,
        `nenhum setItems/setClientId encontrado em ${c.label}`,
      ).toBeGreaterThan(-1);

      expect(
        clearIdx,
        `clearAutoSave() deve vir ANTES de setItems/setClientId em ${c.label}`,
      ).toBeLessThan(firstMutation!);
    });

    it(`${c.label}: registra telemetria via logger.info`, () => {
      const body = extractEffectContaining(c.marker);
      expect(body).toContain(c.telemetryTag);
      // logger.info deve ocorrer antes do clearAutoSave / setItems
      const loggerIdx = body.indexOf('logger.info');
      const clearIdx = body.indexOf('clearAutoSave()');
      expect(loggerIdx).toBeGreaterThan(-1);
      expect(loggerIdx).toBeLessThan(clearIdx);
    });
  }

  it('fromUrlParams: clearAutoSave() precede setItems no branch items[] e no single-product', () => {
    // O efeito de URL params tem dois caminhos (items[] e product_id). Ambos
    // precisam limpar o autosave. Fazemos a checagem sobre o corpo inteiro do
    // efeito começando pelo marcador "Pre-fill from URL params".
    const start = SRC.indexOf('// ── Pre-fill from URL params ──');
    expect(start).toBeGreaterThan(-1);
    const end = SRC.indexOf('const { data: products }', start);
    expect(end).toBeGreaterThan(start);
    const body = SRC.slice(start, end);

    // Deve haver DOIS clearAutoSave() (um por branch).
    const clearCount = (body.match(/clearAutoSave\(\)/g) ?? []).length;
    expect(clearCount).toBeGreaterThanOrEqual(2);

    // E duas telemetrias distintas.
    expect(body).toContain('[QuoteBuilder handoff] fromUrlParams (items[])');
    expect(body).toContain('[QuoteBuilder handoff] fromUrlParams (single product)');

    // Cada clearAutoSave deve estar antes do setItems mais próximo do mesmo branch.
    // Heurística simples: no primeiro branch, clearAutoSave < setItems(parsedItems)
    const clear1 = body.indexOf('clearAutoSave()');
    const setItems1 = body.indexOf('setItems(parsedItems)');
    expect(clear1).toBeLessThan(setItems1);

    // No segundo branch, clearAutoSave (após o primeiro) < setItems([newItem])
    const clear2 = body.indexOf('clearAutoSave()', clear1 + 1);
    const setItems2 = body.indexOf('setItems([newItem])');
    expect(clear2).toBeGreaterThan(-1);
    expect(clear2).toBeLessThan(setItems2);
  });
});
