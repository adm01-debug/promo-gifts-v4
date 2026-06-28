/**
 * QuoteViewPage · sem overflow horizontal e tipografia "clean".
 *
 * Garante, sobre o harness `/__visual/quote-view-order`:
 *  - viewports 320/375/768 não geram overflow horizontal de página
 *    (a tabela tem `overflow-x-auto` interno; o `<body>` jamais excede o viewport).
 *  - escala tipográfica respeita o teto "clean": nenhum texto visível no
 *    conteúdo principal renderiza acima de 20px (totais usam `text-lg` = 18px;
 *    títulos do harness usam `text-sm` = 14px). Detecta regressões de fontes
 *    grandes acidentalmente reintroduzidas.
 */
import { test, expect, type Page } from '@playwright/test';
import { gotoAndSettle } from '../helpers/nav';

const ROUTE = '/__visual/quote-view-order';
const VIEWPORTS = [
  { name: '320', width: 320, height: 720 },
  { name: '375', width: 375, height: 800 },
  { name: '768', width: 768, height: 1024 },
] as const;

const MAX_FONT_PX = 20; // teto editorial p/ tela "clean" no harness

async function open(page: Page) {
  await gotoAndSettle(page, ROUTE);
  await expect(page.getByTestId('quote-view-order-harness')).toBeVisible();
}

for (const vp of VIEWPORTS) {
  test(`sem overflow horizontal @ ${vp.name}px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page);
    const { scrollW, clientW } = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    expect(
      scrollW,
      `overflow horizontal detectado: scrollWidth=${scrollW} > clientWidth=${clientW}`,
    ).toBeLessThanOrEqual(clientW + 1); // tolerância 1px p/ sub-pixel
  });

  test(`tipografia dentro do teto clean (≤ ${MAX_FONT_PX}px) @ ${vp.name}px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await open(page);
    const offenders = await page
      .getByTestId('quote-view-order-harness')
      .evaluate((root, max) => {
        const found: { tag: string; text: string; size: number }[] = [];
        const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_ELEMENT);
        let n: Node | null = walker.currentNode;
        while (n) {
          const el = n as HTMLElement;
          if (el.children.length === 0 && el.textContent?.trim()) {
            const size = parseFloat(getComputedStyle(el).fontSize);
            if (size > max) {
              found.push({
                tag: el.tagName.toLowerCase(),
                text: el.textContent.trim().slice(0, 40),
                size,
              });
            }
          }
          n = walker.nextNode();
        }
        return found;
      }, MAX_FONT_PX);
    expect(
      offenders,
      `fontes acima do teto clean (${MAX_FONT_PX}px): ${JSON.stringify(offenders, null, 2)}`,
    ).toEqual([]);
  });
}
