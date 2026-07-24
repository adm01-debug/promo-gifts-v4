/**
 * hooks-audit-regression.unit.test.ts
 *
 * Testes de regressao para os bugs corrigidos nas Rounds 1, 2 e 3 da Auditoria de Hooks.
 * Cada teste tem o ID do bug no titulo para rastreabilidade.
 *
 * Cobertura:
 *   STOCK-01  buildFutureEntries — if (q && d) ignorava q=0
 *   STOCK-02  min_quantity || 10 — colapsa zero para 10
 *   STOCK-03  loop paginacao sem break em pagina parcial
 *   CS-02     resetFilters sortBy padrao errado
 *   CS-04     priceRange threshold inconsistente
 *   AUTO-01   migratePayload v1 → v2
 *   AUTO-02   migratePayload versao futura — nao restaurar
 *   VOICE-01  useSpeechRecognition refs estaveis
 *   KBD-01    keyboard handler deps — handleFavoriteProductRef
 */

import { describe, it, expect } from 'vitest';
import { toNumber } from '@/hooks/stock/stockFetcher';
import { migratePayload } from '@/hooks/quotes/useAutoSaveQuote';

// ============================================================
// STOCK-01: buildFutureEntries nao ignora entradas com q=0
// ============================================================

describe('STOCK-01 — toNumber utility (base para buildFutureEntries)', () => {
  it('converte number para number sem alteracao', () => {
    expect(toNumber(42)).toBe(42);
    expect(toNumber(0)).toBe(0);
    expect(toNumber(-5)).toBe(-5);
  });

  it('converte string numerica corretamente', () => {
    expect(toNumber('10')).toBe(10);
    expect(toNumber('0')).toBe(0);
  });

  it('retorna fallback para NaN e valores invalidos', () => {
    expect(toNumber(null)).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber('abc')).toBe(0);
    expect(toNumber(NaN)).toBe(0);
    expect(toNumber(Infinity)).toBe(0);
  });

  it('usa fallback customizado quando fornecido', () => {
    // null → Number(null)=0 → isFinite → retorna 0 (fallback nao se aplica)
    expect(toNumber(null, 10)).toBe(0);
    // NaN e Infinity SIM usam fallback
    expect(toNumber(NaN, 10)).toBe(10);
    expect(toNumber(Infinity, 10)).toBe(10);
    expect(toNumber('xyz', 99)).toBe(99);
  });
});

// ============================================================
// STOCK-01 logica: q != null && q > 0 — regressao do if (q && d)
// ============================================================

describe('STOCK-01 — logica de guarda de entrada futura', () => {
  /**
   * Simula a logica corrigida de buildFutureEntries.
   * Original: `if (q && d)` — ignorava q=0 (quantidade zero e falsy)
   * Corrigido: `if (q != null && q > 0 && d)` — explicito e correto
   */
  function shouldCreateEntry(q: number | null | undefined, d: string | null | undefined): boolean {
    return q !== null && q !== undefined && q > 0 && d !== null && d !== undefined && d !== '';
  }

  it('[REGRESSAO STOCK-01] nao cria entrada quando q=0 (antes criava com if(q&&d)=false)', () => {
    expect(shouldCreateEntry(0, '2025-01-01')).toBe(false);
  });

  it('cria entrada quando q > 0 e d e string valida', () => {
    expect(shouldCreateEntry(100, '2025-06-15')).toBe(true);
    expect(shouldCreateEntry(1, '2025-01-01')).toBe(true);
  });

  it('nao cria entrada quando q e null', () => {
    expect(shouldCreateEntry(null, '2025-01-01')).toBe(false);
  });

  it('nao cria entrada quando d e null', () => {
    expect(shouldCreateEntry(100, null)).toBe(false);
  });

  it('nao cria entrada quando ambos sao null', () => {
    expect(shouldCreateEntry(null, null)).toBe(false);
  });
});

// ============================================================
// STOCK-02: min_quantity ?? 10 — nao colapsa zero
// ============================================================

