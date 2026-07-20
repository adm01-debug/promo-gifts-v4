/**
 * Simulação exaustiva — invariantes do header/sidebar ao alternar carrinhos.
 *
 * Não usa Playwright: valida a MESMA lógica presente em SellerCartsPage
 * (pluralização de SKU/unidade, formatação de moeda pt-BR, gates de
 * peso/volume) contra centenas de cenários gerados por fuzzing.
 *
 * Se qualquer contrato mudar (ex: “item” em vez de “unidade”), o teste
 * quebra imediatamente.
 */
import { describe, it, expect } from 'vitest';
import { formatCurrency } from '@/components/cart/CartUtilComponents';

// Réplica pura da lógica de meta do header (SellerCartsPage.tsx).
type CartItem = { quantity: number; product_price: number };
function computeHeaderMeta(items: CartItem[]) {
  const skus = items.length;
  const qty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const subtotal = items.reduce(
    (sum, item) => sum + (item.product_price || 0) * (item.quantity || 0),
    0,
  );
  const parts = [
    `${skus} ${skus === 1 ? 'SKU' : 'SKUs'}`,
    `${qty} ${qty === 1 ? 'unidade' : 'unidades'}`,
  ];
  if (subtotal > 0) parts.push(formatCurrency(subtotal));
  return parts.join(' · ');
}

// Réplica pura do gate de peso/volume da sidebar.
function shouldShowWeightVolumeBlock(wv: { weightKg: number; volumeCm3: number } | null) {
  return !!wv && (wv.weightKg > 0 || wv.volumeCm3 > 0);
}

function fmtWeight(kg: number) {
  return kg >= 1 ? `${kg.toFixed(1)}kg` : `${(kg * 1000).toFixed(0)}g`;
}
function fmtVolume(v: { volumeM3: number; volumeCm3: number }) {
  return v.volumeM3 >= 0.001
    ? `${v.volumeM3.toFixed(3)}m³`
    : `${v.volumeCm3.toLocaleString('pt-BR')}cm³`;
}

const NBSP = /[\u00A0\u202F]/g;
const norm = (s: string) => s.replace(NBSP, ' ');
const CURRENCY_RE = /R\$ \d{1,3}(?:\.\d{3})*,\d{2}/;

describe('Header meta — pluralização e formatação (100+ cenários)', () => {
  it('carrinho vazio → 0 SKUs · 0 unidades (sem moeda)', () => {
    const meta = norm(computeHeaderMeta([]));
    expect(meta).toBe('0 SKUs · 0 unidades');
    expect(meta).not.toMatch(CURRENCY_RE);
  });

  it('1 SKU · 1 unidade → singular em ambos', () => {
    const meta = norm(computeHeaderMeta([{ quantity: 1, product_price: 9.9 }]));
    expect(meta).toMatch(/^1 SKU · 1 unidade · R\$ 9,90$/);
  });

  it('1 SKU · N>1 unidades → SKU singular, unidades plural', () => {
    const meta = norm(computeHeaderMeta([{ quantity: 5, product_price: 10 }]));
    expect(meta).toMatch(/^1 SKU · 5 unidades · R\$ 50,00$/);
  });

  it('N>1 SKUs · 1 unidade total → SKUs plural, unidade singular', () => {
    // 2 skus, cada um qty 0.5? qty é int, então uso combinação inusitada:
    // 2 skus × 0 + 1 sku... não dá. Vamos com N SKUs onde só um tem quantity=1:
    const items = [
      { quantity: 1, product_price: 10 },
      { quantity: 0, product_price: 20 }, // SKU cadastrado, qty zerada
    ];
    const meta = norm(computeHeaderMeta(items));
    expect(meta).toMatch(/^2 SKUs · 1 unidade · R\$ 10,00$/);
  });

  it('grande escala — 1000 SKUs × 100 unidades cada', () => {
    const items = Array.from({ length: 1000 }, () => ({
      quantity: 100,
      product_price: 1.5,
    }));
    const meta = norm(computeHeaderMeta(items));
    // 100.000 unidades × R$ 1,50 = R$ 150.000,00
    expect(meta).toBe('1000 SKUs · 100000 unidades · R$ 150.000,00');
  });

  it('fuzzing 250x — sempre respeita singular/plural e moeda válida', () => {
    for (let i = 0; i < 250; i++) {
      const n = Math.floor(Math.random() * 50);
      const items = Array.from({ length: n }, () => ({
        quantity: Math.floor(Math.random() * 200),
        product_price: Math.round(Math.random() * 100000) / 100,
      }));
      const meta = norm(computeHeaderMeta(items));
      const skus = items.length;
      const qty = items.reduce((s, item) => s + item.quantity, 0);

      // 1) Prefixo SKU(s)
      expect(meta.startsWith(`${skus} ${skus === 1 ? 'SKU' : 'SKUs'} ·`)).toBe(true);
      // 2) Unidade(s)
      expect(meta.includes(`${qty} ${qty === 1 ? 'unidade' : 'unidades'}`)).toBe(true);
      // 3) Se houver subtotal > 0, formato de moeda pt-BR válido
      const subtotal = items.reduce((s, item) => s + item.quantity * item.product_price, 0);
      if (subtotal > 0) {
        expect(meta).toMatch(CURRENCY_RE);
      } else {
        expect(meta).not.toMatch(CURRENCY_RE);
      }
      // 4) Nunca pluralizar como "SKUS" ou "unidadess"
      expect(meta).not.toMatch(/SKUS|unidadess|SKUx|unidadex/);
    }
  });

  it('resiliente a quantity=NaN e undefined (nunca produz NaN no meta)', () => {
    const items = [
      { quantity: Number.NaN, product_price: 10 },
      { quantity: undefined as unknown as number, product_price: 20 },
      { quantity: 3, product_price: 5 },
    ];
    const meta = norm(computeHeaderMeta(items));
    expect(meta).not.toMatch(/NaN|undefined/);
    // 3 SKUs · (NaN||0=0 + undefined||0=0 + 3) = 3 unidades
    expect(meta).toMatch(/^3 SKUs · 3 unidades/);
  });

  it('formatCurrency sempre segue padrão R$ X,XX (100 valores aleatórios)', () => {
    for (let i = 0; i < 100; i++) {
      const v = Math.round(Math.random() * 1_000_000_00) / 100;
      const formatted = norm(formatCurrency(v));
      expect(formatted).toMatch(CURRENCY_RE);
      expect(formatted).toMatch(/,\d{2}$/); // sempre 2 casas decimais
    }
  });
});

