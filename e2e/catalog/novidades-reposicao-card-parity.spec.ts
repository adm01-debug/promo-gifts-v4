/**
 * E2E — Paridade visual entre cards de /novidades e /reposicao.
 *
 * Mede o primeiro `role="listitem"` de cada grid e compara largura/altura
 * com tolerância pequena. Também valida que a imagem (aspect-square) tem
 * proporção ~1:1 nos dois módulos. Tira screenshots para diff visual.
 *
 * Skipa quando algum dos datasets está vazio (ambiente de smoke sem dados).
 */
import { test, expect, requireAuth } from '../fixtures/test-base';
import { gotoAndSettle } from '../helpers/nav';

const TOL_PX = 4;

/**
 * Tolerância por breakpoint — refletindo as regras do BaseProductGridCard:
 *  - mobile  (< 640): h-[400px] — px-snap pode variar até 3px no DPR mobile.
 *  - sm/md   (640–1023): h-[430px] — layout estável, ±2px.
 *  - lg/xl   (≥ 1024): h-[430px] — layout estável, ±2px.
 */
function tolForViewport(w: number): number {
  if (w < 640) return 3;
  if (w < 1024) return 2;
  return 2;
}

async function sampleHeights(items: import('@playwright/test').Locator, n: number) {
  const heights: number[] = [];
  const widths: number[] = [];
  for (let i = 0; i < n; i++) {
    const b = await items.nth(i).boundingBox();
    if (b) {
      heights.push(b.height);
      widths.push(b.width);
    }
  }
  return { heights, widths };
}

async function openListMode(page: import('@playwright/test').Page) {
  await page.getByTestId('layout-popover-trigger').click();
  const listBtn = page.getByTestId('view-mode-list');
  await listBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await listBtn.click();
  await page.waitForTimeout(300);
}

async function measureFirstCard(page: import('@playwright/test').Page, listSelector: string) {
  const list = page.locator(listSelector);
  await expect(list).toBeVisible({ timeout: 15_000 });
  const items = page.locator(`${listSelector} >> [role="listitem"]`);
  const count = await items.count();
  if (count === 0) return null;
  const first = items.first();
  const box = await first.boundingBox();
  const img = first.locator('img').first();
  const imgBox = (await img.count()) > 0 ? await img.boundingBox() : null;
  // Rodapé (preço + estoque) — usado para validar alinhamento bottom.
  const footer = first.locator(
    '[data-testid="product-card-footer"], [data-testid$="-card-footer"]',
  ).first();
  const footerBox = (await footer.count()) > 0 ? await footer.boundingBox() : null;
  return { box, imgBox, footerBox };
}

