import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Regressão: o container da imagem do ProductCard deve manter
 * a proporção `aspect-[5/4]` (altura reduzida em ~20% vs aspect-square),
 * sem alterar a largura nem o conteúdo interno do card.
 */
describe('ProductCardImage — aspect ratio', () => {
  it('mantém a classe aspect-[5/4] no container da imagem', () => {
    const file = readFileSync(
      resolve(__dirname, '../ProductCardImage.tsx'),
      'utf-8',
    );
    expect(file).toMatch(/aspect-\[5\/4\]/);
    expect(file).not.toMatch(/className="[^"]*\baspect-square\b[^"]*"/);
  });
});
