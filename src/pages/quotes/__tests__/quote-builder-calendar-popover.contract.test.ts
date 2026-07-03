/**
 * Guarda anti-regressão: garante que o PopoverContent do calendário
 * no QuoteBuilderPage cola 1:1 na largura do trigger (sem min-w) e usa p-2.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../QuoteBuilderPage.tsx'),
  'utf8',
);

describe('QuoteBuilderPage — popover do calendário', () => {
  it('cola na largura do trigger (sem min-w) e usa p-2', () => {
    const line = SRC.split('\n').find((l) =>
      l.includes('w-[var(--radix-popover-trigger-width)]'),
    );
    expect(line, 'PopoverContent do calendário não encontrado').toBeTruthy();
    expect(line!).toMatch(/\bp-2\b/);
    expect(line!).not.toMatch(/min-w-\[/);
    expect(line!).not.toMatch(/\bp-3\b/);
  });
});