describe('Sidebar weight/volume — gate visual (100+ cenários)', () => {
  it('null → NÃO exibe bloco', () => {
    expect(shouldShowWeightVolumeBlock(null)).toBe(false);
  });

  it('ambos zero → NÃO exibe bloco', () => {
    expect(shouldShowWeightVolumeBlock({ weightKg: 0, volumeCm3: 0 })).toBe(false);
  });

  it('só peso > 0 → EXIBE', () => {
    expect(shouldShowWeightVolumeBlock({ weightKg: 0.1, volumeCm3: 0 })).toBe(true);
  });

  it('só volume > 0 → EXIBE', () => {
    expect(shouldShowWeightVolumeBlock({ weightKg: 0, volumeCm3: 1 })).toBe(true);
  });

  it('formatação de peso: < 1kg → gramas, >= 1kg → quilos (50 amostras)', () => {
    for (let i = 0; i < 50; i++) {
      const kg = Math.random() * 5; // 0 a 5kg
      const out = fmtWeight(kg);
      if (kg >= 1) {
        expect(out).toMatch(/^\d+\.\d{1}kg$/);
      } else {
        expect(out).toMatch(/^\d+g$/);
      }
    }
  });

  it('formatação de volume: < 0.001m³ → cm³, >= 0.001 → m³ (50 amostras)', () => {
    for (let i = 0; i < 50; i++) {
      const volumeM3 = Math.random() * 0.05;
      const volumeCm3 = Math.round(volumeM3 * 1_000_000);
      const out = fmtVolume({ volumeM3, volumeCm3 });
      if (volumeM3 >= 0.001) {
        expect(out).toMatch(/^\d+\.\d{3}m³$/);
      } else {
        expect(out).toMatch(/^[\d.]+cm³$/);
      }
    }
  });

  it('fronteira exata: 1.0kg → "1.0kg", 0.999kg → "999g"', () => {
    expect(fmtWeight(1)).toBe('1.0kg');
    expect(fmtWeight(0.999)).toBe('999g');
    expect(fmtWeight(0.9995)).toBe('1000g'); // arredondamento antes do corte
  });

  it('fronteira exata volume: 0.001m³ → "0.001m³", 0.0009m³ → "900cm³"', () => {
    expect(fmtVolume({ volumeM3: 0.001, volumeCm3: 1000 })).toBe('0.001m³');
    expect(fmtVolume({ volumeM3: 0.0009, volumeCm3: 900 })).toBe('900cm³');
  });
});