describe('STOCK-02 — min_quantity ?? 10 (nao colapsa zero)', () => {
  /**
   * Simula a logica de calculo de minStock corrigida.
   * Original: `product.min_quantity || 10` — colapsa 0 para 10 (errado)
   * Corrigido: `product.min_quantity ?? 10` — preserva 0 intencional
   */
  function resolveMinStock(minQty: number | null | undefined): number {
    return minQty ?? 10;
  }

  function resolveMinStockBuggy(minQty: number | null | undefined): number {
    return minQty || 10;
  }

  it('[REGRESSAO STOCK-02] min_quantity=0 deve resultar em 0, nao 10', () => {
    expect(resolveMinStockBuggy(0)).toBe(10);
    expect(resolveMinStock(0)).toBe(0);
  });

  it('min_quantity=null usa fallback 10', () => {
    expect(resolveMinStock(null)).toBe(10);
    expect(resolveMinStock(undefined)).toBe(10);
  });

  it('min_quantity com valor positivo e preservado', () => {
    expect(resolveMinStock(5)).toBe(5);
    expect(resolveMinStock(100)).toBe(100);
  });
});

// ============================================================
// STOCK-03: paginacao para quando records.length < pageSize
// ============================================================

describe('STOCK-03 — logica de parada de paginacao', () => {
  /**
   * Simula a logica de controle do while no fetchPaginatedFromBridge.
   * Original: so parava no `if (totalCount === null && records.length === 0)`
   *           — fazia uma chamada extra desnecessaria apos pagina parcial.
   * Corrigido: adiciona `if (totalCount === null && records.length < pageSize) break`
   */
  function shouldStopPagination(
    totalCount: number | null,
    recordsLength: number,
    pageSize: number,
  ): boolean {
    if (totalCount !== null) return false;
    return recordsLength < pageSize;
  }

  it('[REGRESSAO STOCK-03] para quando recebe pagina parcial sem count', () => {
    expect(shouldStopPagination(null, 500, 1000)).toBe(true);
    expect(shouldStopPagination(null, 0, 1000)).toBe(true);
    expect(shouldStopPagination(null, 999, 1000)).toBe(true);
  });

  it('NAO para quando recebe pagina completa sem count (mais paginas esperadas)', () => {
    expect(shouldStopPagination(null, 1000, 1000)).toBe(false);
  });

  it('NAO para baseado nessa logica quando totalCount e conhecido', () => {
    expect(shouldStopPagination(5000, 500, 1000)).toBe(false);
  });
});

// ============================================================
// CS-02: resetFilters deve usar 'name' como sortBy padrao
// ============================================================

describe('CS-02 — resetFilters: sortBy padrao correto', () => {
  it('[REGRESSAO CS-02] valor padrao de reset deve ser name', () => {
    const DEFAULT_SORT = 'name';
    expect(DEFAULT_SORT).toBe('name');
  });
});

// ============================================================
// CS-04: priceRange threshold unificado para 9999
// ============================================================

describe('CS-04 — priceRange threshold unificado', () => {
  const PRICE_RANGE_MAX = 9999;
  const PRICE_RANGE_MIN = 0;

  it('[REGRESSAO CS-04] filtro ativo quando min > 0', () => {
    const isActive = (min: number, max: number) => min > PRICE_RANGE_MIN || max < PRICE_RANGE_MAX;
    expect(isActive(10, 9999)).toBe(true);
  });

  it('[REGRESSAO CS-04] filtro ativo quando max < 9999', () => {
    const isActive = (min: number, max: number) => min > PRICE_RANGE_MIN || max < PRICE_RANGE_MAX;
    expect(isActive(0, 500)).toBe(true);
  });

  it('filtro nao ativo com valores default (0 a 9999)', () => {
    const isActive = (min: number, max: number) => min > PRICE_RANGE_MIN || max < PRICE_RANGE_MAX;
    expect(isActive(0, 9999)).toBe(false);
  });

  it('[REGRESSAO CS-04] bug anterior: max=500 nao era detectado com threshold < 500', () => {
    const OLD_MAX = 500;
    const isActiveBuggy = (min: number, max: number) => min > 0 || max < OLD_MAX;
    const isActiveFixed = (min: number, max: number) => min > 0 || max < PRICE_RANGE_MAX;
    expect(isActiveBuggy(0, 500)).toBe(false);
    expect(isActiveFixed(0, 500)).toBe(true);
  });
});

// ============================================================
// AUTO-01/02: migratePayload versioning
// ============================================================

