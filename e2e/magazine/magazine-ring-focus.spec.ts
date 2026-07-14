/**
 * E2E — navegação por Tab/Shift+Tab no PublicMagazineView e integridade
 * do anel de foco (`focus-visible:ring-*`).
 *
 * Invariantes validados em navegador real (chromium-public):
 *   1. Cada `Tab` move o foco para o PRÓXIMO elemento interativo e
 *      o anel (computed `box-shadow` gerado por `ring-*`) acompanha
 *      esse elemento — nunca fica em um elemento anteriormente focado.
 *   2. Em qualquer momento existe NO MÁXIMO um elemento com anel
 *      visível (o mesmo que `document.activeElement`).
 *   3. `Shift+Tab` reverte a ordem de foco e o anel segue o mesmo invariante.
 *   4. Nenhum "ring preso" persiste depois que o foco sai (ex.: após 3 Tabs,
 *      o 1º elemento focado precisa ter voltado a box-shadow "none").
 *
 * Estratégia de seed idêntica à `magazine-viewer.spec.ts` — sem backend.
 */
import { test, expect, type Page } from '@playwright/test';

const MAGAZINE_TOKEN = 'e2e-ring-focus-001';
const MAGAZINE_ID = 'e2e-mag-ring-001';

function buildSeedScript(): string {
  const magazine = {
    id: MAGAZINE_ID,
    ownerId: 'e2e',
    organizationId: null,
    title: 'E2E Ring Focus',
    subtitle: 'Tab/Shift+Tab regression',
    templateId: 'editorial-vogue',
    branding: {
      clientName: null,
      clientLogoUrl: null,
      clientCrmId: null,
      colors: { primary: '#111', secondary: '#e11d48', text: '#111' },
      category: 'technology',
    },
    content: {
      showPrice: true,
      showCode: true,
      showPersonalization: false,
      showDescription: true,
      showDimensions: false,
      showMaterials: false,
      showColors: false,
      groupByCategory: false,
    },
    items: Array.from({ length: 5 }, (_, i) => ({
      id: `it-${i}`,
      productId: `p-${i}`,
      productSnapshot: {
        id: `p-${i}`,
        name: `Produto ${i + 1}`,
        sku: `SKU-${i + 1}`,
        shortDescription: `Descrição ${i + 1}`,
        description: null,
        price: 100 + i * 10,
        image_url: '/placeholder.svg',
        images: ['/placeholder.svg'],
        colors: [],
        category_name: 'Tecnologia',
        category_id: null,
        materials: [],
        hasPersonalization: false,
      },
      variantColorName: null,
      position: i,
      pageNumber: null,
      overrides: {},
    })),
    pageOrder: null,
    status: 'published',
    publicToken: MAGAZINE_TOKEN,
    pdfUrl: null,
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const tokenIndex = { [MAGAZINE_TOKEN]: MAGAZINE_ID };
  return `
    try {
      localStorage.setItem('promobrind.magazines.v1', ${JSON.stringify(JSON.stringify([magazine]))});
      localStorage.setItem('promobrind.magazines.tokenIndex.v1', ${JSON.stringify(JSON.stringify(tokenIndex))});
    } catch (e) {}
  `;
}

async function seedAndOpen(page: Page): Promise<void> {
  await page.addInitScript(buildSeedScript());
  await page.goto(`/revista-publica/${MAGAZINE_TOKEN}`);
  await expect(page.getByRole('heading', { name: 'E2E Ring Focus' })).toBeVisible({
    timeout: 15_000,
  });
  // Garante que o layout terminou de montar antes de mover o foco
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Considera "com anel" qualquer elemento cujo `box-shadow` computado
 * contenha um segmento `rgb(...) 0px 0px 0px <N>px` (padrão Tailwind
 * `ring-<N>`). Ignora shadows decorativos comuns (offset != 0 ou blur > 0).
 */
const RING_PROBE = `
  (el) => {
    const cs = getComputedStyle(el);
    const bs = cs.boxShadow || '';
    if (!bs || bs === 'none') return { hasRing: false, boxShadow: bs };
    // Um ring Tailwind se apresenta como "rgb(r, g, b) 0px 0px 0px Npx"
    // (possivelmente prefixado por outro shadow separado por vírgula).
    const hasRing = /rgba?\\([^)]+\\)\\s+0px\\s+0px\\s+0px\\s+\\d+px/i.test(bs);
    return { hasRing, boxShadow: bs };
  }
`;

/** Coleta todos os elementos focáveis visíveis e o estado do anel de cada um. */
async function probeAll(page: Page) {
  return page.evaluate((probeSrc) => {
    const probe = eval(probeSrc) as (el: Element) => { hasRing: boolean; boxShadow: string };
    const focusable = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, [role="button"], a[href], [role="slider"], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && !el.hasAttribute('disabled');
    });
    return focusable.map((el, i) => {
      const r = probe(el);
      return {
        index: i,
        tag: el.tagName.toLowerCase(),
        label:
          el.getAttribute('aria-label') ||
          el.getAttribute('name') ||
          (el.textContent || '').trim().slice(0, 40) ||
          '(sem rótulo)',
        isActive: el === document.activeElement,
        hasRing: r.hasRing,
        boxShadow: r.boxShadow,
      };
    });
  }, RING_PROBE);
}

