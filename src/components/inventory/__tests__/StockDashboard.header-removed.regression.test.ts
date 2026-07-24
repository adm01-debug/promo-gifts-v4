/**
 * Regressão estática: garante que o cabeçalho "Visão Geral" e seus chips
 * (Saúde: %, badge de alertas, ícone ⓘ) NÃO voltem ao StockDashboard.
 *
 * Lê o source como texto (sem renderização) para evitar mocks pesados.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, '../StockDashboard.tsx'), 'utf-8');

describe('StockDashboard — header removido (regressão)', () => {
  it('não contém o título "Visão Geral"', () => {
    expect(SRC).not.toMatch(/>\s*Visão Geral\s*</);
  });

  it('não renderiza o chip "Saúde:"', () => {
    expect(SRC).not.toMatch(/Saúde:\s*\{healthScore\}/);
    expect(SRC).not.toContain('data-testid="health-score-badge"');
  });

  it('não renderiza o badge de alertas críticos no header', () => {
    expect(SRC).not.toContain('data-testid="critical-alerts-badge"');
    expect(SRC).not.toMatch(/\{criticalAlerts\.length\}\s*alertas/);
  });

  it('não renderiza o HealthScoreInfoDialog (ícone ⓘ)', () => {
    expect(SRC).not.toMatch(/<HealthScoreInfoDialog\b/);
  });
});