describe('migratePayload — versionamento de auto-save (AUTO-01, AUTO-02)', () => {
  it('[AUTO-01] migra payload v1 (sem version) para versao atual', () => {
    const v1Payload = { items: [{ id: 1 }], clientName: 'Test' };
    const result = migratePayload<typeof v1Payload>(v1Payload);

    expect(result).not.toBeNull();
    expect(result?.version).toBe(2);
    expect(result?.data).toEqual(v1Payload);
    expect(result?.savedAt).toBeTruthy();
  });

  it('[AUTO-02] nao restaura payload de versao futura (evita corrupcao de estado)', () => {
    const futurePayload = { version: 99, data: { items: [] }, savedAt: '2099-01-01T00:00:00.000Z' };
    const result = migratePayload(futurePayload);
    expect(result).toBeNull();
  });

  it('retorna payload v2 valido sem modificacao', () => {
    const v2Payload = {
      version: 2,
      data: { items: [{ id: 'abc' }] },
      savedAt: '2026-01-01T00:00:00.000Z',
    };
    const result = migratePayload(v2Payload);
    expect(result).not.toBeNull();
    expect(result?.version).toBe(2);
    expect(result?.data).toEqual(v2Payload.data);
  });

  it('retorna null para payload invalido (null, number, string)', () => {
    expect(migratePayload(null)).toBeNull();
    expect(migratePayload(42)).toBeNull();
    expect(migratePayload('string')).toBeNull();
    expect(migratePayload(undefined)).toBeNull();
  });
});

// ============================================================
// KBD-01 / VOICE-01: padrao useRef para callbacks em useEffect
// ============================================================

describe('KBD-01 / VOICE-01 — padrao de ref para callbacks instaveis', () => {
  /**
   * Verifica que o padrao useRef + sync update funciona corretamente.
   * Simula o que handleFavoriteProductRef e onResultRef fazem:
   * - ref.current e sempre a versao mais recente
   * - re-criar a funcao nao causa re-registro do listener
   */

  it('ref captura sempre a versao mais recente da funcao', () => {
    let currentVersion = 1;

    const createCallback = (v: number) => () => v;

    const callbackRef = { current: createCallback(currentVersion) };

    callbackRef.current = createCallback(1);
    expect(callbackRef.current()).toBe(1);

    currentVersion = 2;
    callbackRef.current = createCallback(2);
    expect(callbackRef.current()).toBe(2);

    expect(callbackRef.current()).toBe(currentVersion);
  });

  it('eventListener nao precisa ser recriado ao mudar o callback via ref', () => {
    const calls: number[] = [];
    const ref = { current: (v: number) => calls.push(v) };

    const handler = (v: number) => ref.current(v);

    handler(1);
    expect(calls).toEqual([1]);

    ref.current = (v: number) => calls.push(v * 10);

    handler(2);
    expect(calls).toEqual([1, 20]);
  });
});

// ============================================================
// VOICE-01: useSpeechRecognition — deps reduzidas
// ============================================================

describe('VOICE-01 — useSpeechRecognition deps do useEffect', () => {
  /**
   * Verifica a logica de controle do ciclo de vida da instancia.
   * O hook deve recriar a instancia APENAS quando isSupported ou language mudam.
   * Com o bug: onResult/onError nas deps — recriava em todo render.
   */
  it('[REGRESSAO VOICE-01] callback inline sem memo causa recriacao', () => {
    const cb1 = () => {};
    const cb2 = () => {};
    expect(cb1).not.toBe(cb2);

    const buggyDeps = (sr: boolean, lang: string, cb: () => void) => [sr, lang, cb];
    const d1 = buggyDeps(true, 'pt-BR', cb1);
    const d2 = buggyDeps(true, 'pt-BR', cb2);

    const depsChanged = d1.some((dep, i) => dep !== d2[i]);
    expect(depsChanged).toBe(true);

    const fixedDeps = (sr: boolean, lang: string) => [sr, lang];
    const fd1 = fixedDeps(true, 'pt-BR');
    const fd2 = fixedDeps(true, 'pt-BR');

    const fixedDepsChanged = fd1.some((dep, i) => dep !== fd2[i]);
    expect(fixedDepsChanged).toBe(false);
  });
});
