import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Smoke test de copy da tela de login.
 *
 * Renderizar `Auth.tsx` por completo exige mockar AuthContext, Supabase,
 * react-router, toasts, IP validation, etc. — desproporcional para garantir
 * uma string. Em vez disso, validamos o source do componente: se a frase
 * sumir ou for renomeada, o teste falha imediatamente.
 */
describe('Auth page — copy smoke', () => {
  it('mantém a frase "Continue sua jornada rumo ao sucesso." na tela de login', () => {
    const source = readFileSync(resolve(__dirname, '../Auth.tsx'), 'utf8');
    expect(source).toContain('Continue sua jornada rumo ao sucesso.');
    expect(source).not.toContain('Inicie sua jornada rumo ao sucesso');
  });
});
