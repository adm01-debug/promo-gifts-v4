/**
 * Snapshot visual — confirma as classes/mensagens de feedback do PopoverQtyInput
 * nos estados `sanitized` (vírgula), `clamped` (9999999) e `invalid` (vazio).
 *
 * Não é screenshot pixel-perfect: capturamos o `outerHTML` do input + do
 * `role=status` correspondente. Assim, qualquer regressão de classe/ARIA/mensagem
 * quebra o snapshot de forma legível no diff.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PopoverQtyInput } from '../PopoverQtyInput';

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
    expect(snapshotBundle('snap-san')).toMatchInlineSnapshot(`
      "INPUT: <input type=\\"text\\" inputmode=\\"numeric\\" pattern=\\"[0-9]*\\" autocomplete=\\"off\\" aria-label=\\"Quantidade de Item snap\\" data-testid=\\"cart-item-qty-snap-san\\" data-feedback=\\"sanitized\\" aria-describedby=\\"cart-item-qty-fb-snap-san\\" class=\\"m-0 flex h-6 w-10 appearance-none border-x border-border/30 bg-muted/20 text-center text-[11px] font-bold tabular-nums text-foreground transition-shadow duration-200 [appearance:textfield] focus:bg-primary/5 focus:outline-none focus:ring-1 focus:ring-primary/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ring-1 ring-warning/60 bg-warning/10\\" value=\\"10\\">
      LIVE : <span id=\\"cart-item-qty-fb-snap-san\\" role=\\"status\\" aria-live=\\"polite\\" class=\\"sr-only\\">Apenas dígitos são aceitos</span>"
    `);
  });

  it('clamped: 9999999 → ring âmbar + mensagem "Valor limitado a 999.999"', () => {
    render(
      <PopoverQtyInput
        itemId="snap-clamp"
        productName="Item snap"
        quantity={10}
        onCommit={vi.fn()}
      />,
    );
    const input = screen.getByTestId('cart-item-qty-snap-clamp') as HTMLInputElement;
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '9999999' } });
    fireEvent.blur(input);

    expect(input.dataset.feedback).toBe('clamped');
    expect(snapshotBundle('snap-clamp')).toMatchInlineSnapshot(`
      "INPUT: <input type=\\"text\\" inputmode=\\"numeric\\" pattern=\\"[0-9]*\\" autocomplete=\\"off\\" aria-label=\\"Quantidade de Item snap\\" data-testid=\\"cart-item-qty-snap-clamp\\" data-feedback=\\"clamped\\" aria-describedby=\\"cart-item-qty-fb-snap-clamp\\" class=\\"m-0 flex h-6 w-10 appearance-none border-x border-border/30 bg-muted/20 text-center text-[11px] font-bold tabular-nums text-foreground transition-shadow duration-200 [appearance:textfield] focus:bg-primary/5 focus:outline-none focus:ring-1 focus:ring-primary/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ring-1 ring-warning/60 bg-warning/10\\" value=\\"999999\\">
      LIVE : <span id=\\"cart-item-qty-fb-snap-clamp\\" role=\\"status\\" aria-live=\\"polite\\" class=\\"sr-only\\">Valor limitado a 999.999</span>"
    `);
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
    expect(snapshotBundle('snap-inv')).toMatchInlineSnapshot(`
      "INPUT: <input type=\\"text\\" inputmode=\\"numeric\\" pattern=\\"[0-9]*\\" autocomplete=\\"off\\" aria-label=\\"Quantidade de Item snap\\" aria-invalid=\\"true\\" data-testid=\\"cart-item-qty-snap-inv\\" data-feedback=\\"invalid\\" aria-describedby=\\"cart-item-qty-fb-snap-inv\\" class=\\"m-0 flex h-6 w-10 appearance-none border-x border-border/30 bg-muted/20 text-center text-[11px] font-bold tabular-nums text-foreground transition-shadow duration-200 [appearance:textfield] focus:bg-primary/5 focus:outline-none focus:ring-1 focus:ring-primary/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ring-1 ring-destructive/70 bg-destructive/10\\" value=\\"10\\">
      LIVE : <span id=\\"cart-item-qty-fb-snap-inv\\" role=\\"status\\" aria-live=\\"polite\\" class=\\"sr-only\\">Valor inválido — quantidade restaurada</span>"
    `);
  });
});
