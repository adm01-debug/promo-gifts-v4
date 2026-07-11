/**
 * Testes do PopoverQtyInput — sanitização, clamp, teclado e feedback visual.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import {
  PopoverQtyInput,
  normalizeQty,
  MIN_QTY,
  MAX_QTY,
} from '../PopoverQtyInput';

describe('normalizeQty (regra pura)', () => {
  it('aceita inteiros dentro do intervalo', () => {
    expect(normalizeQty('1')).toBe(1);
    expect(normalizeQty('80')).toBe(80);
    expect(normalizeQty('999999')).toBe(999_999);
  });

  it('faz clamp acima do máximo', () => {
    expect(normalizeQty('1000000')).toBe(MAX_QTY);
    expect(normalizeQty('99999999')).toBe(MAX_QTY);
  });

  it('rejeita valores abaixo do mínimo', () => {
    expect(normalizeQty('0')).toBeNull();
    expect(normalizeQty('')).toBeNull();
  });

  it('descarta caracteres não numéricos e usa apenas os dígitos', () => {
    expect(normalizeQty('80abc')).toBe(80);
    expect(normalizeQty('a1b2c3')).toBe(123);
    expect(normalizeQty('1.500')).toBe(1500);
    expect(normalizeQty('1,500')).toBe(1500);
    expect(normalizeQty(' 42 ')).toBe(42);
  });

  it('retorna null quando só há caracteres inválidos', () => {
    expect(normalizeQty('abc')).toBeNull();
    expect(normalizeQty('---')).toBeNull();
    expect(normalizeQty('.,')).toBeNull();
  });

  it('constantes expostas', () => {
    expect(MIN_QTY).toBe(1);
    expect(MAX_QTY).toBe(999_999);
  });
});

describe('<PopoverQtyInput />', () => {
  const baseProps = {
    itemId: 'it-1',
    productName: 'Caneta Neon',
    quantity: 10,
  };

  it('permite digitar 80 e faz commit no Enter — Total pode recalcular', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<PopoverQtyInput {...baseProps} onCommit={onCommit} />);
    const input = screen.getByTestId('cart-item-qty-it-1') as HTMLInputElement;

    await user.click(input);
    await user.keyboard('{Control>}a{/Control}80{Enter}');

    expect(onCommit).toHaveBeenCalledWith(80);
  });

  it('faz clamp em 999.999 quando o usuário digita valor maior', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<PopoverQtyInput {...baseProps} onCommit={onCommit} />);
    const input = screen.getByTestId('cart-item-qty-it-1') as HTMLInputElement;

    await user.click(input);
    await user.keyboard('{Control>}a{/Control}9999999');
    fireEvent.blur(input);

    expect(onCommit).toHaveBeenCalledWith(999_999);
    // input.value reflete o valor externo (10) após commit, pois o pai não
    // renderiza o novo quantity neste teste — o clamp foi propagado via onCommit.
  });

  it('reverte ao último valor válido quando o campo fica vazio no blur', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<PopoverQtyInput {...baseProps} onCommit={onCommit} />);
    const input = screen.getByTestId('cart-item-qty-it-1') as HTMLInputElement;

    await user.click(input);
    await user.keyboard('{Control>}a{/Control}{Backspace}');
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe('10');
  });

  it('reverte para o último valor ao pressionar Esc, sem chamar onCommit', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<PopoverQtyInput {...baseProps} onCommit={onCommit} />);
    const input = screen.getByTestId('cart-item-qty-it-1') as HTMLInputElement;

    await user.click(input);
    await user.keyboard('{Control>}a{/Control}555{Escape}');

    expect(onCommit).not.toHaveBeenCalled();
    expect(input.value).toBe('10');
  });

  it('sanitiza vírgula, ponto, espaço e letras durante a digitação', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<PopoverQtyInput {...baseProps} onCommit={onCommit} />);
    const input = screen.getByTestId('cart-item-qty-it-1') as HTMLInputElement;

    await user.click(input);
    await user.keyboard('{Control>}a{/Control}');
    // Digita mistura de lixo — apenas dígitos devem permanecer.
    fireEvent.change(input, { target: { value: '1a2,3 .b4' } });
    expect(input.value).toBe('1234');

    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(1234);
  });

  it('define aria-label descritivo por item', () => {
    render(<PopoverQtyInput {...baseProps} onCommit={vi.fn()} />);
    expect(
      screen.getByLabelText('Quantidade de Caneta Neon'),
    ).toBeInTheDocument();
  });

  it('autoFocus foca o input ao montar quando solicitado', () => {
    render(<PopoverQtyInput {...baseProps} autoFocus onCommit={vi.fn()} />);
    const input = screen.getByTestId('cart-item-qty-it-1');
    expect(document.activeElement).toBe(input);
  });

  it('não commita quando o valor não muda', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<PopoverQtyInput {...baseProps} onCommit={onCommit} />);
    const input = screen.getByTestId('cart-item-qty-it-1') as HTMLInputElement;

    await user.click(input);
    fireEvent.blur(input);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('sincroniza com prop externa apenas quando não está em edição', () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <PopoverQtyInput {...baseProps} onCommit={onCommit} />,
    );
    const input = screen.getByTestId('cart-item-qty-it-1') as HTMLInputElement;

    // Sem foco: atualização externa deve refletir.
    rerender(
      <PopoverQtyInput {...baseProps} quantity={42} onCommit={onCommit} />,
    );
    expect(input.value).toBe('42');

    // Com foco (editando): rascunho local não deve ser sobrescrito.
    act(() => {
      input.focus();
    });
    fireEvent.change(input, { target: { value: '7' } });
    rerender(
      <PopoverQtyInput {...baseProps} quantity={99} onCommit={onCommit} />,
    );
    expect(input.value).toBe('7');
  });
});

describe('<PopoverQtyInput /> — feedback visual', () => {
  it('marca data-feedback=sanitized quando o usuário tenta digitar não-dígitos', () => {
    render(
      <PopoverQtyInput
        itemId="fb-1"
        productName="Item"
        quantity={5}
        onCommit={vi.fn()}
      />,
    );
    const input = screen.getByTestId('cart-item-qty-fb-1') as HTMLInputElement;
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '5a,3' } });
    expect(input.dataset.feedback).toBe('sanitized');
    expect(input.value).toBe('53');
  });

  it('marca data-feedback=clamped e propaga onCommit(MAX) quando digitado acima do limite', () => {
    const onCommit = vi.fn();
    render(
      <PopoverQtyInput
        itemId="fb-2"
        productName="Item"
        quantity={5}
        onCommit={onCommit}
      />,
    );
    const input = screen.getByTestId('cart-item-qty-fb-2') as HTMLInputElement;
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '9999999' } });
    fireEvent.blur(input);
    expect(onCommit).toHaveBeenCalledWith(999_999);
    expect(input.dataset.feedback).toBe('clamped');
  });

  it('marca data-feedback=invalid + aria-invalid ao comitar valor vazio', () => {
    render(
      <PopoverQtyInput
        itemId="fb-3"
        productName="Item"
        quantity={5}
        onCommit={vi.fn()}
      />,
    );
    const input = screen.getByTestId('cart-item-qty-fb-3') as HTMLInputElement;
    act(() => input.focus());
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);
    expect(input.dataset.feedback).toBe('invalid');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('feedback volta para idle após 700ms', () => {
    vi.useFakeTimers();
    try {
      render(
        <PopoverQtyInput
          itemId="fb-4"
          productName="Item"
          quantity={5}
          onCommit={vi.fn()}
        />,
      );
      const input = screen.getByTestId('cart-item-qty-fb-4') as HTMLInputElement;
      act(() => input.focus());
      fireEvent.change(input, { target: { value: '5a' } });
      expect(input.dataset.feedback).toBe('sanitized');
      act(() => {
        vi.advanceTimersByTime(750);
      });
      expect(input.dataset.feedback).toBe('idle');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('<PopoverQtyInput /> — integração com Total do pai (recalc)', () => {
  function Harness({ unitPrice = 92.16 }: { unitPrice?: number }) {
    const [qty, setQty] = useState(29);
    return (
      <div>
        <PopoverQtyInput
          itemId="int-1"
          productName="Item"
          quantity={qty}
          onCommit={setQty}
        />
        <span data-testid="int-total">{(unitPrice * qty).toFixed(2)}</span>
      </div>
    );
  }

  it('digitar 80 + Enter recalcula o Total no pai (simula fluxo do carrinho)', async () => {
    const user = userEvent.setup();
    render(<Harness unitPrice={92.16} />);
    const input = screen.getByTestId('cart-item-qty-int-1') as HTMLInputElement;
    const total = screen.getByTestId('int-total');

    expect(total.textContent).toBe((92.16 * 29).toFixed(2));

    await user.click(input);
    await user.keyboard('{Control>}a{/Control}80{Enter}');

    expect(total.textContent).toBe((92.16 * 80).toFixed(2));
    expect(input.value).toBe('80');
  });

  it('digitar 9999999 aplica clamp e o Total reflete MAX_QTY', () => {
    render(<Harness unitPrice={1} />);
    const input = screen.getByTestId('cart-item-qty-int-1') as HTMLInputElement;
    const total = screen.getByTestId('int-total');

    act(() => input.focus());
    fireEvent.change(input, { target: { value: '9999999' } });
    fireEvent.blur(input);

    expect(total.textContent).toBe((1 * MAX_QTY).toFixed(2));
  });
});
