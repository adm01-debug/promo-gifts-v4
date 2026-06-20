/**
 * Bateria exaustiva (fuzz/propriedade) de image-utils — validação do restore
 * de CdnVariant + variante 'card' (PR #698) e invariantes das funções de galeria.
 * PRNG semeado → determinístico e reproduzível.
 */
import { describe, it, expect } from 'vitest';
import {
  getCdnUrl,
  getSrcSet,
  getImageSizes,
  getOgImageUrl,
  getPrimaryImageUrl,
  getColorHeroImage,
  groupImages,
  getColorImages,
  getAvailableColors,
  getColorThumbnail,
  type CdnVariant,
  type ProductImageMeta,
} from '@/utils/image-utils';

const VARIANTS: CdnVariant[] = ['thumbnail', 'small', 'card', 'medium', 'large', 'public'];

// PRNG semeado (mulberry32) — reproduzível
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, arr: readonly T[]) => arr[Math.floor(r() * arr.length)];

const CDN_BASES = [
  'https://imagedelivery.net/AbC123xYz/0f1e2d3c-4b5a-6789-abcd-ef0123456789',
  'https://imagedelivery.net/hash/img-with-card-in-id',
  'https://imagedelivery.net/h/UPPER-CASE-ID-99',
  'https://imagedelivery.net/a/b/c/deep/path/id',
];
const NON_CDN = [
  'https://www.spotgifts.com.br/fotos/produtos/foo.jpg',
  'https://cdn.example.com/large', // termina em sufixo mas NÃO é imagedelivery
  '/placeholder.svg',
  'data:image/png;base64,AAAA',
  'relative/path/public',
];

describe('getCdnUrl — fuzz (variantes × formas de URL)', () => {
  it('aplica a variante pedida a qualquer URL CDN, com ou sem sufixo prévio (168 casos)', () => {
    for (const base of CDN_BASES) {
      const shapes = [base, ...VARIANTS.map((v) => `${base}/${v}`)]; // 7 formas
      for (const url of shapes) {
        for (const v of VARIANTS) {
          expect(getCdnUrl(url, v)).toBe(`${base}/${v}`);
        }
      }
    }
  });

  it('é idempotente: reaplicar variantes nunca acumula sufixos (144 combinações)', () => {
    for (const base of CDN_BASES) {
      for (const v1 of VARIANTS) {
        for (const v2 of VARIANTS) {
          expect(getCdnUrl(getCdnUrl(base, v1), v2)).toBe(getCdnUrl(base, v2));
        }
      }
    }
  });

  it('não altera URLs fora do CDN (30 casos)', () => {
    for (const url of NON_CDN) for (const v of VARIANTS) expect(getCdnUrl(url, v)).toBe(url);
  });

  it('null/undefined/vazio → placeholder (18 casos)', () => {
    for (const v of VARIANTS) {
      expect(getCdnUrl(null, v)).toBe('/placeholder.svg');
      expect(getCdnUrl(undefined, v)).toBe('/placeholder.svg');
      expect(getCdnUrl('', v)).toBe('/placeholder.svg');
    }
  });

  it('default é public; só remove sufixo no FIM do path', () => {
    expect(getCdnUrl(CDN_BASES[0])).toBe(`${CDN_BASES[0]}/public`);
    // 'card' no meio do id não pode ser tocado
    expect(getCdnUrl('https://imagedelivery.net/hash/card/real-id', 'large')).toBe(
      'https://imagedelivery.net/hash/card/real-id/large',
    );
  });
});

describe('getSrcSet — consistência com getCdnUrl', () => {
  const WIDTHS: Array<[CdnVariant, number]> = [
    ['thumbnail', 150],
    ['small', 400],
    ['card', 480],
    ['medium', 800],
    ['large', 1200],
  ];

  it('5 entradas corretas para toda forma de URL CDN (28 formas × 5)', () => {
    for (const base of CDN_BASES) {
      for (const url of [base, ...VARIANTS.map((v) => `${base}/${v}`)]) {
        const out = getSrcSet(url);
        expect(out).toBeDefined();
        const entries = out!.split(', ');
        expect(entries).toHaveLength(5);
        for (const [i, [variant, w]] of WIDTHS.entries()) {
          expect(entries[i]).toBe(`${getCdnUrl(url, variant)} ${w}w`);
        }
      }
    }
  });

  it('não-CDN / null / undefined / vazio → undefined', () => {
    for (const url of [...NON_CDN, null, undefined, '']) expect(getSrcSet(url)).toBeUndefined();
  });
});

describe('getImageSizes', () => {
  it('cobre os 4 contextos + fallback', () => {
    expect(getImageSizes('card')).toContain('25vw');
    expect(getImageSizes('gallery')).toBe('(max-width: 768px) 100vw, 50vw');
    expect(getImageSizes('hero')).toBe('(max-width: 768px) 100vw, 60vw');
    expect(getImageSizes('thumb')).toBe('80px');
    expect(getImageSizes('invalid' as never)).toBe('100vw');
  });
});

