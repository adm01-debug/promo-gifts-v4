/**
 * Regression guard: garante que a largura do painel StockAlertsIndicator
 * permanece em 391px (-7% do original 420px) e continua sendo consumida
 * a partir do token CSS `--stock-alerts-panel-width`.
 *
 * Testa estaticamente para não depender de renderização do Radix Popover
 * (que usa portal + posicionamento medido pelo browser).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const COMPONENT_PATH = resolve(__dirname, '../StockAlertsIndicator.tsx');
const TOKENS_PATH = resolve(__dirname, '../../../styles/missing-root-tokens.css');

const componentSrc = readFileSync(COMPONENT_PATH, 'utf8');
const tokensSrc = readFileSync(TOKENS_PATH, 'utf8');

describe('StockAlertsIndicator — largura do painel (SSOT)', () => {
  it('define o token --stock-alerts-panel-width como 391px', () => {
    const match = /--stock-alerts-panel-width:\s*([^;]+);/.exec(tokensSrc);
    expect(match, 'token --stock-alerts-panel-width não encontrado').toBeTruthy();
    expect(match![1].trim()).toBe('391px');
  });

  it('PopoverContent consome o token via CSS var (não hardcoded)', () => {
    expect(componentSrc).toContain('var(--stock-alerts-panel-width)');
  });

  it('não usa mais a largura hardcoded w-[391px] ou w-[420px]', () => {
    expect(componentSrc).not.toMatch(/w-\[391px\]/);
    expect(componentSrc).not.toMatch(/w-\[420px\]/);
  });

  it('aplica proteção responsiva para mobile (max-w calc(100vw-...))', () => {
    expect(componentSrc).toMatch(/max-w-\[calc\(100vw-1rem\)\]/);
    expect(componentSrc).toMatch(/sm:max-w-\[calc\(100vw-2rem\)\]/);
  });

  it('expõe data-testid="stock-alerts-panel" para testes E2E/visuais', () => {
    expect(componentSrc).toContain('data-testid="stock-alerts-panel"');
  });
});

describe('StockAlertsIndicator — chips (presença e ordem)', () => {
  const CHIP_ORDER = ['stockout', 'low', 'new', 'restocked'] as const;
  const CHIP_LABELS = ['Zerou', 'Baixo', 'Novidade', 'Chegou'] as const;

  it('define os 4 chips na ordem canônica: Zerou → Baixo → Novidade → Chegou', () => {
    // Extrai a array TABS do source
    const tabsMatch = /const TABS:\s*TabDef\[\]\s*=\s*\[([\s\S]*?)\];/.exec(componentSrc);
    expect(tabsMatch, 'array TABS não encontrada').toBeTruthy();
    const tabsBlock = tabsMatch![1];

    const keyOrder = [...tabsBlock.matchAll(/key:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(keyOrder).toEqual([...CHIP_ORDER]);

    const labelOrder = [...tabsBlock.matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(labelOrder).toEqual([...CHIP_LABELS]);
  });

  it('cada chip expõe data-testid="stock-alerts-chip-<key>" (via template)', () => {
    expect(componentSrc).toMatch(
      /data-testid=\{`stock-alerts-chip-\$\{tab\.key\}`\}/,
    );
  });

  it('renderiza a linha de chips com flex-nowrap + shrink-0 (não quebra a 391px)', () => {
    expect(componentSrc).toMatch(/flex flex-nowrap[^"']*gap-1[^"']*/);
    expect(componentSrc).toMatch(/flex shrink-0 items-center/);
  });

  it('estados de loading e erro do painel expõem testids dedicados', () => {
    expect(componentSrc).toContain('data-testid="stock-alerts-loading"');
    expect(componentSrc).toContain('data-testid="stock-alerts-error"');
  });
});
