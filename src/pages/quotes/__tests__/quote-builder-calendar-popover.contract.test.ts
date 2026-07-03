/**
 * Guarda anti-regressão: garante que o PopoverContent do calendário
 * no QuoteBuilderPage mantém a largura do trigger com min-w-[260px] e p-3.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, '../QuoteBuilderPage.tsx'),
  'utf8',
);

describe('QuoteBuilderPage — popover do calendário', () => {
  it('usa largura do trigger + min-w-[260px] + p-3', () => {
    const line = SRC.split('\n').find((l) =>
      l.includes('w-[var(--radix-popover-trigger-width)]'),
    );
    expect(line, 'PopoverContent do calendário não encontrado').toBeTruthy();
    expect(line!).toMatch(/min-w-\[260px\]/);
    expect(line!).toMatch(/\bp-3\b/);
    expect(line!).not.toMatch(/min-w-\[220px\]/);
    expect(line!).not.toMatch(/\bp-2\b/);
  });
});
