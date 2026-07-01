/**
 * Layout responsivo da linha "Tamanho da gravação" em ConfigurationPanelV6.
 *
 * Valida em 360px (mobile) e 768px (tablet) que o rótulo e o texto de
 * orientação ("Máx. X × Y cm") ficam na MESMA linha (mesmo `top` de bounding
 * box), evitando regressão do `flex-wrap` quebrar em segunda linha inesperada.
 *
 * Estratégia oportunística: abre um orçamento em rascunho e procura por um
 * painel de customização com técnica que use dimensão. Se o ambiente não
 * tiver um cenário adequado, `test.skip` (mantém a spec estável no CI, sem
 * depender de seed).
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAs } from '../helpers/auth';
import { gotoQuoteScenario } from './_helpers/quote-scenarios';

const VIEWPORTS = [
  { name: 'mobile-360', width: 360, height: 780 },
  { name: 'tablet-768', width: 768, height: 1024 },
] as const;

async function findSizeRow(page: Page) {
  // Localiza o rótulo "Tamanho da gravação" (visível só quando usa_dimensao).
  const label = page.getByText('Tamanho da gravação', { exact: true }).first();
  const count = await label.count().catch(() => 0);
  if (count === 0) return null;
  await label.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined);
  // O container flex-wrap é o pai direto do rótulo.
  const row = label.locator('xpath=..');
  return { label, row };
}

for (const vp of VIEWPORTS) {
  test.describe(`Linha "Tamanho da gravação" — ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`rótulo + orientação permanecem na mesma linha (${vp.width}px)`, async ({ page }) => {
      await loginAs(page);
      const ok = await gotoQuoteScenario(page, 'rascunho');
      test.skip(!ok, 'sem orçamento em rascunho neste ambiente');

      const found = await findSizeRow(page);
      test.skip(!found, 'painel de customização com dimensão não disponível');
      if (!found) return;

      const { label, row } = found;

      // 1) Container deve usar flex-wrap (fallback controlado).
      const cls = (await row.getAttribute('class')) ?? '';
      expect(cls).toMatch(/flex/);
      expect(cls).toMatch(/flex-wrap/);

      // 2) Todos os filhos diretos devem estar na MESMA linha visual.
      //    Tolerância de 4px absorve sub-pixel do line-box.
      const boxes = await row.evaluate((el) => {
        return Array.from(el.children).map((c) => {
          const r = (c as HTMLElement).getBoundingClientRect();
          return { top: r.top, bottom: r.bottom, text: c.textContent?.trim() ?? '' };
        });
      });
      expect(boxes.length).toBeGreaterThanOrEqual(2);

      const firstTop = boxes[0].top;
      for (const b of boxes) {
        expect(
          Math.abs(b.top - firstTop),
          `filho "${b.text}" quebrou para outra linha (top=${b.top} vs ${firstTop})`,
        ).toBeLessThanOrEqual(4);
      }

      // 3) Regressão explícita: a orientação NÃO pode voltar a um <p> separado.
      const hasP = await row.locator('p').count();
      expect(hasP).toBe(0);

      // 4) Confirma que a linha realmente contém o texto de orientação
      //    ("Máx. … cm") como irmão do rótulo.
      const rowText = (await row.textContent()) ?? '';
      expect(rowText).toContain('Tamanho da gravação');
      expect(rowText).toMatch(/Máx\..*cm/);

      // 5) Sanidade: label não pode transbordar sozinho o container.
      const rowBox = await row.boundingBox();
      const labelBox = await label.boundingBox();
      expect(rowBox && labelBox && labelBox.width <= rowBox.width + 1).toBeTruthy();
    });
  });
}
