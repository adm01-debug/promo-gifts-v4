import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Regressão: o container da imagem do ProductCard deve manter
 * `aspect-square` (área branca maximizada). A redução de altura
 * é absorvida pelo bloco de informações (paddings/min-heights compactos).
 */
describe('ProductCardImage — aspect ratio', () => {
  it('mantém aspect-square no container da imagem', () => {
    const file = readFileSync(
      resolve(__dirname, '../ProductCardImage.tsx'),
      'utf-8',
    );
    expect(file).toMatch(/\baspect-square\b/);
  });
});
