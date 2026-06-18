/**
 * Regressão de cobertura e qualidade dos tooltips da sidebar.
 *
 * Análise estática do source — evita montar a sidebar inteira (Auth/RBAC/Router)
 * e mantém o teste rápido e determinístico. Mesma técnica usada em
 * StockDashboard.header-removed.regression.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = readFileSync(
  resolve(__dirname, '..', 'SidebarReorganized.tsx'),
  'utf-8',
);

/** Extrai todos os objetos `{ ... label: '...', href: '...', ... }` declarados. */
function extractItems(): Array<{ label: string; tooltip?: string; href?: string }> {
  // Match cada bloco que contém `label: '...'` até o `}` de fechamento do objeto.
  const re = /\{\s*icon:\s*\w+,[\s\S]*?label:\s*'([^']+)'[\s\S]*?\}/g;
  const items: Array<{ label: string; tooltip?: string; href?: string }> = [];
  for (const m of SOURCE.matchAll(re)) {
    const block = m[0];
    const label = m[1];
    const tooltipMatch = block.match(/tooltip:\s*'([^']+)'/);
    const hrefMatch = block.match(/href:\s*'([^']+)'/);
    items.push({
      label,
      tooltip: tooltipMatch?.[1],
      href: hrefMatch?.[1],
    });
  }
  return items;
}

// Termos técnicos proibidos em copy comercial (case-insensitive).
const TECH_BLOCKLIST = [
  'API', 'endpoint', 'webhook', 'JWT', 'RLS', 'SQL', 'log',
  'debug', 'config', 'cache', 'token', 'CDN', 'JSON',
];

describe('SidebarReorganized — tooltips comerciais', () => {
  const items = extractItems();

  it('extrai pelo menos 25 itens de navegação', () => {
    expect(items.length).toBeGreaterThanOrEqual(25);
  });

  it('100% dos itens de navegação possuem tooltip', () => {
    const semTooltip = items.filter((i) => !i.tooltip).map((i) => i.label);
    expect(semTooltip).toEqual([]);
  });

  it('tooltips são breves (40–120 caracteres)', () => {
    const foraDoPadrao = items
      .filter((i) => i.tooltip && (i.tooltip.length < 40 || i.tooltip.length > 120))
      .map((i) => `${i.label} (${i.tooltip!.length}): "${i.tooltip}"`);
    expect(foraDoPadrao).toEqual([]);
  });

  it('tooltips terminam com ponto final (tom consistente)', () => {
    const semPontuacao = items
      .filter((i) => i.tooltip && !/[.!?]$/.test(i.tooltip.trim()))
      .map((i) => i.label);
    expect(semPontuacao).toEqual([]);
  });

  it('tooltips evitam jargão técnico', () => {
    const violacoes: string[] = [];
    for (const item of items) {
      if (!item.tooltip) continue;
      for (const termo of TECH_BLOCKLIST) {
        const re = new RegExp(`\\b${termo}\\b`, 'i');
        if (re.test(item.tooltip)) {
          violacoes.push(`${item.label}: contém "${termo}"`);
        }
      }
    }
    expect(violacoes).toEqual([]);
  });

  it('NavItem expõe o campo tooltip no SidebarNavGroup', () => {
    const navGroupSource = readFileSync(
      resolve(__dirname, '..', 'sidebar', 'SidebarNavGroup.tsx'),
      'utf-8',
    );
    expect(navGroupSource).toMatch(/tooltip\?:\s*string/);
    expect(navGroupSource).toMatch(/item\.tooltip/);
  });
});