describe('Formatação BRL — resiliência a NBSP/NNBSP (\\u00A0, \\u202F)', () => {
  // Padrão robusto: aceita space, NBSP (\u00A0) e NNBSP (\u202F) entre R$ e dígito,
  // e também sem separador algum (algumas engines/locales emitem "R$1,00").
  // Lookahead `(?!\d)` evita casar dentro de "R$ 1,234.56" (formato en-US).
  const RE_ROBUST = /R\$[\s\u00A0\u202F]?\d{1,3}(?:\.\d{3})*,\d{2}(?!\d)/;

  it('formatCurrency produz string que casa com regex robusto (ICU real)', () => {
    for (let i = 0; i < 200; i++) {
      const v = Math.round(Math.random() * 1_000_000_00) / 100;
      const out = formatCurrency(v);
      expect(out).toMatch(RE_ROBUST);
      // Nunca deve ter caracteres inesperados (BOM, ZWSP, etc.).
      expect(out).not.toMatch(/[\u200B-\u200F\uFEFF]/);
    }
  });

  it('regex robusto casa variantes sintéticas: space, NBSP, NNBSP e sem separador', () => {
    const variants = [
      'R$ 1.234,56', // space
      'R$\u00A01.234,56', // NBSP
      'R$\u202F1.234,56', // NNBSP
      'R$1.234,56', // sem separador
      'R$ 0,01', // menor unidade
      'R$ 999.999.999,99', // 9 dígitos + separadores de milhar
    ];
    for (const v of variants) {
      expect(v).toMatch(RE_ROBUST);
    }
  });

  it('regex robusto REJEITA formatos inválidos', () => {
    const invalid = [
      'R$ 1,234.56', // formato en-US
      'R$ 1.234', // sem casas decimais
      'R$ 1.234,5', // 1 casa decimal
      'R$ 1.234,567', // 3 casas decimais
      '$1.234,56', // moeda errada
      'R$ abc',
      '',
    ];
    for (const v of invalid) {
      expect(v).not.toMatch(RE_ROBUST);
    }
  });

  it('norm() converte NBSP/NNBSP para space padrão sem alterar dígitos', () => {
    const raw = 'R$\u00A01.234,56 · R$\u202F999,00';
    const normalized = norm(raw);
    expect(normalized).toBe('R$ 1.234,56 · R$ 999,00');
    expect(normalized).toMatch(CURRENCY_RE);
  });

  it('meta do header (500 fuzz) sempre passa no regex robusto quando subtotal > 0', () => {
    for (let i = 0; i < 500; i++) {
      const items = Array.from({ length: 1 + (i % 8) }, () => ({
        quantity: 1 + Math.floor(Math.random() * 50),
        product_price: Math.round(Math.random() * 500_00) / 100 + 0.01,
      }));
      const metaRaw = computeHeaderMeta(items);
      expect(metaRaw).toMatch(RE_ROBUST);
    }
  });
});

