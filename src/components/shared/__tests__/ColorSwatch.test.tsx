import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  ColorSwatch,
  getColorSwatchClasses,
  resolveSwatchBackground,
  MIXED_COLOR_GRADIENT,
} from '../ColorSwatch';

describe('resolveSwatchBackground', () => {
  it('retorna o hex quando informado', () => {
    expect(resolveSwatchBackground('#FF00AA', 'Rosa')).toBe('#FF00AA');
  });

  it('retorna gradiente conic para nomes mistos (Colorido/Sortido/Multi)', () => {
    expect(resolveSwatchBackground(null, 'Colorido')).toBe(MIXED_COLOR_GRADIENT);
    expect(resolveSwatchBackground(undefined, 'Sortido')).toBe(MIXED_COLOR_GRADIENT);
    expect(resolveSwatchBackground('', 'Multi Color')).toBe(MIXED_COLOR_GRADIENT);
  });

  it('retorna undefined quando não há hex nem nome misto', () => {
    expect(resolveSwatchBackground(null, 'Azul')).toBeUndefined();
    expect(resolveSwatchBackground('', '')).toBeUndefined();
    expect(resolveSwatchBackground(undefined, undefined)).toBeUndefined();
  });

  it('ignora hex composto apenas por whitespace', () => {
    expect(resolveSwatchBackground('   ', 'Colorido')).toBe(MIXED_COLOR_GRADIENT);
  });
});

describe('getColorSwatchClasses', () => {
  it('default: classes base sem estados', () => {
    const c = getColorSwatchClasses();
    expect(c).toContain('rounded-full');
    expect(c).toContain('border-border/40');
    expect(c).not.toContain('ring-primary');
    expect(c).not.toContain('grayscale');
  });

  it('isActive: aplica ring-primary + glow', () => {
    const c = getColorSwatchClasses({ isActive: true });
    expect(c).toContain('ring-primary');
    expect(c).toContain('after:shadow-');
  });

  it('isOutOfStock: aplica slash diagonal + grayscale + opacity-40', () => {
    const c = getColorSwatchClasses({ isOutOfStock: true });
    expect(c).toContain('grayscale');
    expect(c).toContain('opacity-40');
    expect(c).toContain('before:bg-[linear-gradient(45deg');
  });

  it('isUpcoming sem out-of-stock: opacidade leve, sem slash', () => {
    const c = getColorSwatchClasses({ isUpcoming: true });
    expect(c).toContain('opacity-70');
    expect(c).not.toContain('grayscale');
    expect(c).not.toContain('before:bg-[linear-gradient(45deg');
  });

  it('isOutOfStock + isUpcoming: out-of-stock vence (slash visível)', () => {
    const c = getColorSwatchClasses({ isOutOfStock: true, isUpcoming: true });
    expect(c).toContain('grayscale');
    expect(c).not.toContain('opacity-70');
  });

  it('isInteractive: aplica hover scale + focus-visible ring', () => {
    const c = getColorSwatchClasses({ isInteractive: true });
    expect(c).toContain('hover:scale-');
    expect(c).toContain('focus-visible:ring-ring');
  });

  it('isInteractive + isActive: hover idle não é aplicado (active vence)', () => {
    const c = getColorSwatchClasses({ isInteractive: true, isActive: true });
    expect(c).toContain('ring-primary');
    expect(c).not.toMatch(/\bopacity-90\b/);
  });
});

describe('<ColorSwatch />', () => {
  it('renderiza com backgroundColor quando hex é válido', () => {
    render(<ColorSwatch hex="#123456" name="Custom" />);
    const el = screen.getByRole('img', { name: 'Custom' });
    expect(el.style.backgroundColor).toBeTruthy();
    expect(el.getAttribute('data-stock-state')).toBe('in-stock');
  });

  it('aplica gradiente conic via backgroundImage para cor mista', () => {
    render(<ColorSwatch name="Colorido" />);
    const el = screen.getByRole('img', { name: 'Colorido' });
    expect(el.style.backgroundImage).toContain('conic-gradient');
  });

  it('marca estado esgotado com data-stock-state="out"', () => {
    render(<ColorSwatch hex="#FFFFFF" name="Branco" isOutOfStock />);
    const el = screen.getByRole('img', { name: 'Branco' });
    expect(el.getAttribute('data-stock-state')).toBe('out');
    expect(el.className).toContain('grayscale');
  });

  it('marca estado upcoming com data-stock-state="upcoming"', () => {
    render(<ColorSwatch hex="#000000" name="Preto" isUpcoming />);
    const el = screen.getByRole('img', { name: 'Preto' });
    expect(el.getAttribute('data-stock-state')).toBe('upcoming');
  });

  it('fallback: nome vazio → "Sem cor" + borda tracejada', () => {
    render(<ColorSwatch />);
    const el = screen.getByRole('img', { name: 'Sem cor' });
    expect(el.className).toContain('border-dashed');
  });

  it('respeita sizePx custom', () => {
    render(<ColorSwatch hex="#abc" name="X" sizePx={40} />);
    const el = screen.getByRole('img', { name: 'X' });
    expect(el.style.width).toBe('40px');
    expect(el.style.height).toBe('40px');
  });
});
