/**
 * Auditoria estrutural dos 12 call-sites de <Clickable> (Ondas 1-3).
 * Não renderiza componentes (imports em cascata pesam) — valida padrões
 * textuais robustos que fecham gaps identificados no plano exaustivo.
 *
 * Ver qa/CLICKABLE_EXHAUSTIVE_AUDIT.md.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const CALL_SITES = [
  // Onda 1
  'src/pages/magazine/MagazineListPage.tsx',
  'src/pages/products/CartsListPage.tsx',
  'src/pages/quotes/QuotesDashboardPage.tsx',
  'src/pages/trends/TrendsCharts.tsx',
  // Onda 2
  'src/components/collections/CollectionGridCard.tsx',
  'src/components/products/ProductCard.tsx',
  'src/components/products/ProductListItem.tsx',
  'src/components/products/table-view/ProductTableRow.tsx',
  // Onda 3
  'src/components/collections/CollectionListItem.tsx',
  'src/components/novelties/NoveltyCards.tsx',
  'src/components/novelties/NoveltiesSection.tsx',
  'src/components/products/QuickViewThumb.tsx',
];

function read(f: string) {
  return readFileSync(f, 'utf8');
}

describe('Clickable — auditoria estrutural dos 12 call-sites', () => {
  it('todos importam Clickable do SSOT', () => {
    for (const f of CALL_SITES) {
      const src = read(f);
      expect(src, `${f} deve importar Clickable`).toMatch(
        /import\s*\{[^}]*\bClickable\b[^}]*\}\s*from\s*['"]@\/components\/shared\/Clickable['"]/,
      );
    }
  });

  it('todos usam pelo menos um <Clickable ...>', () => {
    for (const f of CALL_SITES) {
      const src = read(f);
      expect(src, `${f} deve conter <Clickable`).toMatch(/<Clickable\b/);
    }
  });

  it('nenhum call-site duplica role="button" inline em elemento não-nativo', () => {
    // Se ainda existir role="button" no arquivo, DEVE estar apenas em <button>
    // (nativo) ou em JSDoc/comentário. Testamos que role="button" não aparece
    // colado a <div/span/motion.div/article/li/section/Card
    for (const f of CALL_SITES) {
      const src = read(f);
      // regex: qualquer <Tag ... role="button" onde Tag ∈ {div, span, article, li, section, Card, motion.div}
      const bad = /<(?:div|span|article|li|section|Card|motion\.div)\b[^>]*\brole=["']button["']/g;
      const matches = src.match(bad) ?? [];
      expect(matches, `${f} tem role="button" em elemento não-nativo (viola SSOT)`).toEqual([]);
    }
  });

  it('nenhum call-site tem onKeyDown manual de Enter/Space fora do Clickable (mesmo padrão)', () => {
    // Detecta o padrão legado: onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ')
    // Se aparecer no arquivo, deve estar em contexto NÃO relacionado a Clickable
    // (ex.: input search, tabpanel). Não bloqueamos, mas garantimos que os call-sites
    // refatorados não sofrem regressão: se o arquivo tem <Clickable, não deve ter
    // esse padrão IMEDIATAMENTE ADJACENTE ao <Clickable>.
    for (const f of CALL_SITES) {
      const src = read(f);
      // Extrai blocos <Clickable ... > ... </Clickable> e valida
      const blocks = src.match(/<Clickable\b[^>]*>/g) ?? [];
      for (const block of blocks) {
        expect(
          /onKeyDown=\{?\(e\)\s*=>\s*\{[\s\S]*?e\.key\s*===\s*['"]Enter['"]/.test(block),
          `${f}: <Clickable> contém onKeyDown manual — SSOT já cuida disso`,
        ).toBe(false);
      }
    }
  });

  it('nenhum Clickable aninhado dentro de outro Clickable', () => {
    for (const f of CALL_SITES) {
      const src = read(f);
      // Remove comentários JSDoc que podem mencionar <Clickable
      const stripped = src.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      const openings = (stripped.match(/<Clickable\b/g) ?? []).length;
      const closings = (stripped.match(/<\/Clickable>/g) ?? []).length;
      // permite múltiplos Clickables irmãos, mas cada abertura deve ter fechamento
      expect(openings, `${f}: aberturas/fechamentos de Clickable desbalanceados`).toBe(closings);
      // Detectar aninhamento: procura <Clickable ... > ... <Clickable
      const nestingRe = /<Clickable\b[^>]*>(?:(?!<\/Clickable>)[\s\S])*?<Clickable\b/;
      expect(nestingRe.test(stripped), `${f}: Clickable aninhado (anti-padrão)`).toBe(false);
    }
  });

  it('nenhum call-site usa Clickable como trigger asChild do Radix (anti-padrão)', () => {
    for (const f of CALL_SITES) {
      const src = read(f);
      const bad = /asChild\s*>\s*\n?\s*<Clickable\b/;
      expect(bad.test(src), `${f}: Clickable dentro de Radix asChild`).toBe(false);
    }
  });

  it('call-sites que passam ref usam tipo compatível com HTMLElement', () => {
    // ProductCard/ProductListItem declaram quickViewTriggerRef que é passado ao Clickable.
    // ProductTableRow usa forwardRef externo (ref do pai), sem useRef local no Clickable.
    const REFS = [
      'src/components/products/ProductCard.tsx',
      'src/components/products/ProductListItem.tsx',
    ];
    for (const f of REFS) {
      const src = read(f);
      // deve declarar HTMLElement (não HTMLDivElement — mais restrito) na ref do QuickView
      expect(src, `${f}: ref do QuickView deve ser HTMLElement`).toMatch(
        /useRef<HTMLElement\s*\|\s*null>\(null\)/,
      );
    }
  });
});