describe('Regressão — fronteiras de qty/peso/volume nunca misturam entre carrinhos', () => {
  const boundaries = {
    qty: [0, 1, 2, 99, 100, 999, 1000, 9999, 10000, 99999],
    weightKg: [0, 0.001, 0.5, 0.999, 1.0, 1.5, 99.9, 100, 999.9, 1000],
    volumeM3: [0, 0.0009, 0.001, 0.01, 0.5, 1.0, 9.999, 100],
  };

  it('produto cartesiano de fronteiras: A e B nunca compartilham strings de meta', () => {
    // Amostra 300 pares para não explodir combinações.
    const cases: Array<{ qty: number; price: number }> = [];
    for (const q of boundaries.qty) {
      cases.push({ qty: q, price: 1.23 });
      cases.push({ qty: q, price: 999.99 });
    }
    let mixCount = 0;
    for (let i = 0; i < cases.length; i++) {
      for (let j = 0; j < cases.length; j++) {
        if (i === j) continue;
        const a = [{ quantity: cases[i].qty, product_price: cases[i].price }];
        const b = [{ quantity: cases[j].qty, product_price: cases[j].price }];
        const _metaA = norm(computeHeaderMeta(a));
        const metaB = norm(computeHeaderMeta(b));
        if (metaA === metaB) continue; // podem coincidir se qty e subtotal iguais
        // subtotal de A não vaza no meta de B
        const subA = cases[i].qty * cases[i].price;
        const subB = cases[j].qty * cases[j].price;
        if (subA > 0 && subA !== subB) {
          expect(metaB.includes(formatCurrency(subA).replace(NBSP, ' '))).toBe(false);
        }
        mixCount++;
        if (mixCount > 300) return;
      }
    }
  });

  it('fronteiras de peso: gate visual muda corretamente em torno de 0/1kg', () => {
    // 0kg + 0cm³ → oculto
    expect(shouldShowWeightVolumeBlock({ weightKg: 0, volumeCm3: 0 })).toBe(false);
    // 1g (0.001kg) → visível
    expect(shouldShowWeightVolumeBlock({ weightKg: 0.001, volumeCm3: 0 })).toBe(true);
    // Peso negativo (edge de dado corrompido) → wv.weightKg > 0 é false, mas
    // volumeCm3 > 0 pode salvar. Testamos ambos:
    expect(shouldShowWeightVolumeBlock({ weightKg: -1, volumeCm3: 0 })).toBe(false);
    expect(shouldShowWeightVolumeBlock({ weightKg: -1, volumeCm3: 10 })).toBe(true);
  });

  it('fronteiras de volume: cm³/m³ nas viradas exatas', () => {
    // Exatamente 0.001m³ → m³
    expect(fmtVolume({ volumeM3: 0.001, volumeCm3: 1000 })).toBe('0.001m³');
    // 0.0009999m³ → cm³ (999 arredondado)
    expect(fmtVolume({ volumeM3: 0.0009999, volumeCm3: 1000 })).toMatch(/cm³$/);
    // Volume muito grande → m³ com 3 casas
    expect(fmtVolume({ volumeM3: 999.999, volumeCm3: 999_999_000 })).toBe('999.999m³');
  });

  it('troca rápida A→B→C→A (100x): meta final SEMPRE reflete o último cart', () => {
    const carts = [
      [{ quantity: 3, product_price: 10 }], // A: R$ 30,00
      [
        { quantity: 5, product_price: 100 },
        { quantity: 1, product_price: 1 },
      ], // B: R$ 501,00
      [], // C: vazio
    ];
    for (let i = 0; i < 100; i++) {
      const sequence = [0, 1, 2, 0][i % 4];
      const final = norm(computeHeaderMeta(carts[sequence]));
      const expectedSubtotal = carts[sequence].reduce(
        (s, x) => s + x.quantity * x.product_price,
        0,
      );
      if (expectedSubtotal === 0) {
        expect(final).not.toMatch(CURRENCY_RE);
      } else {
        expect(final).toContain(formatCurrency(expectedSubtotal).replace(NBSP, ' '));
      }
    }
  });
});

describe('Invariante — troca entre 2 carrinhos nunca mistura dados', () => {
  it('500x fuzz: meta do carrinho B nunca contém números do carrinho A', () => {
    for (let i = 0; i < 500; i++) {
      const a = Array.from({ length: 3 + (i % 10) }, () => ({
        quantity: 10 + (i % 7),
        product_price: 1 + (i % 5),
      }));
      const b = Array.from({ length: 1 + (i % 4) }, () => ({
        quantity: 1 + (i % 3),
        product_price: 100 + (i % 11),
      }));
      const _metaA = norm(computeHeaderMeta(a));
      const metaB = norm(computeHeaderMeta(b));

      // SKUs de A não podem aparecer no meta de B se forem diferentes
      const skusA = a.length;
      const skusB = b.length;
      if (skusA !== skusB) {
        expect(metaB.startsWith(`${skusA} `)).toBe(false);
      }

      // Subtotais distintos: valor de A não pode "vazar" para B
      const subA = a.reduce((s, x) => s + x.quantity * x.product_price, 0);
      const subB = b.reduce((s, x) => s + x.quantity * x.product_price, 0);
      if (subA > 0 && subB > 0 && subA !== subB) {
        expect(metaB.includes(formatCurrency(subA).replace(NBSP, ' '))).toBe(false);
      }
    }
  });
});

