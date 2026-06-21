/**
 * Testes do primitivo visual `ColorSwatch` e funções auxiliares
 * `resolveSwatchBackground` + `getColorSwatchClasses` (SSOT visual).
 *
 * Cobre:
 *   - Resolução de background: hex sólido, gradiente cônico (cores mistas),
 *     placeholder sem cor.
 *   - Classes por estado: ativo, esgotado (slash + grayscale), placeholder.
 *   - Render do componente: aplica backgroundColor inline, respeita className
 *     extra, propaga props nativas, suporta ref.
 */
import { createRef } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  ColorSwatch,
  MIXED_COLOR_GRADIENT,
  getColorSwatchClasses,
  resolveSwatchBackground,
} from '../ColorSwatch';

describe('resolveSwatchBackground', () => {
  it('retorna o hex sólido quando presente', () => {
    const r = resolveSwatchBackground('#FF0000', 'Vermelho');
    expect(r).toEqual({ background: '#FF0000', isMixed: false, hasBg: true });
  });

  it('normaliza hex com espaços', () => {
    expect(resolveSwatchBackground('  #abcdef  ', null).background).toBe('#abcdef');
  });

  it('aplica gradiente cônico para cores mistas reconhecidas', () => {
    for (const name of ['Colorido', 'Sortido', 'Multi', 'Arco-íris', 'Rainbow', 'Mix']) {
      const r = resolveSwatchBackground(null, name);
      expect(r.isMixed, name).toBe(true);
      expect(r.background, name).toBe(MIXED_COLOR_GRADIENT);
      expect(r.hasBg, name).toBe(true);
    }
  });

  it('retorna placeholder (sem fundo) quando nem hex nem nome conhecido', () => {
    expect(resolveSwatchBackground(null, 'Verde-musgo')).toEqual({
      background: undefined,
      isMixed: false,
      hasBg: false,
    });
    expect(resolveSwatchBackground(undefined, undefined)).toEqual({
      background: undefined,
      isMixed: false,
      hasBg: false,
    });
    expect(resolveSwatchBackground('', '')).toEqual({
      background: undefined,
      isMixed: false,
      hasBg: false,
    });
  });

  it('hex tem precedência sobre nome misto', () => {
    const r = resolveSwatchBackground('#123456', 'Colorido');
    expect(r.background).toBe('#123456');
    expect(r.isMixed).toBe(false);
  });
});

describe('getColorSwatchClasses', () => {
  it('inclui classes base mínimas (rounded-full, border, shadow)', () => {
    const c = getColorSwatchClasses();
    expect(c).toContain('rounded-full');
    expect(c).toContain('border');
    expect(c).toContain('shadow-sm');
  });

  it('aplica ring primary quando ativo', () => {
    expect(getColorSwatchClasses({ isActive: true })).toContain('ring-primary');
  });

  it('NÃO inclui ring quando inativo', () => {
    expect(getColorSwatchClasses({ isActive: false })).not.toContain('ring-primary');
  });

  it('aplica slash + grayscale + opacity quando esgotado', () => {
    const c = getColorSwatchClasses({ isOutOfStock: true });
    expect(c).toContain('grayscale');
    expect(c).toContain('opacity-40');
    expect(c).toContain('before:bg-[linear-gradient(45deg');
  });

  it('aplica borda tracejada quando sem background', () => {
    expect(getColorSwatchClasses({ hasBg: false })).toContain('border-dashed');
  });

  it('combina ativo + esgotado sem conflito', () => {
    const c = getColorSwatchClasses({ isActive: true, isOutOfStock: true });
    expect(c).toContain('ring-primary');
    expect(c).toContain('grayscale');
  });
});

describe('<ColorSwatch />', () => {
  it('aplica backgroundColor inline a partir do hex', () => {
    const { container } = render(<ColorSwatch hex="#abcdef" name="Azul" />);
    const span = container.firstChild as HTMLSpanElement;
    expect(span.style.backgroundColor).toBeTruthy();
    expect(span.className).toContain('rounded-full');
  });

  it('não aplica style quando sem hex e sem nome misto (placeholder)', () => {
    const { container } = render(<ColorSwatch />);
    const span = container.firstChild as HTMLSpanElement;
    expect(span.style.backgroundColor).toBe('');
    expect(span.className).toContain('border-dashed');
  });

  it('aplica gradiente cônico em nome misto (via background shorthand)', () => {
    const { container } = render(<ColorSwatch name="Sortido" />);
    const span = container.firstChild as HTMLSpanElement;
    // Gradiente vai em `background` (não em `backgroundColor`, que só aceita <color>).
    const bg = span.style.background || span.getAttribute('style') || '';
    expect(bg).toContain('conic-gradient');
    // backgroundColor pode ser '' ou 'transparent' (efeito do shorthand no jsdom)
    expect(['', 'transparent']).toContain(span.style.backgroundColor);
  });

  it('propaga sizeClassName e className extras', () => {
    const { container } = render(
      <ColorSwatch hex="#000" sizeClassName="h-4 w-4" className="custom-x" />,
    );
    const span = container.firstChild as HTMLSpanElement;
    expect(span.className).toContain('h-4');
    expect(span.className).toContain('w-4');
    expect(span.className).toContain('custom-x');
  });

  it('marca estado esgotado com slash visual', () => {
    const { container } = render(<ColorSwatch hex="#fff" isOutOfStock />);
    const span = container.firstChild as HTMLSpanElement;
    expect(span.className).toContain('grayscale');
    expect(span.className).toContain('opacity-40');
  });

  it('marca estado ativo com ring primary', () => {
    const { container } = render(<ColorSwatch hex="#fff" isActive />);
    const span = container.firstChild as HTMLSpanElement;
    expect(span.className).toContain('ring-primary');
  });

  it('encaminha ref para o <span>', () => {
    const ref = createRef<HTMLSpanElement>();
    render(<ColorSwatch hex="#fff" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
  });

  it('propaga aria-label e title (props nativas)', () => {
    const { container } = render(
      <ColorSwatch hex="#fff" aria-label="Branco" title="Branco gelo" />,
    );
    const span = container.firstChild as HTMLSpanElement;
    expect(span.getAttribute('aria-label')).toBe('Branco');
    expect(span.getAttribute('title')).toBe('Branco gelo');
  });

  it('bolinha BRANCA permanece branca (não cinza) — regressão visual', () => {
    const { container } = render(<ColorSwatch hex="#FFFFFF" name="Branco" />);
    const span = container.firstChild as HTMLSpanElement;
    // jsdom normaliza para rgb()
    expect(span.style.backgroundColor.toLowerCase().replace(/\s/g, '')).toMatch(
      /^(#ffffff|rgb\(255,255,255\))$/,
    );
    // Sem grayscale quando não está esgotada
    expect(span.className).not.toContain('grayscale');
  });
});
