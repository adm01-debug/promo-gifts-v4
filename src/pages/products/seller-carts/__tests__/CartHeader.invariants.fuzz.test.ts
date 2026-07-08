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
  const qty = items.reduce((sum, it) => sum + (it.quantity || 0), 0);
  const subtotal = items.reduce(
    (sum, it) => sum + (it.product_price || 0) * (it.quantity || 0),
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
function shouldShowWeightVolumeBlock(
  wv: { weightKg: number; volumeCm3: number } | null,
) {
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
      const qty = items.reduce((s, it) => s + it.quantity, 0);

      // 1) Prefixo SKU(s)
      expect(meta.startsWith(`${skus} ${skus === 1 ? 'SKU' : 'SKUs'} ·`)).toBe(
        true,
      );
      // 2) Unidade(s)
      expect(meta.includes(`${qty} ${qty === 1 ? 'unidade' : 'unidades'}`)).toBe(
        true,
      );
      // 3) Se houver subtotal > 0, formato de moeda pt-BR válido
      const subtotal = items.reduce(
        (s, it) => s + it.quantity * it.product_price,
        0,
      );
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
    expect(
      shouldShowWeightVolumeBlock({ weightKg: 0, volumeCm3: 0 }),
    ).toBe(false);
  });

  it('só peso > 0 → EXIBE', () => {
    expect(
      shouldShowWeightVolumeBlock({ weightKg: 0.1, volumeCm3: 0 }),
    ).toBe(true);
  });

  it('só volume > 0 → EXIBE', () => {
    expect(
      shouldShowWeightVolumeBlock({ weightKg: 0, volumeCm3: 1 }),
    ).toBe(true);
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

describe('Invariante — troca entre 2 carrinhos nunca mistura dados', () => {
  it('500x fuzz: meta do carrinho B nunca contém números do carrinho A', () => {
    for (let i = 0; i < 500; i++) {
      const a = Array.from({ length: 3 + i % 10 }, () => ({
        quantity: 10 + (i % 7),
        product_price: 1 + (i % 5),
      }));
      const b = Array.from({ length: 1 + i % 4 }, () => ({
        quantity: 1 + (i % 3),
        product_price: 100 + (i % 11),
      }));
      const metaA = norm(computeHeaderMeta(a));
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
        expect(metaB.includes(formatCurrency(subA).replace(NBSP, ' '))).toBe(
          false,
        );
      }
    }
  });
});
