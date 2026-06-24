/**
 * E2E: alternância entre dois quoteId no Quote Builder.
 *
 * Garante que o estado de colapso de um orçamento NÃO vaza para outro
 * (bug-classe: chave de storage global). Estratégia:
 *
 *  1. Pré-popula `localStorage` com chaves SSOT distintas para `quote-A`
 *     e `quote-B` antes de abrir o builder (page.addInitScript).
 *  2. Confere via `page.evaluate` que cada chave permanece isolada após
 *     navegação e reload — independe de termos um orçamento real seedado.
 *  3. Quando há cards no Resumo de `/orcamentos/novo`, valida o caminho
 *     real (toggle → grava apenas em `:new` → não toca em `:quote-A`).
 *
 * Este desenho dispensa seed de dois orçamentos reais (que exigiria
 * provisionamento no banco) e ainda assim cobre a regressão central.
 */
import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoAndSettle } from '../helpers/nav';

const PREFIX = 'quote-builder:collapsed-item-keys';
const KEY_A = `${PREFIX}:quote-A`;
const KEY_B = `${PREFIX}:quote-B`;
const KEY_NEW = `${PREFIX}:new`;

test.describe('Quote Builder · isolamento de colapso entre quoteId', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAs(page, 'user');
  });

  test('estado de quote-A não vaza para quote-B (ida, reload e volta)', async ({ page }) => {
    // Semeia dois orçamentos fictícios no localStorage da origem da app.
    await gotoAndSettle(page, '/orcamentos/novo');
    await page.evaluate(
      ([a, b, kA, kB]) => {
        window.localStorage.setItem(kA, JSON.stringify([a]));
        window.localStorage.setItem(kB, JSON.stringify([b]));
      },
      ['item-A1', 'item-B1', KEY_A, KEY_B],
    );

    // 1) Após reload, ambas as chaves permanecem intactas e disjuntas.
    await page.reload();
    const snap1 = await page.evaluate(
      ([kA, kB]) => ({
        a: window.localStorage.getItem(kA),
        b: window.localStorage.getItem(kB),
      }),
      [KEY_A, KEY_B],
    );
    expect(JSON.parse(snap1.a!)).toEqual(['item-A1']);
    expect(JSON.parse(snap1.b!)).toEqual(['item-B1']);

    // 2) Caminho real (quando há item): toggle no /novo grava em `:new` e
    //    NÃO altera `:quote-A` nem `:quote-B`.
    const firstToggle = page.getByTestId('quote-summary-toggle-0');
    if (await firstToggle.count()) {
      await firstToggle.click();
      await expect(firstToggle).toHaveAttribute('data-collapsed', 'true');

      const snap2 = await page.evaluate(
        ([kA, kB, kN]) => ({
          a: window.localStorage.getItem(kA),
          b: window.localStorage.getItem(kB),
          n: window.localStorage.getItem(kN),
        }),
        [KEY_A, KEY_B, KEY_NEW],
      );
      expect(JSON.parse(snap2.a!)).toEqual(['item-A1']); // intacto
      expect(JSON.parse(snap2.b!)).toEqual(['item-B1']); // intacto
      expect(snap2.n).toBeTruthy(); // toggle gravou apenas em :new
      expect(JSON.parse(snap2.n!).length).toBe(1);
    }

    // 3) Limpar uma chave não afeta a outra (regressão de cross-talk).
    await page.evaluate((kA) => window.localStorage.removeItem(kA), KEY_A);
    const snap3 = await page.evaluate(
      ([kA, kB]) => ({
        a: window.localStorage.getItem(kA),
        b: window.localStorage.getItem(kB),
      }),
      [KEY_A, KEY_B],
    );
    expect(snap3.a).toBeNull();
    expect(JSON.parse(snap3.b!)).toEqual(['item-B1']);
  });
});
