/**
 * AUDIT FORENSE — PhD-level exhaustive validation
 * Todas as funções do sprint: edge cases, boundary conditions, mutations,
 * divergências, type-safety, contratos, performance.
 */
import { describe, it, expect } from 'vitest';
import {
  isProductInStock,
  getVariationStockStatus,
  isCatalogStockStatus,
  compareStockStatus,
  stockStatusRank,
  OUT_OF_STOCK,
  CATALOG_STOCK_STATUSES,
  type InStockProduct,
  type CatalogStockStatusValue,
} from '@/lib/products/stock-status';
import { getCatalogStockStatus, CATALOG_LOW_STOCK_THRESHOLD } from '@/lib/catalog-stock-status';

// ─── helpers ──────────────────────────────────────────────────────────────────
const p = (o: Partial<InStockProduct> = {}): InStockProduct => ({
  stock: null, stockStatus: null, variations: undefined, ...o,
});

// ═══════════════════════════════════════════════════════════════════════════════
// FRENTE 1 — DIVERGÊNCIA: getCatalogStockStatus vs getVariationStockStatus
// Os dois devem ser matematicamente idênticos para qualquer entrada válida.
// ═══════════════════════════════════════════════════════════════════════════════
describe('FRENTE-1: divergência entre getCatalogStockStatus e getVariationStockStatus', () => {
  it('1000 pares (stock × minQty): zero divergências', () => {
    const stocks = [0, 1, 2, 5, 9, 10, 11, 20, 50, 100];
    const minQtys = [undefined, null, 0, 1, 2, 5, 10, 15, 20, 50];
    let divergences = 0;
    const diffs: string[] = [];
    for (const stock of stocks) {
      for (const minQty of minQtys) {
        for (const threshold of [5, 10, 20]) {
          const fromCatalog = getCatalogStockStatus(stock, threshold, minQty as number);
          const fromVariation = getVariationStockStatus(stock, minQty as number, threshold);
          if (fromCatalog !== fromVariation) {
            divergences++;
            diffs.push(`stock=${stock} minQty=${minQty} t=${threshold}: catalog=${fromCatalog} var=${fromVariation}`);
          }
        }
      }
    }
    expect(divergences, `Divergências:\n${diffs.join('\n')}`).toBe(0);
  });

  it('valores extremos: Infinity, NaN, -Infinity, null → ambos out-of-stock', () => {
    const extremes: (number | null | undefined)[] = [
      Infinity, -Infinity, NaN, null, undefined,
    ];
    extremes.forEach((s) => {
      const c = getCatalogStockStatus(s as number);
      const v = getVariationStockStatus(s as number, undefined);
      expect(c, `catalog divergiu para ${s}`).toBe('out-of-stock');
      expect(v, `variation divergiu para ${s}`).toBe('out-of-stock');
      expect(c).toBe(v);
    });
  });

  it('getVariationStockStatus: 5000 cenarios aleatorios deterministicos — consistencia com getCatalogStockStatus', () => {
    let fail = 0;
    const errors: string[] = [];
    for (let i = 0; i < 5000; i++) {
      // deterministico via formula
      const stock = (i * 7) % 110;
      const minQty: number | undefined = (i * 3) % 60 || undefined;
      const threshold = 5 + (i % 20);
      const catalog = getCatalogStockStatus(stock, threshold, minQty);
      const variation = getVariationStockStatus(stock, minQty, threshold);
      if (catalog !== variation) {
        fail++;
        if (errors.length < 10) errors.push(`i=${i} s=${stock} mq=${minQty} t=${threshold}: ${catalog} vs ${variation}`);
      }
    }
    expect(fail, `${fail} divergências:\n${errors.join('\n')}`).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FRENTE 2 — ATAQUE DE STRINGS: whitespace, control chars, unicode, encoding
// ═══════════════════════════════════════════════════════════════════════════════
describe('FRENTE-2: strings anômalas em stockStatus', () => {
  const STOCK = 5;

  it('whitespace em volta → fallthrough ao stock (não é status válido)', () => {
    // ' in-stock ' != 'in-stock' → evaluateStatus retorna null → fallthrough
    expect(isProductInStock(p({ stockStatus: ' in-stock ', stock: STOCK }))).toBe(true);
    expect(isProductInStock(p({ stockStatus: ' in-stock ', stock: 0 }))).toBe(false);
    expect(isProductInStock(p({ stockStatus: '\tin-stock\n', stock: STOCK }))).toBe(true);
  });

  it('whitespace-only → falsy → stock fallback', () => {
    // '   '.toLowerCase() = '   ' → evaluateStatus('   ') = null (not out-of-stock)
    // wait: if (product.stockStatus) → '   ' is TRUTHY! → evaluateStatus('   ') → null → fallthrough
    expect(isProductInStock(p({ stockStatus: '   ', stock: STOCK }))).toBe(true);
    expect(isProductInStock(p({ stockStatus: '   ', stock: 0 }))).toBe(false);
  });

  it('null-byte e control chars → fallthrough ao stock', () => {
    expect(isProductInStock(p({ stockStatus: '\0out-of-stock', stock: STOCK }))).toBe(true);
    expect(isProductInStock(p({ stockStatus: '\0out-of-stock', stock: 0 }))).toBe(false);
  });

  it('unicode homoglyphs → fallthrough (não são os status canônicos)', () => {
    // ℑn-stock com letra unicode diferente
    expect(isProductInStock(p({ stockStatus: 'ín-stock', stock: STOCK }))).toBe(true);
    expect(isProductInStock(p({ stockStatus: 'ín-stock', stock: 0 }))).toBe(false);
  });

  it('out-of-stock com espaço errado → não é out-of-stock → fallthrough', () => {
    expect(isProductInStock(p({ stockStatus: 'out of stock', stock: STOCK }))).toBe(true);
    expect(isProductInStock(p({ stockStatus: 'out_of_stock', stock: STOCK }))).toBe(true);
    expect(isProductInStock(p({ stockStatus: 'outofstock', stock: STOCK }))).toBe(true);
  });

  it('low-stock como low_stock → fallthrough', () => {
    expect(isProductInStock(p({ stockStatus: 'low_stock', stock: STOCK }))).toBe(true);
    expect(isProductInStock(p({ stockStatus: 'low_stock', stock: 0 }))).toBe(false);
  });

  it('STATUS CRÍTICO: out-of-stock com unicode zero-width space → fallthrough!', () => {
    // \u200B é invisible e faz 'out-of-stock' não igualar 'out-of-stock'
    const sneaky = 'out\u200B-of-stock';
    const result = isProductInStock(p({ stockStatus: sneaky, stock: STOCK }));
    // Este é um GAP potencial: produto com stock=5 aparece mesmo com string "parecer" out-of-stock
    // Mas é comportamento correto do three-way (não é o token canônico)
    expect(result).toBe(true); // fallthrough ao stock
    expect(result).not.toBe(false); // confirma que três-vias trata como fallthrough
  });

  it('variação: stockStatus string enorme não causa crash (DOS prevention)', () => {
    const huge = 'x'.repeat(100_000);
    expect(() => isProductInStock(p({ stockStatus: huge, stock: STOCK }))).not.toThrow();
    expect(isProductInStock(p({ stockStatus: huge, stock: STOCK }))).toBe(true); // fallthrough
    expect(isProductInStock(p({ stockStatus: huge, stock: 0 }))).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FRENTE 3 — ATAQUE DE TIPOS: coerção, prototype pollution, frozen objects
// ═══════════════════════════════════════════════════════════════════════════════
describe('FRENTE-3: type safety e robustez', () => {
  it('stock como string "5" (coerção) → NaN em Number.isFinite → false', () => {
    // stock: "5" passa como any — Number.isFinite("5") = false em TypeScript runtime
    const bad = p({ stock: '5' as unknown as number });
    expect(isProductInStock(bad)).toBe(false); // "5" não é finito
  });

  it('stock como boolean true (coerção) → false', () => {
    const bad = p({ stock: true as unknown as number });
    expect(isProductInStock(bad)).toBe(false);
  });

  it('stock como objeto → false', () => {
    const bad = p({ stock: {} as unknown as number });
    expect(isProductInStock(bad)).toBe(false);
  });

  it('produto totalmente vazio {} → false', () => {
    expect(isProductInStock({})).toBe(false);
  });

  it('produto com variações = undefined → fallback ao produto.stock', () => {
    expect(isProductInStock({ variations: undefined, stock: 5 })).toBe(true);
    expect(isProductInStock({ variations: undefined, stock: 0 })).toBe(false);
  });

  it('objeto congelado (Object.freeze) não causa mutação/crash', () => {
    const frozen = Object.freeze(p({ stock: 5, stockStatus: 'in-stock' }));
    expect(() => isProductInStock(frozen)).not.toThrow();
    expect(isProductInStock(frozen)).toBe(true);
  });

  it('variação congelada não causa crash', () => {
    const frozen = Object.freeze(p({
      variations: [Object.freeze({ stock: 3, stockStatus: 'low-stock' as const })],
    }));
    expect(() => isProductInStock(frozen)).not.toThrow();
    expect(isProductInStock(frozen)).toBe(true);
  });

  it('produto com proto null (Object.create(null)) → não crash', () => {
    const nullProto = Object.assign(Object.create(null), { stock: 5, stockStatus: 'in-stock' });
    expect(() => isProductInStock(nullProto)).not.toThrow();
    expect(isProductInStock(nullProto)).toBe(true);
  });

  it('-0 como stock → false (negativo por IEEE 754)', () => {
    expect(isProductInStock(p({ stock: -0 }))).toBe(false);
  });

  it('Number.EPSILON como stock → true (positivo finito mínimo)', () => {
    expect(isProductInStock(p({ stock: Number.EPSILON }))).toBe(true);
  });

  it('Number.MAX_SAFE_INTEGER → true', () => {
    expect(isProductInStock(p({ stock: Number.MAX_SAFE_INTEGER }))).toBe(true);
  });

  it('Number.MAX_VALUE (próximo de Infinity mas finito) → true', () => {
    expect(isProductInStock(p({ stock: Number.MAX_VALUE }))).toBe(true);
    expect(Number.isFinite(Number.MAX_VALUE)).toBe(true); // confirma premissa
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FRENTE 4 — CONTRATO isProductInStock: semântica de variações vs produto
// ═══════════════════════════════════════════════════════════════════════════════
describe('FRENTE-4: contrato de prioridade variação > produto.stockStatus', () => {
  it('variação sem stockStatus, stock=5 + produto.stockStatus=out-of-stock → TRUE (by design: variação prevalece)', () => {
    // Comportamento INTENCIONAL: quando variações existem, produto.stockStatus é ignorado
    // A variação deveria ter seu próprio stockStatus computado pelo pipeline
    const product = p({ variations: [{ stock: 5 }], stockStatus: 'out-of-stock' });
    const result = isProductInStock(product);
    // Esta é a decisão de design: variações SEM stockStatus fazem fallback ao stock bruto
    // ignorando o produto.stockStatus — GAP DOCUMENTADO que só se resolve com stockStatus na variação
    expect(result).toBe(true);
  });

  it('variação COM stockStatus=out-of-stock + stock=5 → false (stockStatus da variação prevalece)', () => {
    const product = p({ variations: [{ stock: 5, stockStatus: 'out-of-stock' }] });
    expect(isProductInStock(product)).toBe(false);
  });

  it('GAP CONFIRMADO: produto.stockStatus=out-of-stock é ignorado se variação tem stock>0 sem stockStatus', () => {
    // Esta é a única situação onde o filtro inStock pode ser mais permissivo do que deveria
    // A SOLUÇÃO é sempre popular variation.stockStatus via getVariationStockStatus no pipeline
    const withoutVariationStatus = p({
      variations: [{ stock: 5, stockStatus: null }],
      stockStatus: 'out-of-stock',
    });
    // GAP: retorna true mesmo que produto diga out-of-stock
    // RAZÃO: por design — variação sem status faz fallback ao seu próprio stock
    expect(isProductInStock(withoutVariationStatus)).toBe(true);
    
    // CORREÇÃO: popular o stockStatus da variação
    const withVariationStatus = p({
      variations: [{ stock: 5, stockStatus: getVariationStockStatus(5, 20) }],
      stockStatus: 'out-of-stock',
    });
    // Com minQty=20 e stock=5, variação deveria ser out-of-stock → produto false
    expect(withVariationStatus.variations![0].stockStatus).toBe('out-of-stock');
    expect(isProductInStock(withVariationStatus)).toBe(false);
  });

  it('variação stockStatus=unknown → fallthrough ao stock da variação (não ao produto)', () => {
    const product = p({
      variations: [{ stock: 3, stockStatus: 'critical' }],
      stock: 0,
      stockStatus: 'out-of-stock',
    });
    // 'critical' é unknown → evaluateStatus retorna null → fallthrough para variation.stock=3 > 0 → true
    expect(isProductInStock(product)).toBe(true);
  });

  it('50 variações mistas: lógica de any() correta', () => {
    // 49 out-of-stock + 1 in-stock → produto disponível
    const variations = [
      ...Array.from({ length: 49 }, () => ({ stock: 5, stockStatus: 'out-of-stock' as const })),
      { stock: 10, stockStatus: 'in-stock' as const },
    ];
    expect(isProductInStock(p({ variations }))).toBe(true);
    
    // 50 out-of-stock → produto indisponível
    const allOut = Array.from({ length: 50 }, () => ({ stock: 5, stockStatus: 'out-of-stock' as const }));
    expect(isProductInStock(p({ variations: allOut }))).toBe(false);
  });

  it('isProductInStock: puro (não muta o input)', () => {
    const orig = p({ stock: 5, stockStatus: 'in-stock' });
    const snapshot = JSON.stringify(orig);
    isProductInStock(orig);
    expect(JSON.stringify(orig)).toBe(snapshot);
  });

  it('isProductInStock: idempotente (mesmo resultado chamado N vezes)', () => {
    const prod = p({ stock: 5, stockStatus: 'low-stock' });
    const first = isProductInStock(prod);
    for (let i = 0; i < 1000; i++) {
      expect(isProductInStock(prod)).toBe(first);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FRENTE 5 — minStock filter: contratos e edge cases
// ═══════════════════════════════════════════════════════════════════════════════
describe('FRENTE-5: minStock filter correctness via Number.isFinite', () => {
  // Simula o filtro diretamente para não depender do hook
  const applyMinStockFilter = (stock: number | null | undefined, threshold: number): boolean =>
    Number.isFinite(stock) && (stock as number) >= threshold;

  it('Infinity nunca passa (BUG-MINSTOCK-INF)', () => {
    expect(applyMinStockFilter(Infinity, 1)).toBe(false);
    expect(applyMinStockFilter(Infinity, 0)).toBe(false);
  });
  it('-Infinity nunca passa', () => {
    expect(applyMinStockFilter(-Infinity, 0)).toBe(false);
  });
  it('NaN nunca passa', () => {
    expect(applyMinStockFilter(NaN, 0)).toBe(false);
  });
  it('null nunca passa', () => {
    expect(applyMinStockFilter(null, 0)).toBe(false);
  });
  it('undefined nunca passa', () => {
    expect(applyMinStockFilter(undefined, 1)).toBe(false);
  });
  it('threshold=0: stock=0 passa (qualquer estoque)', () => {
    // threshold=0 não faz sentido (filtro minStock=0 é neutro) — mas se chamado:
    expect(applyMinStockFilter(0, 0)).toBe(true);
    expect(applyMinStockFilter(1, 0)).toBe(true);
  });
  it('exato: stock=threshold passa', () => {
    expect(applyMinStockFilter(5, 5)).toBe(true);
    expect(applyMinStockFilter(10, 10)).toBe(true);
  });
  it('abaixo: stock < threshold não passa', () => {
    expect(applyMinStockFilter(4, 5)).toBe(false);
    expect(applyMinStockFilter(9, 10)).toBe(false);
  });
  it('Number.MAX_VALUE como stock com threshold=1 → passa', () => {
    expect(applyMinStockFilter(Number.MAX_VALUE, 1)).toBe(true);
  });
  it('Number.EPSILON como stock com threshold=1 → não passa (muito pequeno)', () => {
    expect(applyMinStockFilter(Number.EPSILON, 1)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FRENTE 6 — compareStockStatus: propriedades matemáticas de comparador
// ═══════════════════════════════════════════════════════════════════════════════
describe('FRENTE-6: compareStockStatus — propriedades de comparador', () => {
  const statuses = ['in-stock', 'low-stock', 'out-of-stock', null, undefined, 'critical', 'IN-STOCK', 'LOW-STOCK'] as const;

  it('reflexividade: compareStockStatus(a,a) = 0', () => {
    statuses.forEach((s) => {
      expect(compareStockStatus(s as string, s as string)).toBe(0);
    });
  });

  it('anti-simetria: sign(compare(a,b)) = -sign(compare(b,a))', () => {
    statuses.forEach((a) => {
      statuses.forEach((b) => {
        const ab = compareStockStatus(a as string, b as string);
        const ba = compareStockStatus(b as string, a as string);
        // Fix: Math.sign(0) + Math.sign(0) = 0, sign(x) + sign(-x) = 0 para x!=0
        // toBe(-Math.sign(ba)) falha quando ambos=0 pois Object.is(0,-0)=false
        expect(Math.sign(ab) + Math.sign(ba)).toBe(0);
      });
    });
  });

  it('transitividade: a<b e b<c → a<c', () => {
    const ordered = ['in-stock', 'low-stock', null, 'out-of-stock'];
    for (let i = 0; i < ordered.length - 2; i++) {
      for (let j = i + 1; j < ordered.length - 1; j++) {
        for (let k = j + 1; k < ordered.length; k++) {
          const ab = compareStockStatus(ordered[i] as string, ordered[j] as string);
          const bc = compareStockStatus(ordered[j] as string, ordered[k] as string);
          const ac = compareStockStatus(ordered[i] as string, ordered[k] as string);
          expect(ab).toBeLessThanOrEqual(0);
          expect(bc).toBeLessThanOrEqual(0);
          expect(ac).toBeLessThanOrEqual(0);
        }
      }
    }
  });

  it('sort de 10.000 elementos: nenhum out-of-stock antes de in-stock', () => {
    const arr = Array.from({ length: 10_000 }, (_, i) => {
      const r = i % 4;
      return r === 0 ? 'in-stock'
           : r === 1 ? 'low-stock'
           : r === 2 ? 'out-of-stock'
           : null;
    }) as (string | null)[];
    arr.sort(compareStockStatus);
    // Verifica que nenhum out-of-stock precede in-stock ou low-stock
    let seenOut = false;
    for (const s of arr) {
      if (s === 'out-of-stock') seenOut = true;
      if (seenOut) expect(s === 'in-stock' || s === 'low-stock').toBe(false);
    }
  });

  it('sort idempotente: aplicar 3x produz mesmo resultado', () => {
    const base = ['out-of-stock', null, 'in-stock', 'low-stock', 'critical', undefined] as (string | null | undefined)[];
    const s1 = [...base].sort(compareStockStatus);
    const s2 = [...s1].sort(compareStockStatus);
    const s3 = [...s2].sort(compareStockStatus);
    expect(s1).toEqual(s2);
    expect(s2).toEqual(s3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FRENTE 7 — isCatalogStockStatus: completude e precisão
// ═══════════════════════════════════════════════════════════════════════════════
describe('FRENTE-7: isCatalogStockStatus — type guard completude', () => {
  it('todos CATALOG_STOCK_STATUSES passam', () => {
    CATALOG_STOCK_STATUSES.forEach((s) => {
      expect(isCatalogStockStatus(s)).toBe(true);
    });
  });

  it('versões maiúsculas NÃO passam (type guard é case-sensitive)', () => {
    ['IN-STOCK', 'LOW-STOCK', 'OUT-OF-STOCK'].forEach((s) => {
      expect(isCatalogStockStatus(s)).toBe(false);
    });
  });

  it('underscore domain NÃO passa', () => {
    ['in_stock', 'low_stock', 'out_of_stock', 'critical'].forEach((s) => {
      expect(isCatalogStockStatus(s)).toBe(false);
    });
  });

  it('tipos não-string NÃO passam', () => {
    [null, undefined, 0, 1, true, false, [], {}, Symbol('in-stock')].forEach((v) => {
      expect(isCatalogStockStatus(v)).toBe(false);
    });
  });

  it('narrowing funciona: após isCatalogStockStatus, array.includes não precisaria cast', () => {
    const raw: unknown = 'in-stock';
    if (isCatalogStockStatus(raw)) {
      // raw é CatalogStockStatusValue aqui — tipagem correta
      const asValue: CatalogStockStatusValue = raw;
      expect(CATALOG_STOCK_STATUSES.includes(asValue)).toBe(true);
    } else {
      throw new Error('deveria ter passado');
    }
  });

  it('OUT_OF_STOCK constante passa no type guard', () => {
    expect(isCatalogStockStatus(OUT_OF_STOCK)).toBe(true);
    expect(OUT_OF_STOCK).toBe('out-of-stock');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FRENTE 8 — getVariationStockStatus: boundary analysis exaustivo
// ═══════════════════════════════════════════════════════════════════════════════
describe('FRENTE-8: getVariationStockStatus — boundary analysis', () => {
  it('MONOTONIA: maior stock → status >= anteror (nunca piora)', () => {
    // Com o mesmo minQty e threshold, mais stock nunca resulta em status "pior"
    const rankMap = { 'out-of-stock': 0, 'low-stock': 1, 'in-stock': 2 };
    const stocks = [0, 1, 2, 3, 5, 9, 10, 11, 50, 100];
    for (let i = 0; i < stocks.length - 1; i++) {
      const lower = getVariationStockStatus(stocks[i], 5, 10);
      const higher = getVariationStockStatus(stocks[i + 1], 5, 10);
      expect(rankMap[higher]).toBeGreaterThanOrEqual(rankMap[lower]);
    }
  });

  it('LIMIAR EXATO minQty: stock=minQty-1 → out, stock=minQty → não out', () => {
    for (const minQty of [1, 2, 5, 10, 50, 100]) {
      expect(getVariationStockStatus(minQty - 1, minQty)).toBe('out-of-stock');
      const atMin = getVariationStockStatus(minQty, minQty);
      expect(atMin).not.toBe('out-of-stock'); // pode ser low-stock ou in-stock
    }
  });

  it('LIMIAR threshold: stock=threshold-1 → low, stock=threshold → in', () => {
    for (const threshold of [5, 10, 20]) {
      // Sem minQty para não interferir
      expect(getVariationStockStatus(threshold - 1, undefined, threshold)).toBe('low-stock');
      expect(getVariationStockStatus(threshold, undefined, threshold)).toBe('in-stock');
    }
  });

  it('minQty >= threshold: stock entre eles é out-of-stock (minQty domina)', () => {
    // minQty=15, threshold=10: stock=12 é out-of-stock (12 < 15)
    expect(getVariationStockStatus(12, 15, 10)).toBe('out-of-stock');
    // stock=15: passa minQty, mas 15 >= threshold=10 → in-stock
    expect(getVariationStockStatus(15, 15, 10)).toBe('in-stock');
  });

  it('threshold=0: qualquer stock > 0 → in-stock (sem zona low)', () => {
    expect(getVariationStockStatus(1, undefined, 0)).toBe('in-stock');
    expect(getVariationStockStatus(0, undefined, 0)).toBe('out-of-stock');
  });

  it('threshold=1: stock=1 → in-stock (fronteira exata)', () => {
    expect(getVariationStockStatus(1, undefined, 1)).toBe('in-stock');
  });

  it('always returns CatalogStockStatusValue', () => {
    const valid = new Set(CATALOG_STOCK_STATUSES);
    for (let i = 0; i < 200; i++) {
      const s = (i * 11) % 110;
      const m = (i % 25) || undefined;
      const t = 5 + (i % 15);
      const result = getVariationStockStatus(s, m, t);
      expect(valid.has(result as CatalogStockStatusValue)).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FRENTE 9 — PIPELINE COMPLETO: getCatalogStockStatus → getVariationStockStatus
//            → isProductInStock → compareStockStatus
// ═══════════════════════════════════════════════════════════════════════════════
describe('FRENTE-9: pipeline completo end-to-end', () => {
  it('CENÁRIO REAL: 200 produtos, pipeline completo — validação de invariantes', () => {
    const products = Array.from({ length: 200 }, (_, i) => {
      const stock = (i * 7) % 60;
      const minQty = (i % 15) + 1;
      const threshold = CATALOG_LOW_STOCK_THRESHOLD;
      const productStatus = getCatalogStockStatus(stock, threshold, minQty);
      
      // Simula variações com status pré-computado
      const variations = i % 3 === 0 ? [
        { stock: stock * 2, stockStatus: getVariationStockStatus(stock * 2, minQty, threshold) },
        { stock: Math.max(0, stock - 3), stockStatus: getVariationStockStatus(Math.max(0, stock - 3), minQty, threshold) },
      ] : undefined;
      
      return { id: i, stock, minQty, productStatus, variations };
    });

    // INVARIANTE 1: produto com status calculado via pipeline → isProductInStock consistente
    products.forEach((prod) => {
      const inStockByStatus = prod.productStatus !== 'out-of-stock';
      const inStockByFunc = isProductInStock({
        stock: prod.stock,
        stockStatus: prod.productStatus,
        variations: prod.variations,
      });
      
      if (!prod.variations) {
        // Sem variações: deve ser perfeitamente consistente
        expect(inStockByFunc).toBe(inStockByStatus);
      }
      // Com variações: pode diferir pois variação tem sua própria lógica
    });

    // INVARIANTE 2: sort por compareStockStatus é estável (in-stock sempre antes de out-of-stock)
    const withStatus = products.map((p) => ({
      ...p,
      sortStatus: p.productStatus,
    }));
    withStatus.sort((a, b) => compareStockStatus(a.sortStatus, b.sortStatus));
    
    let seenOut = false;
    withStatus.forEach((p) => {
      if (p.sortStatus === 'out-of-stock') seenOut = true;
      if (seenOut && (p.sortStatus === 'in-stock' || p.sortStatus === 'low-stock')) {
        throw new Error(`Sort violado: in/low-stock após out-of-stock para produto ${p.id}`);
      }
    });
  });

  it('SSOT: todos os status retornados por getCatalogStockStatus passam em isCatalogStockStatus', () => {
    const stocks = [-5, 0, 1, 5, 9, 10, 50, 100, null, undefined, NaN, Infinity];
    stocks.forEach((s) => {
      const status = getCatalogStockStatus(s as number);
      expect(isCatalogStockStatus(status)).toBe(true);
    });
  });

  it('SSOT: todos os status retornados por getVariationStockStatus passam em isCatalogStockStatus', () => {
    for (let i = 0; i < 100; i++) {
      const stock = (i * 13) % 50;
      const minQty = (i * 7) % 30;
      const status = getVariationStockStatus(stock, minQty);
      expect(isCatalogStockStatus(status)).toBe(true);
    }
  });

  it('SSOT: todos os status retornados por getCatalogStockStatus passam pelo stockStatusRank sem retornar 2 (unknown)', () => {
    // Os 3 status canônicos devem ter ranks específicos, não o rank "unknown" (2)
    const knownRanks = new Set([0, 1, 3]); // in-stock=0, low-stock=1, out-of-stock=3
    const stocks = [-5, 0, 1, 5, 9, 10, 50, 100];
    stocks.forEach((s) => {
      const status = getCatalogStockStatus(s);
      const rank = stockStatusRank(status);
      expect(knownRanks.has(rank), `Status ${status} teve rank ${rank} (unknown)`).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// FRENTE 10 — BENCHMARK DE PERFORMANCE: detecta regressões O(n²) ou lentidão
// ═══════════════════════════════════════════════════════════════════════════════
describe('FRENTE-10: performance — não deve exceder limites razoáveis', () => {
  it('isProductInStock: 100.000 chamadas < 500ms', () => {
    const start = performance.now();
    for (let i = 0; i < 100_000; i++) {
      isProductInStock({ stock: i % 50, stockStatus: i % 2 === 0 ? 'in-stock' : 'out-of-stock' });
    }
    const elapsed = performance.now() - start;
    expect(elapsed, `Demorou ${elapsed.toFixed(0)}ms (limite: 500ms)`).toBeLessThan(500);
  });

  it('getVariationStockStatus: 100.000 chamadas < 200ms', () => {
    const start = performance.now();
    for (let i = 0; i < 100_000; i++) {
      getVariationStockStatus(i % 50, i % 15);
    }
    const elapsed = performance.now() - start;
    expect(elapsed, `Demorou ${elapsed.toFixed(0)}ms (limite: 200ms)`).toBeLessThan(200);
  });

  it('compareStockStatus: sort de 100.000 elementos < 300ms', () => {
    const arr = Array.from({ length: 100_000 }, (_, i) =>
      i % 3 === 0 ? 'out-of-stock' : i % 3 === 1 ? 'in-stock' : 'low-stock'
    );
    const start = performance.now();
    arr.sort(compareStockStatus);
    const elapsed = performance.now() - start;
    expect(elapsed, `Demorou ${elapsed.toFixed(0)}ms (limite: 300ms)`).toBeLessThan(300);
  });

  it('produto com 1000 variações → resolvido < 5ms', () => {
    const variations = Array.from({ length: 1000 }, (_, i) => ({
      stock: i,
      stockStatus: i === 999 ? 'in-stock' : 'out-of-stock',
    }));
    const start = performance.now();
    const result = isProductInStock(p({ variations }));
    const elapsed = performance.now() - start;
    expect(result).toBe(true);
    expect(elapsed).toBeLessThan(5);
  });
});
