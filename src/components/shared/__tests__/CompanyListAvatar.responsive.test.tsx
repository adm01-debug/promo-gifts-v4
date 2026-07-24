/**
 * CompanyListAvatar — testes de tamanho responsivo e overrides.
 *
 * Foco:
 *  - `md` renderiza w-8/h-8 (32px)
 *  - `lg` renderiza w-10/h-10 (40px)
 *  - Sem prop `size` (default responsivo) inclui `lg` + override
 *    `max-sm:!w-8 max-sm:!h-8` (garante que < sm cai para 32px sem overflow)
 *  - `className` extra é preservada
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CompanyListAvatar } from '@/components/shared/CompanyListAvatar';

function firstAvatar(container: HTMLElement): HTMLElement {
  // Fallback (sem logoUrl) renderiza um <div> com as iniciais.
  const el = container.querySelector('div, img') as HTMLElement | null;
  if (!el) throw new Error('avatar não encontrado');
  return el;
}

describe('CompanyListAvatar — tamanhos e responsividade', () => {
  it('size="md" aplica 32px (w-8 h-8)', () => {
    const { container } = render(<CompanyListAvatar name="Acme" size="md" />);
    const el = firstAvatar(container);
    expect(el.className).toMatch(/\bw-8\b/);
    expect(el.className).toMatch(/\bh-8\b/);
    expect(el.className).toMatch(/ring-1/);
  });

  it('size="lg" aplica 40px (w-10 h-10)', () => {
    const { container } = render(<CompanyListAvatar name="Acme" size="lg" />);
    const el = firstAvatar(container);
    expect(el.className).toMatch(/\bw-10\b/);
    expect(el.className).toMatch(/\bh-10\b/);
  });

  it('default (responsivo): base lg + override max-sm para md (sem overflow em telas pequenas)', () => {
    const { container } = render(<CompanyListAvatar name="Acme" />);
    const el = firstAvatar(container);
    // Base desktop = lg (40px)
    expect(el.className).toMatch(/\bw-10\b/);
    expect(el.className).toMatch(/\bh-10\b/);
    // Override < sm reduz para md (32px) — previne overflow em telas pequenas
    expect(el.className).toMatch(/max-sm:!w-8/);
    expect(el.className).toMatch(/max-sm:!h-8/);
    expect(el.className).toMatch(/max-sm:!text-xs/);
  });

  it('className extra é preservada junto do preset', () => {
    const { container } = render(
      <CompanyListAvatar name="Acme" className="opacity-50" />,
    );
    const el = firstAvatar(container);
    expect(el.className).toMatch(/opacity-50/);
    expect(el.className).toMatch(/ring-1/);
  });

  it('renderiza <img> quando logoUrl é fornecido, mantendo o preset de tamanho', () => {
    const { container } = render(
      <CompanyListAvatar name="Acme" logoUrl="https://example.com/logo.png" />,
    );
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.className).toMatch(/\bw-10\b/);
    expect(img!.className).toMatch(/max-sm:!w-8/);
  });
});
