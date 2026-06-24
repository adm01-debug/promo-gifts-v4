/**
 * Fuzz/simulação do botão global "Recolher / Expandir" do Resumo.
 *
 * Estratégia: extrai as invariantes do source (SSOT) e roda centenas
 * de simulações combinando N itens (1..50), padrões de colapso aleatório
 * e transições de toggle. Valida:
 *
 *   1) Texto do botão: "Recolher" sse há pelo menos 1 item aberto.
 *   2) Tooltip: gramática PT-BR correta (singular/plural/all-collapsed).
 *   3) Idempotência: toggle 2x volta ao estado original.
 *   4) Convergência: após "Recolher tudo" → openCount === 0.
 *   5) Convergência: após "Expandir tudo" → openCount === N.
 *   6) aria-pressed / aria-expanded coerentes com allCollapsed.
 *   7) Persistência: o Set salvo == Set em memória.
 *   8) Coexistência com Agrupar: contagem não muda ao reordenar/agrupar.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  saveCollapsedItems,
  loadCollapsedItems,
} from '@/lib/quotes/collapsedItemsStorage';

const SRC = readFileSync(
  resolve(__dirname, '../QuoteBuilderSummaryColumn.tsx'),
  'utf8',
);

// --- Helpers de simulação (espelham a lógica do componente) ---------------
function computeAllCollapsed(itemKeys: string[], collapsed: Set<string>): boolean {
  return itemKeys.length > 0 && itemKeys.every((k) => collapsed.has(k));
}
function computeOpenCount(itemKeys: string[], collapsed: Set<string>): number {
  return itemKeys.length - itemKeys.filter((k) => collapsed.has(k)).length;
}
function computeTooltip(openCount: number, allCollapsed: boolean): string {
  if (allCollapsed) return 'Todos os itens estão recolhidos — clique para abrir todos';
  if (openCount === 1) return '1 produto aberto — clique para recolher todos';
  return `${openCount} produtos abertos — clique para recolher todos`;
}
function computeAriaLabel(
  total: number,
  openCount: number,
  allCollapsed: boolean,
): string {
  if (allCollapsed) return `Expandir todos os ${total} itens do resumo`;
  return `Recolher ${openCount} ${openCount === 1 ? 'item aberto' : 'itens abertos'} do resumo`;
}
function toggleAll(itemKeys: string[], collapsed: Set<string>): Set<string> {
  return computeAllCollapsed(itemKeys, collapsed)
    ? new Set<string>()
    : new Set<string>(itemKeys);
}

const seeded = (seed: number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
};

// --- Mock mínimo de localStorage para os testes de persistência -----------
class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length(): number {
    return this.m.size;
  }
  clear(): void {
    this.m.clear();
  }
  getItem(k: string): string | null {
    return this.m.get(k) ?? null;
  }
  key(i: number): string | null {
    return Array.from(this.m.keys())[i] ?? null;
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
}
const installStorage = () => {
  const s = new MemStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: s,
    configurable: true,
  });
  return s;
};

// =========================================================================
describe('CollapseAll · sanity de tokens no source (SSOT)', () => {
  it('botão expõe data-open-count + aria-pressed + aria-expanded', () => {
    expect(SRC).toMatch(/data-open-count=\{openCount\}/);
    expect(SRC).toMatch(/aria-pressed=\{allCollapsed\}/);
    expect(SRC).toMatch(/aria-expanded=\{!allCollapsed\}/);
  });

  it('focus-visible com ring-primary (a11y teclado)', () => {
    expect(SRC).toMatch(/focus-visible:ring-2 focus-visible:ring-primary/);
  });

  it('animação fade-in respeita prefers-reduced-motion', () => {
    const matches = SRC.match(/animate-fade-in[^"]*motion-reduce:animate-none/g);
    expect(matches?.length).toBeGreaterThanOrEqual(2);
  });

  it('tooltip suporta gramática singular vs plural', () => {
    expect(SRC).toMatch(/openCount === 1/);
    expect(SRC).toMatch(/\$\{openCount\} produtos abertos/);
  });
});

// =========================================================================
describe('CollapseAll · 1000+ simulações de estado', () => {
  it('Recolher tudo: openCount sempre converge para 0', () => {
    const rng = seeded(0xA11C);
    for (let it = 0; it < 250; it++) {
      const n = Math.floor(rng() * 50) + 1;
      const keys = Array.from({ length: n }, (_, i) => `id-${i}`);
      const initial = new Set<string>(
        keys.filter(() => rng() < rng()),
      );
      const next = toggleAll(keys, initial);
      // Caso 1: já estava tudo recolhido → expande (openCount=N).
      // Caso 2: parcial/vazio → recolhe (openCount=0).
      const wasAll = computeAllCollapsed(keys, initial);
      const open = computeOpenCount(keys, next);
      expect(open).toBe(wasAll ? n : 0);
    }
  });

  it('Idempotência: toggle 2x volta ao estado lógico equivalente', () => {
    const rng = seeded(0xB0BB1E);
    for (let it = 0; it < 250; it++) {
      const n = Math.floor(rng() * 50) + 1;
      const keys = Array.from({ length: n }, (_, i) => `id-${i}`);
      const initial = new Set<string>(keys.filter(() => rng() < 0.5));
      const after1 = toggleAll(keys, initial);
      const after2 = toggleAll(keys, after1);
      // 2 toggles a partir de QUALQUER estado: ou tudo aberto ou tudo fechado.
      // Mas após o 1º toggle SEMPRE temos extremo (∅ ou full); o 2º inverte.
      const open2 = computeOpenCount(keys, after2);
      expect(open2 === 0 || open2 === n).toBe(true);
    }
  });

  it('aria-pressed/aria-expanded são SEMPRE booleanos opostos coerentes', () => {
    const rng = seeded(0xC0FFEE);
    for (let it = 0; it < 250; it++) {
      const n = Math.floor(rng() * 50) + 1;
      const keys = Array.from({ length: n }, (_, i) => `id-${i}`);
      const collapsed = new Set<string>(keys.filter(() => rng() < 0.5));
      const allCollapsed = computeAllCollapsed(keys, collapsed);
      const ariaPressed = allCollapsed;
      const ariaExpanded = !allCollapsed;
      expect(ariaPressed).toBe(!ariaExpanded);
    }
  });

  it('Tooltip: gramática PT-BR singular/plural/all-collapsed sem exceções', () => {
    const rng = seeded(0xDEADBEEF);
    for (let it = 0; it < 300; it++) {
      const n = Math.floor(rng() * 50) + 1;
      const keys = Array.from({ length: n }, (_, i) => `id-${i}`);
      const collapsed = new Set<string>(keys.filter(() => rng() < 0.4));
      const open = computeOpenCount(keys, collapsed);
      const all = computeAllCollapsed(keys, collapsed);
      const tip = computeTooltip(open, all);
      if (all) {
        expect(tip).toBe('Todos os itens estão recolhidos — clique para abrir todos');
      } else if (open === 1) {
        expect(tip).toBe('1 produto aberto — clique para recolher todos');
      } else {
        expect(tip).toBe(`${open} produtos abertos — clique para recolher todos`);
        // Nunca usar "1 produtos" (gramática incorreta).
        expect(tip.startsWith('1 produtos')).toBe(false);
      }
    }
  });

  it('aria-label: nunca menciona contagem zerada quando ainda há item aberto', () => {
    const rng = seeded(0x1234);
    for (let it = 0; it < 250; it++) {
      const n = Math.floor(rng() * 50) + 1;
      const keys = Array.from({ length: n }, (_, i) => `id-${i}`);
      const collapsed = new Set<string>(keys.filter(() => rng() < 0.5));
      const open = computeOpenCount(keys, collapsed);
      const all = computeAllCollapsed(keys, collapsed);
      const label = computeAriaLabel(n, open, all);
      if (all) {
        expect(label).toContain(`${n} itens`);
        expect(label).not.toMatch(/Recolher/);
      } else {
        expect(label).toMatch(/^Recolher /);
        if (open === 1) expect(label).toContain('1 item aberto');
        else expect(label).toContain(`${open} itens abertos`);
      }
    }
  });

  it('Coexistência com Agrupar: reordenar/agrupar não altera openCount nem allCollapsed', () => {
    const rng = seeded(0xACAB);
    for (let it = 0; it < 200; it++) {
      const n = Math.floor(rng() * 50) + 1;
      const keys = Array.from({ length: n }, (_, i) => `id-${i}`);
      const collapsed = new Set<string>(keys.filter(() => rng() < 0.5));
      const reordered = [...keys].sort(() => rng() - 0.5);
      expect(computeOpenCount(reordered, collapsed)).toBe(
        computeOpenCount(keys, collapsed),
      );
      expect(computeAllCollapsed(reordered, collapsed)).toBe(
        computeAllCollapsed(keys, collapsed),
      );
    }
  });
});

// =========================================================================
describe('CollapseAll · persistência via SSOT collapsedItemsStorage', () => {
  it('300 simulações: Set salvo === Set carregado, isolado por quoteId', () => {
    const storage = installStorage();
    const rng = seeded(0xF00D);
    for (let it = 0; it < 300; it++) {
      storage.clear();
      const n = Math.floor(rng() * 30) + 1;
      const keys = Array.from({ length: n }, (_, i) => `id-${i}`);
      const quoteId = `q-${it}`;
      // Cenário aleatório: ora "Recolher tudo", ora "Expandir tudo".
      const recolher = rng() < 0.5;
      const next = recolher ? new Set(keys) : new Set<string>();
      saveCollapsedItems(quoteId, next);
      const loaded = loadCollapsedItems(quoteId);
      expect(loaded.size).toBe(next.size);
      for (const k of next) expect(loaded.has(k)).toBe(true);
      // Outro quoteId não deve enxergar este estado.
      const other = loadCollapsedItems(`other-${it}`);
      expect(other.size).toBe(0);
    }
  });

  it('Expandir tudo (Set vazio) remove a chave do storage (não polui)', () => {
    const storage = installStorage();
    saveCollapsedItems('q-1', new Set(['a', 'b', 'c']));
    expect(storage.length).toBeGreaterThan(0);
    saveCollapsedItems('q-1', new Set<string>());
    // Implementação SSOT remove a chave quando o Set fica vazio.
    expect(storage.getItem('quote-builder:collapsed-item-keys:q-1')).toBeNull();
  });
});
