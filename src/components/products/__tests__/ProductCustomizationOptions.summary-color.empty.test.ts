/**
 * Estados extras do card "Resumo das Configurações":
 *  - lista vazia (size === 0) ⇒ bloco NÃO é renderizado, mas o markup
 *    do JSX deve continuar guardado por `pricesRef.current.size > 0` e
 *    usar tokens `success` quando reaparecer
 *  - valor total zerado ⇒ continua exibindo `text-success` no preço
 *
 * Gate estático sobre o source (cheap, sem DOM).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FILE = resolve(__dirname, '../ProductCustomizationOptions.tsx');
const source = readFileSync(FILE, 'utf8');

describe('Resumo das Configurações — empty/zero ainda usa tokens success', () => {
  it('bloco é guardado por size > 0 (empty ⇒ não renderiza, sem fallback azul)', () => {
    expect(source).toMatch(/pricesRef\.current\.size > 0/);
    // Não pode existir um fallback "else" com border-primary/bg-primary
    const idx = source.indexOf('Resumo das Configurações');
    const window = source.slice(idx - 200, idx + 2200);
    expect(window).not.toMatch(/:\s*\(\s*<[^>]*border-primary/);
    expect(window).not.toMatch(/:\s*\(\s*<[^>]*bg-primary/);
  });

  it('preço (mesmo zero) usa text-success — formatter não depende do valor', () => {
    const idx = source.indexOf('total_cobrado');
    const window = source.slice(idx - 300, idx + 200);
    expect(window).toContain('text-success');
    // Garante que NÃO há lógica condicional trocando cor por valor
    expect(window).not.toMatch(/total_cobrado[^}]*\?\s*['"]text-(primary|accent|destructive)/);
  });

  it('label do local usa text-success independente de width/height/colors', () => {
    const idx = source.indexOf('{item.locationName}');
    const before = source.slice(idx - 200, idx);
    expect(before).toContain('text-success');
  });
});