// ───────────────── Geração aleatória de ProductImageMeta ─────────────────
const TYPES = [
  'main',
  'gallery',
  'logo',
  'ambient',
  'box',
  'pouch',
  'location',
  'area',
  'component',
  'detail',
  'product',
  'set',
] as const;
function randomImage(r: () => number, idx: number): ProductImageMeta {
  const applies = r() < 0.5;
  return {
    id: `img-${idx}`,
    url_cdn: `https://imagedelivery.net/h/id-${idx}`,
    url_original: r() < 0.3 ? null : `https://orig/${idx}.jpg`,
    image_type: pick(r, TYPES),
    is_primary: r() < 0.15,
    is_og_image: r() < 0.1,
    applies_to_color: applies ? true : r() < 0.5 ? false : null,
    supplier_code: applies ? String(Math.floor(r() * 5) + 100) : r() < 0.2 ? 'ABC' : null,
    alt_text: r() < 0.5 ? `alt ${idx}` : null,
    title_text: null,
    display_order: idx,
  };
}
function randomSet(r: () => number, n: number): ProductImageMeta[] {
  return Array.from({ length: n }, (_, i) => randomImage(r, i));
}

describe('getOgImageUrl / getPrimaryImageUrl — prioridade sob 200 conjuntos aleatórios', () => {
  it('respeita is_og_image → main → is_primary → primeira; vazio → null', () => {
    const r = rng(42);
    for (let trial = 0; trial < 200; trial++) {
      const imgs = randomSet(r, Math.floor(r() * 12)); // 0..11 imagens
      const expected =
        imgs.find((i) => i.is_og_image) ??
        imgs.find((i) => i.image_type === 'main') ??
        imgs.find((i) => i.is_primary) ??
        imgs[0];
      const want = expected?.url_cdn ?? null;
      expect(getOgImageUrl(imgs)).toBe(want);
      expect(getPrimaryImageUrl(imgs)).toBe(want); // funções declaradas com a MESMA prioridade
    }
  });
});

describe('groupImages — partição correta sob 100 conjuntos aleatórios', () => {
  it('cada grupo contém exatamente os tipos esperados; hero = primeira is_primary', () => {
    const r = rng(7);
    for (let trial = 0; trial < 100; trial++) {
      const imgs = randomSet(r, Math.floor(r() * 15));
      const g = groupImages(imgs);
      expect(g.hero).toBe(imgs.find((i) => i.is_primary) ?? null);
      expect(g.main.every((i) => i.image_type === 'main')).toBe(true);
      expect(g.packaging.every((i) => i.image_type === 'box' || i.image_type === 'pouch')).toBe(
        true,
      );
      expect(
        g.technical.every((i) => ['location', 'area', 'component'].includes(i.image_type)),
      ).toBe(true);
      // contagem bate com filtro independente
      expect(g.gallery.length).toBe(imgs.filter((i) => i.image_type === 'gallery').length);
      expect(g.logo.length).toBe(imgs.filter((i) => i.image_type === 'logo').length);
      expect(g.ambient.length).toBe(imgs.filter((i) => i.image_type === 'ambient').length);
    }
  });
});

describe('getColorImages — invariantes ADR-001 sob 200 conjuntos aleatórios', () => {
  it('sem técnicos; sem duplicatas; hero (main) sempre primeiro quando existe', () => {
    const r = rng(1337);
    const TECHNICAL = new Set(['box', 'pouch', 'location', 'area', 'component']);
    for (let trial = 0; trial < 200; trial++) {
      const imgs = randomSet(r, Math.floor(r() * 15));
      const color = String(100 + Math.floor(r() * 5));
      const out = getColorImages(imgs, color);

      // 1) nenhum tipo técnico (hero main nunca é técnico por definição)
      expect(out.every((i) => !TECHNICAL.has(i.image_type) || i.image_type === 'main')).toBe(true);
      // 2) sem ids duplicados
      const ids = out.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      // 3) hero canônico primeiro, quando existe
      const heroCanonico =
        imgs.find((i) => i.image_type === 'main' && i.is_primary) ??
        imgs.find((i) => i.image_type === 'main' && !i.applies_to_color);
      if (heroCanonico) expect(out[0]).toBe(heroCanonico);
      // 4) todo não-hero é específico da cor
      for (const i of out.slice(out[0] === heroCanonico ? 1 : 0)) {
        if (i !== heroCanonico)
          expect(i.applies_to_color === true && i.supplier_code === color).toBe(true);
      }
    }
  });
});

describe('getAvailableColors / getColorThumbnail / getColorHeroImage — 100 conjuntos', () => {
  it('cores = supplier_codes numéricos únicos ordenados; thumbnail/hero priorizam main>gallery', () => {
    const r = rng(2026);
    for (let trial = 0; trial < 100; trial++) {
      const imgs = randomSet(r, Math.floor(r() * 15));
      const colors = getAvailableColors(imgs);
      expect(colors).toEqual([...new Set(colors)].sort());
      for (const c of colors) expect(c).toMatch(/^\d+$/);

      for (const c of colors) {
        const ofColor = imgs.filter((i) => i.supplier_code === c && i.applies_to_color === true);
        const expected =
          ofColor.find((i) => i.image_type === 'main') ??
          ofColor.find((i) => i.image_type === 'gallery') ??
          ofColor[0] ??
          null;
        expect(getColorThumbnail(imgs, c)).toBe(expected);
        expect(getColorHeroImage(imgs, c)).toBe(expected); // mesma prioridade declarada
      }
      // cor inexistente → null
      expect(getColorThumbnail(imgs, 'zzz')).toBeNull();
    }
  });
});