test.describe('Paridade visual — cards Novidades vs Reposição', () => {
  test.beforeEach(() => requireAuth());

  test('cards têm mesmas dimensões e imagem 1:1 nos dois módulos', async ({ page }, testInfo) => {
    // Novidades
    await gotoAndSettle(page, '/novidades');
    await expect(page.getByTestId('page-title-novidades')).toBeVisible();
    const novelty = await measureFirstCard(
      page,
      'div[role="list"][aria-label="Grade de novidades"]',
    );
    if (!novelty?.box) test.skip(true, 'Sem novidades no dataset.');
    await testInfo.attach('novidades.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    // Reposição
    await gotoAndSettle(page, '/reposicao');
    await expect(page.getByTestId('page-title-reposicao')).toBeVisible();
    const repl = await measureFirstCard(
      page,
      'div[role="list"][aria-label="Grade de produtos repostos"]',
    );
    if (!repl?.box) test.skip(true, 'Sem reposições no dataset.');
    await testInfo.attach('reposicao.png', {
      body: await page.screenshot({ fullPage: false }),
      contentType: 'image/png',
    });

    const widthDiff = Math.abs(novelty!.box!.width - repl!.box!.width);
    const heightDiff = Math.abs(novelty!.box!.height - repl!.box!.height);
    const ratios = [novelty!, repl!].map((m) =>
      m.imgBox ? m.imgBox.width / Math.max(m.imgBox.height, 1) : null,
    );

    // Log diff para aparecer no --reporter=list e nos artefatos do CI.
    // eslint-disable-next-line no-console
    console.log(
      `[card-parity] widthDiff=${widthDiff.toFixed(2)}px heightDiff=${heightDiff.toFixed(2)}px ` +
        `ratios=[${ratios.map((r) => (r === null ? 'n/a' : r.toFixed(3))).join(', ')}] tolerance=${TOL_PX}px`,
    );
    await testInfo.attach('card-parity-diff.json', {
      body: Buffer.from(
        JSON.stringify(
          {
            tolerance_px: TOL_PX,
            widthDiff_px: widthDiff,
            heightDiff_px: heightDiff,
            novelty_box: novelty!.box,
            repl_box: repl!.box,
            ratios,
          },
          null,
          2,
        ),
      ),
      contentType: 'application/json',
    });

    // 1) Larguras devem ser idênticas (mesmo grid responsivo).
    expect(widthDiff, `widthDiff=${widthDiff.toFixed(2)}px excede tolerância ${TOL_PX}px`).toBeLessThanOrEqual(TOL_PX);

    // 2) Alturas devem ser idênticas (mesmo min-h 420/430).
    expect(heightDiff, `heightDiff=${heightDiff.toFixed(2)}px excede tolerância ${TOL_PX}px`).toBeLessThanOrEqual(TOL_PX);

    // 3) Imagem com proporção ~1:1 em ambos.
    for (const m of [novelty!, repl!]) {
      if (m.imgBox) {
        const ratio = m.imgBox.width / Math.max(m.imgBox.height, 1);
        expect(ratio, `ratio=${ratio.toFixed(3)} fora de [0.9, 1.1]`).toBeGreaterThan(0.9);
        expect(ratio, `ratio=${ratio.toFixed(3)} fora de [0.9, 1.1]`).toBeLessThan(1.1);
      }
    }
  });

  test('rodapé (preço/estoque) está alinhado ao bottom em ambos os módulos', async ({ page }, testInfo) => {
    await gotoAndSettle(page, '/novidades');
    await expect(page.getByTestId('page-title-novidades')).toBeVisible();
    const novelty = await measureFirstCard(
      page,
      'div[role="list"][aria-label="Grade de novidades"]',
    );
    if (!novelty?.box || !novelty.footerBox) test.skip(true, 'Sem novidades / footer não encontrado.');

    await gotoAndSettle(page, '/reposicao');
    await expect(page.getByTestId('page-title-reposicao')).toBeVisible();
    const repl = await measureFirstCard(
      page,
      'div[role="list"][aria-label="Grade de produtos repostos"]',
    );
    if (!repl?.box || !repl.footerBox) test.skip(true, 'Sem reposições / footer não encontrado.');

    // Distância entre bottom do footer e bottom do card = padding interno.
    // Em ambos os módulos deve ser ~igual (mesmo p-3 do BaseProductGridCard).
    const novGap = novelty!.box!.y + novelty!.box!.height - (novelty!.footerBox!.y + novelty!.footerBox!.height);
    const replGap = repl!.box!.y + repl!.box!.height - (repl!.footerBox!.y + repl!.footerBox!.height);
    const gapDiff = Math.abs(novGap - replGap);

    // eslint-disable-next-line no-console
    console.log(
      `[card-parity:footer] novGap=${novGap.toFixed(2)}px replGap=${replGap.toFixed(2)}px diff=${gapDiff.toFixed(2)}px tolerance=${TOL_PX}px`,
    );
    await testInfo.attach('card-parity-footer.json', {
      body: Buffer.from(
        JSON.stringify(
          {
            tolerance_px: TOL_PX,
            novGap_px: novGap,
            replGap_px: replGap,
            gapDiff_px: gapDiff,
            novelty_footer: novelty!.footerBox,
            repl_footer: repl!.footerBox,
          },
          null,
          2,
        ),
      ),
      contentType: 'application/json',
    });

    expect(gapDiff, `gapDiff=${gapDiff.toFixed(2)}px excede tolerância ${TOL_PX}px`).toBeLessThanOrEqual(TOL_PX);
    expect(novGap, `novGap=${novGap.toFixed(2)}px alto — rodapé não ancora ao bottom`).toBeLessThan(32);
    expect(replGap, `replGap=${replGap.toFixed(2)}px alto — rodapé não ancora ao bottom`).toBeLessThan(32);
  });

  test('screenshot diff por viewport (artefato)', async ({ page }, testInfo) => {
    // Captura o primeiro card de cada módulo no viewport do project atual
    // (chromium-authed, firefox-authed, webkit-authed, mobile-chrome,
    // mobile-safari) para comparação visual antes/depois nos artefatos do CI.
    const projectName = testInfo.project.name;
    const vp = page.viewportSize();
    const vpLabel = vp ? `${vp.width}x${vp.height}` : 'unknown';

    for (const [route, label, listLabel, titleTid] of [
      ['/novidades', 'novidades', 'Grade de novidades', 'page-title-novidades'],
      ['/reposicao', 'reposicao', 'Grade de produtos repostos', 'page-title-reposicao'],
    ] as const) {
      await gotoAndSettle(page, route);
      await expect(page.getByTestId(titleTid)).toBeVisible();
      const items = page.locator(
        `div[role="list"][aria-label="${listLabel}"] >> [role="listitem"]`,
      );
      if ((await items.count()) === 0) {
        test.skip(true, `Sem itens em ${route} para screenshot diff.`);
      }
      const card = items.first();
      await testInfo.attach(`card-${label}-${projectName}-${vpLabel}.png`, {
        body: await card.screenshot(),
        contentType: 'image/png',
      });
    }
  });

  // Viewports extras (além dos 5 projects do playwright.config) para validar
  // que a altura responsiva do BaseProductGridCard (h-[400px] mobile,
  // sm:h-[430px] desktop) se mantém fixa também em tablets.
  const EXTRA_VIEWPORTS = [
    { w: 600, h: 900, label: 'tablet-sm-600' },
    { w: 768, h: 1024, label: 'tablet-768' },
    { w: 834, h: 1112, label: 'tablet-ipad-834' },
    { w: 1024, h: 1366, label: 'tablet-lg-1024' },
    { w: 1180, h: 820, label: 'tablet-ipad-air-1180' },
  ] as const;

  for (const vp of EXTRA_VIEWPORTS) {
    test(`altura fixa do card em viewport ${vp.label} (${vp.w}x${vp.h})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await gotoAndSettle(page, '/reposicao');
      await expect(page.getByTestId('page-title-reposicao')).toBeVisible();
      const items = page.locator(
        'div[role="list"][aria-label="Grade de produtos repostos"] >> [role="listitem"]',
      );
      const count = await items.count();
      if (count === 0) test.skip(true, `Sem reposições em ${vp.label}.`);
      const sampleSize = Math.min(count, 6);
      const heights: number[] = [];
      for (let i = 0; i < sampleSize; i++) {
        const b = await items.nth(i).boundingBox();
        if (b) heights.push(b.height);
      }
      const min = Math.min(...heights);
      const max = Math.max(...heights);
      const expected = vp.w < 640 ? 400 : 430;
      const tol = tolForViewport(vp.w);
      // eslint-disable-next-line no-console
      console.log(
        `[card-parity:viewport ${vp.label}] expected=${expected}px min=${min} max=${max} spread=${(max - min).toFixed(2)}px tol=${tol}px`,
      );
      expect(max - min, `cards variam em ${vp.label}: spread=${(max - min).toFixed(2)}px`).toBeLessThanOrEqual(tol);
      expect(Math.abs(min - expected), `altura ${min}px ≠ esperada ${expected}px em ${vp.label}`).toBeLessThanOrEqual(tol);

      // Baseline screenshot diff por viewport (snapshot persistente).
      const card = items.first();
      await expect(card).toHaveScreenshot(`card-reposicao-${vp.label}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    });
  }

  // Itera explicitamente os modos de grid 3 / 4 / 5 colunas usando os testIDs
  // do ColumnSelector (data-testid="column-option-N") e valida que todos os
  // cards visíveis mantêm altura idêntica em cada modo.
  for (const cols of [3, 4, 5] as const) {
    test(`grid ${cols} colunas — cards mantêm altura idêntica`, async ({ page }) => {
      // Desktop largo para garantir que as 3 opções existam no ColumnSelector.
      await page.setViewportSize({ width: 1600, height: 1000 });
      await gotoAndSettle(page, '/reposicao');
      await expect(page.getByTestId('page-title-reposicao')).toBeVisible();

      const option = page.getByTestId(`column-option-${cols}`);
      if ((await option.count()) === 0) {
        test.skip(true, `column-option-${cols} indisponível neste viewport.`);
      }
      await option.click();
      // Aguarda re-render do grid após troca de colunas.
      await page.waitForTimeout(400);

      const items = page.locator(
        'div[role="list"][aria-label="Grade de produtos repostos"] >> [role="listitem"]',
      );
      const count = await items.count();
      if (count === 0) test.skip(true, `Sem reposições no modo ${cols} colunas.`);

      const sampleSize = Math.min(count, cols * 2);
      const heights: number[] = [];
      const widths: number[] = [];
      for (let i = 0; i < sampleSize; i++) {
        const b = await items.nth(i).boundingBox();
        if (b) {
          heights.push(b.height);
          widths.push(b.width);
        }
      }
      const hSpread = Math.max(...heights) - Math.min(...heights);
      const wSpread = Math.max(...widths) - Math.min(...widths);
      // eslint-disable-next-line no-console
      console.log(
        `[card-parity:cols ${cols}] sample=${sampleSize} hSpread=${hSpread.toFixed(2)}px wSpread=${wSpread.toFixed(2)}px`,
      );
      expect(hSpread, `altura varia em ${cols} colunas: ${hSpread.toFixed(2)}px`).toBeLessThanOrEqual(TOL_PX);
      expect(wSpread, `largura varia em ${cols} colunas: ${wSpread.toFixed(2)}px`).toBeLessThanOrEqual(TOL_PX);

      // Baseline screenshot diff por modo de colunas.
      await expect(items.first()).toHaveScreenshot(`card-reposicao-cols-${cols}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
      });
    });
  }

  // Captura automática de screenshot + DOM html quando qualquer teste deste
  // describe falhar — facilita o diff antes/depois nos artefatos do CI.
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus) return;
    try {
      const vp = page.viewportSize();
      const tag = `${testInfo.title.replace(/[^a-z0-9]+/gi, '_')}-${vp ? `${vp.width}x${vp.height}` : 'novp'}`;
      await testInfo.attach(`failure-${tag}.png`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
      await testInfo.attach(`failure-${tag}.html`, {
        body: Buffer.from(await page.content()),
        contentType: 'text/html',
      });
    } catch {
      // best-effort — não mascarar a falha original
    }
  });

  // Rodapé alinhado verticalmente após alternar entre 3/4/5 colunas.
  test('rodapé permanece alinhado ao bottom após alternar 3/4/5 colunas', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await gotoAndSettle(page, '/reposicao');
    await expect(page.getByTestId('page-title-reposicao')).toBeVisible();

    for (const cols of [3, 4, 5] as const) {
      const option = page.getByTestId(`column-option-${cols}`);
      if ((await option.count()) === 0) continue;
      await option.click();
      await page.waitForTimeout(400);

      const items = page.locator(
        'div[role="list"][aria-label="Grade de produtos repostos"] >> [role="listitem"]',
      );
      const count = await items.count();
      if (count === 0) continue;
      const sampleSize = Math.min(count, cols * 2);
      const gaps: number[] = [];
      for (let i = 0; i < sampleSize; i++) {
        const card = items.nth(i);
        const cBox = await card.boundingBox();
        const footer = card
          .locator('[data-testid="product-card-footer"], [data-testid$="-card-footer"]')
          .first();
        if ((await footer.count()) === 0 || !cBox) continue;
        const fBox = await footer.boundingBox();
        if (!fBox) continue;
        gaps.push(cBox.y + cBox.height - (fBox.y + fBox.height));
      }
      if (gaps.length < 2) continue;
      const spread = Math.max(...gaps) - Math.min(...gaps);
      // eslint-disable-next-line no-console
      console.log(`[card-parity:footer cols ${cols}] sample=${gaps.length} spread=${spread.toFixed(2)}px`);
      expect(spread, `rodapé desalinhado em ${cols} colunas: ${spread.toFixed(2)}px`).toBeLessThanOrEqual(TOL_PX);
      expect(Math.max(...gaps), `rodapé não ancora ao bottom em ${cols} colunas`).toBeLessThan(32);
    }
  });

  // Viewports com deviceScaleFactor 0.9 e 1.1 — Playwright exige novo context.
  for (const dsf of [0.9, 1.1] as const) {
    test(`altura do card mantém paridade com deviceScaleFactor=${dsf}`, async ({ browser }) => {
      const ctx = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: dsf,
        storageState: 'e2e/.auth/storageState.json',
      });
      const page = await ctx.newPage();
      try {
        await gotoAndSettle(page, '/reposicao');
        await expect(page.getByTestId('page-title-reposicao')).toBeVisible();
        const items = page.locator(
          'div[role="list"][aria-label="Grade de produtos repostos"] >> [role="listitem"]',
        );
        const count = await items.count();
        if (count === 0) test.skip(true, `Sem reposições em dsf=${dsf}.`);
        const sampleSize = Math.min(count, 6);
        const heights: number[] = [];
        for (let i = 0; i < sampleSize; i++) {
          const b = await items.nth(i).boundingBox();
          if (b) heights.push(b.height);
        }
        const spread = Math.max(...heights) - Math.min(...heights);
        // eslint-disable-next-line no-console
        console.log(
          `[card-parity:dsf ${dsf}] min=${Math.min(...heights)} max=${Math.max(...heights)} spread=${spread.toFixed(2)}px`,
        );
        // Em CSS-px a altura permanece 430 independente do dsf.
        expect(spread, `spread=${spread.toFixed(2)}px excede ${TOL_PX}px em dsf=${dsf}`).toBeLessThanOrEqual(TOL_PX);
        expect(Math.abs(Math.min(...heights) - 430), `altura ≠ 430px em dsf=${dsf}`).toBeLessThanOrEqual(TOL_PX);
      } finally {
        await ctx.close();
      }
    });
  }

  // Modo de visualização em LISTA — usa testid estável `view-mode-list`
  // do LayoutPopover (sem fallback, sem skip por toggle ausente).
  test('modo lista — dimensões do card permanecem consistentes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await gotoAndSettle(page, '/reposicao');
    await expect(page.getByTestId('page-title-reposicao')).toBeVisible();

    await openListMode(page);

    const items = page.locator(
      'div[role="list"][aria-label="Grade de produtos repostos"] >> [role="listitem"]',
    );
    const count = await items.count();
    if (count === 0) test.skip(true, 'Sem reposições no dataset (modo lista).');
    const sampleSize = Math.min(count, 6);
    const { heights, widths } = await sampleHeights(items, sampleSize);
    const hSpread = Math.max(...heights) - Math.min(...heights);
    const wSpread = Math.max(...widths) - Math.min(...widths);
    // eslint-disable-next-line no-console
    console.log(
      `[card-parity:list] sample=${sampleSize} hSpread=${hSpread.toFixed(2)}px wSpread=${wSpread.toFixed(2)}px`,
    );
    expect(hSpread, `altura varia no modo lista: ${hSpread.toFixed(2)}px`).toBeLessThanOrEqual(TOL_PX);
    expect(wSpread, `largura varia no modo lista: ${wSpread.toFixed(2)}px`).toBeLessThanOrEqual(TOL_PX);

    // Baseline screenshot do modo lista.
    await expect(items.first()).toHaveScreenshot('card-reposicao-list-mode.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    });
  });
});
});