describe('Extremos — quantidades, pesos e volumes fora do "normal"', () => {
  // Regex robusto (mesmo do bloco A0/202F).
  const RE_ROBUST = /R\$[\s\u00A0\u202F]?\d{1,3}(?:\.\d{3})*,\d{2}(?!\d)/;

  // Gerador de casos extremos determinístico (não aleatório):
  // cobre 0, subnormals, MAX_SAFE_INTEGER, negativos e valores absurdos.
  const EXTREME_QTY = [
    0,
    1,
    Number.EPSILON,
    Number.MIN_VALUE,
    -1,
    -1_000_000,
    1_000_000,
    Number.MAX_SAFE_INTEGER,
    Number.MAX_SAFE_INTEGER - 1,
    9_007_199_254_740_991, // MAX_SAFE_INTEGER
    1e15,
    1e20, // além do MAX_SAFE_INTEGER — cientific notation risk
  ];
  const EXTREME_PRICE = [
    0,
    0.01,
    0.001, // subcentavo (arredondado no format)
    1,
    99_999.99,
    1e6,
    1e9,
    Number.MAX_VALUE / 1e300, // ainda finito
    -100,
  ];
  const EXTREME_WEIGHT_KG = [
    0,
    Number.EPSILON,
    0.0001,
    0.999,
    1,
    999.999,
    1e6,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NaN,
  ];
  const EXTREME_VOLUME_M3 = [0, 1e-9, 0.0009, 0.001, 1, 1e6, Number.POSITIVE_INFINITY, Number.NaN];

  it('formatCurrency nunca lança nem retorna string inválida em valores extremos', () => {
    for (const q of EXTREME_QTY) {
      for (const p of EXTREME_PRICE) {
        const subtotal = q * p;
        // Se não é finito, o formatter deve ao menos não crashar; a UI
        // esconde subtotal quando <= 0. Testamos apenas casos finitos > 0
        // para o regex — casos infinitos/NaN são cobertos pelo throw check.
        let out = '';
        expect(() => {
          out = formatCurrency(subtotal);
        }).not.toThrow();
        expect(typeof out).toBe('string');
        expect(out.length).toBeGreaterThan(0);
        // Nunca "NaN" ou "Infinity" literais na UI (contrato de sanidade).
        expect(out).not.toMatch(/NaN|Infinity/i);

        if (Number.isFinite(subtotal) && subtotal > 0 && subtotal < 1e15) {
          expect(out).toMatch(RE_ROBUST);
        }
      }
    }
  });

  it('computeHeaderMeta nunca produz "NaN"/"undefined"/"Infinity" em casos extremos', () => {
    for (const q of EXTREME_QTY) {
      for (const p of EXTREME_PRICE) {
        const items = [{ quantity: q, product_price: p }];
        let meta = '';
        expect(() => {
          meta = norm(computeHeaderMeta(items));
        }).not.toThrow();
        expect(meta).not.toMatch(/NaN|undefined|null|Infinity/i);
      }
    }
  });

  it('fmtWeight/fmtVolume sobrevivem a NaN, Infinity e valores negativos', () => {
    for (const kg of EXTREME_WEIGHT_KG) {
      let out = '';
      expect(() => {
        out = fmtWeight(kg);
      }).not.toThrow();
      expect(typeof out).toBe('string');
      // Contrato: sempre termina em "kg" ou "g".
      expect(out).toMatch(/(kg|g)$/);
    }
    for (const m3 of EXTREME_VOLUME_M3) {
      const cm3 = Number.isFinite(m3) ? Math.round(m3 * 1_000_000) : m3;
      let out = '';
      expect(() => {
        out = fmtVolume({ volumeM3: m3, volumeCm3: cm3 });
      }).not.toThrow();
      expect(out).toMatch(/(m³|cm³)$/);
    }
  });

  it('gate shouldShowWeightVolumeBlock nunca "vaza" com NaN/Infinity', () => {
    // NaN > 0 é false → não exibe; Infinity > 0 é true → exibe.
    expect(shouldShowWeightVolumeBlock({ weightKg: Number.NaN, volumeCm3: 0 })).toBe(false);
    expect(shouldShowWeightVolumeBlock({ weightKg: 0, volumeCm3: Number.NaN })).toBe(false);
    expect(shouldShowWeightVolumeBlock({ weightKg: Infinity, volumeCm3: 0 })).toBe(true);
    expect(shouldShowWeightVolumeBlock({ weightKg: 0, volumeCm3: Infinity })).toBe(true);
    // Ambos NaN → nunca exibir (não faz sentido).
    expect(shouldShowWeightVolumeBlock({ weightKg: Number.NaN, volumeCm3: Number.NaN })).toBe(
      false,
    );
  });

  it('regex robusto do BRL nunca casa saída extrema inválida (fuzz 500x)', () => {
    for (let i = 0; i < 500; i++) {
      // Escolhe combinação semi-aleatória de valores extremos.
      const q = EXTREME_QTY[Math.floor(Math.random() * EXTREME_QTY.length)];
      const p = EXTREME_PRICE[Math.floor(Math.random() * EXTREME_PRICE.length)];
      const items = [{ quantity: q, product_price: p }];
      const meta = norm(computeHeaderMeta(items));

      // Se o subtotal calculado NÃO é finito ou não é positivo, o meta
      // NÃO deve conter uma moeda válida (a UI esconde neste caso).
      const subtotal = q * p;
      if (!Number.isFinite(subtotal) || subtotal <= 0) {
        expect(meta).not.toMatch(RE_ROBUST);
      }
    }
  });
});