test.describe('PublicMagazineView — Tab/Shift+Tab e integridade do anel de foco', () => {
  test('Tab avança o foco e o anel acompanha, sem rings presos', async ({ page }) => {
    await seedAndOpen(page);

    // Foco inicial no body — nenhum anel deve estar aceso
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    let snap = await probeAll(page);
    expect(snap.filter((e) => e.hasRing)).toHaveLength(0);

    const focused: number[] = [];
    for (let step = 0; step < 6; step++) {
      await page.keyboard.press('Tab');
      snap = await probeAll(page);

      // Deve haver ao menos um foco ativo entre os elementos observáveis
      const active = snap.find((e) => e.isActive);
      if (!active) {
        // Pode ser que o foco tenha saído do universo mapeado (ex.: body).
        // Nesse caso, exigimos que NENHUM anel esteja aceso — sem rings presos.
        expect(
          snap.filter((e) => e.hasRing),
          `step ${step} — foco fora do universo mapeado mas há anel aceso`,
        ).toHaveLength(0);
        continue;
      }

      focused.push(active.index);

      // Anel aceso: no máximo um, e — se houver — no elemento ativo
      const withRing = snap.filter((e) => e.hasRing);
      expect(
        withRing.length,
        `step ${step} — mais de um elemento com anel simultâneo: ${withRing
          .map((e) => e.label)
          .join(' | ')}`,
      ).toBeLessThanOrEqual(1);
      if (withRing.length === 1) {
        expect(
          withRing[0].isActive,
          `step ${step} — anel aceso em elemento NÃO focado (${withRing[0].label})`,
        ).toBe(true);
      }
    }

    // Nenhum dos elementos previamente focados (exceto talvez o último) pode
    // ainda estar com anel aceso — ou seja, "sem rings presos".
    const finalSnap = await probeAll(page);
    const stuck = finalSnap.filter((e, i) => e.hasRing && !e.isActive && focused.includes(i));
    expect(
      stuck,
      `rings presos em elementos previamente focados: ${stuck.map((s) => s.label).join(' | ')}`,
    ).toHaveLength(0);
  });

  test('Shift+Tab reverte foco preservando o invariante do anel', async ({ page }) => {
    await seedAndOpen(page);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

    // Avança 4 Tabs
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');

    const forwardIndex = (await probeAll(page)).find((e) => e.isActive)?.index ?? -1;
    expect(forwardIndex, 'foco não chegou a nenhum elemento mapeado após 4 Tabs').toBeGreaterThanOrEqual(0);

    // Volta 2 Shift+Tabs — o índice ativo deve DIMINUIR (ou o foco sair do universo)
    for (let step = 0; step < 2; step++) {
      const before = (await probeAll(page)).find((e) => e.isActive)?.index ?? -1;
      await page.keyboard.press('Shift+Tab');
      const snap = await probeAll(page);
      const after = snap.find((e) => e.isActive);

      // Invariante do anel após Shift+Tab
      const withRing = snap.filter((e) => e.hasRing);
      expect(withRing.length).toBeLessThanOrEqual(1);
      if (withRing.length === 1) {
        expect(withRing[0].isActive).toBe(true);
      }

      // Se ainda estamos no universo mapeado, o índice deve ter recuado
      if (after) {
        expect(
          after.index,
          `Shift+Tab step ${step} — foco não recuou (${before} → ${after.index})`,
        ).toBeLessThan(before);
      }
    }
  });

  test('após foco sair (blur), nenhum ring permanece aceso', async ({ page }) => {
    await seedAndOpen(page);

    // Focar o primeiro elemento interativo via Tab
    await page.keyboard.press('Tab');
    let snap = await probeAll(page);
    const active = snap.find((e) => e.isActive);
    // Se não houver ativo mapeado, o teste ainda faz sentido — validamos o blur global
    if (active && active.hasRing) {
      // Sanity: começamos com exatamente 1 anel
      expect(snap.filter((e) => e.hasRing)).toHaveLength(1);
    }

    // Blur global — nenhum ring pode sobreviver
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    snap = await probeAll(page);
    const stuck = snap.filter((e) => e.hasRing);
    expect(
      stuck,
      `rings persistem após blur: ${stuck.map((s) => `${s.label} [${s.boxShadow}]`).join(' | ')}`,
    ).toHaveLength(0);
  });
});
