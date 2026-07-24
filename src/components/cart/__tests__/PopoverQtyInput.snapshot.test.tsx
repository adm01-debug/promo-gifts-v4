/**
 * Snapshot visual — confirma classes/mensagens de feedback do PopoverQtyInput
 * nos estados `sanitized` (vírgula), `clamped` (9999999) e `invalid` (vazio).
 *
 * Não é screenshot pixel-perfect: capturamos o `outerHTML` do input + do
 * `role=status` correspondente com `toMatchSnapshot()` (arquivo externo
 * gerado no primeiro run). Regressões de classe/ARIA/mensagem quebram o
 * snapshot com diff legível.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import { PopoverQtyInput } from '../PopoverQtyInput';

/** Wrapper controlado — o commit flui de volta para `quantity`, como no app. */
function Controlled({ itemId, initial = 10 }: { itemId: string; initial?: number }) {
  const [q, setQ] = useState(initial);
  return (
    <PopoverQtyInput
      itemId={itemId}
      productName="Item snap"
      quantity={q}
      onCommit={setQ}
    />
  );
}

function snapshotBundle(itemId: string): string {
  const input = screen.getByTestId(`cart-item-qty-${itemId}`) as HTMLInputElement;
  const live = document.getElementById(`cart-item-qty-fb-${itemId}`);
  return [
    `INPUT: ${input.outerHTML}`,
    `LIVE : ${live ? live.outerHTML : '<none>'}`,
  ].join('\n');
}

describe('PopoverQtyInput — snapshot de feedback visual', () => {
  it('sanitized: vírgula → ring âmbar + mensagem "Apenas dígitos"', () => {
    render(
      <PopoverQtyInput
        itemId="snap-san"
        productName="Item snap"
        quantity={10}
        onCommit={vi.fn()}
      />,
    );
    const input = screen.getByTestId('cart-item-qty-snap-san') as HTMLInputElement;
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '1,0' } });

    expect(input.dataset.feedback).toBe('sanitized');
    // Asserts explícitos sobre a superfície visível ao usuário.
    expect(input.className).toContain('ring-warning/60');
    expect(input.className).toContain('bg-warning/10');
    expect(input.getAttribute('aria-describedby')).toBe('cart-item-qty-fb-snap-san');
    const live = document.getElementById('cart-item-qty-fb-snap-san')!;
    expect(live.getAttribute('role')).toBe('status');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent).toBe('Apenas dígitos são aceitos');
    expect(snapshotBundle('snap-san')).toMatchSnapshot('sanitized');
  });

  it('clamped: 9999999 → ring âmbar + mensagem "Valor limitado a 999.999"', () => {
    render(<Controlled itemId="snap-clamp" />);
    const input = screen.getByTestId('cart-item-qty-snap-clamp') as HTMLInputElement;
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '9999999' } });
    fireEvent.blur(input);

    expect(input.dataset.feedback).toBe('clamped');
    expect(input.className).toContain('ring-warning/60');
    expect(input.value).toBe('999999');
    const live = document.getElementById('cart-item-qty-fb-snap-clamp')!;
    expect(live.textContent).toBe('Valor limitado a 999.999');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(snapshotBundle('snap-clamp')).toMatchSnapshot('clamped');
  });

  it('invalid: vazio → ring vermelho + aria-invalid + mensagem "Valor inválido"', () => {
    render(
      <PopoverQtyInput
        itemId="snap-inv"
        productName="Item snap"
        quantity={10}
        onCommit={vi.fn()}
      />,
    );
    const input = screen.getByTestId('cart-item-qty-snap-inv') as HTMLInputElement;
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(input.dataset.feedback).toBe('invalid');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.className).toContain('ring-destructive/70');
    expect(input.className).toContain('bg-destructive/10');
    const live = document.getElementById('cart-item-qty-fb-snap-inv')!;
    expect(live.textContent).toBe('Valor inválido — quantidade restaurada');
    expect(live.getAttribute('role')).toBe('status');
    expect(snapshotBundle('snap-inv')).toMatchSnapshot('invalid');
  });

  it('reverted (Esc): valor volta ao último válido e feedback fica idle', () => {
    render(<Controlled itemId="snap-rev" initial={42} />);
    const input = screen.getByTestId('cart-item-qty-snap-rev') as HTMLInputElement;
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '777' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(input.value).toBe('42');
    expect(input.dataset.feedback).toBe('idle');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(input.className).not.toContain('ring-warning/60');
    expect(input.className).not.toContain('ring-destructive/70');
    expect(snapshotBundle('snap-rev')).toMatchSnapshot('reverted');
  });

  it('committed (Enter): valor válido persiste e feedback fica idle', () => {
    render(<Controlled itemId="snap-cmt" initial={10} />);
    const input = screen.getByTestId('cart-item-qty-snap-cmt') as HTMLInputElement;
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '80' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    // Enter dispara blur() no componente; simulamos aqui para JSDOM.
    fireEvent.blur(input);

    expect(input.value).toBe('80');
    expect(input.dataset.feedback).toBe('idle');
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(input.className).not.toContain('ring-warning/60');
    expect(input.className).not.toContain('ring-destructive/70');
    expect(snapshotBundle('snap-cmt')).toMatchSnapshot('committed');
  });
});
