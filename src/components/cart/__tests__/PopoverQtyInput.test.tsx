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

describe('<PopoverQtyInput /> — mensagens e a11y do feedback', () => {
  const renderWithFeedback = (
    itemId: string,
    initial: number,
    action: (input: HTMLInputElement) => void,
  ) => {
    render(
      <PopoverQtyInput
        itemId={itemId}
        productName="Caneta Neon"
        quantity={initial}
        onCommit={vi.fn()}
      />,
    );
    const input = screen.getByTestId(`cart-item-qty-${itemId}`) as HTMLInputElement;
    act(() => input.focus());
    action(input);
    return input;
  };

  it('emite mensagem role=status com aria-live=polite ao digitar caracteres inválidos', () => {
    renderWithFeedback('a11y-1', 5, (i) =>
      fireEvent.change(i, { target: { value: '5,a' } }),
    );
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status.textContent).toMatch(/apenas dígitos/i);
  });

  it('mensagem correta ao clamp para 999.999', () => {
    renderWithFeedback('a11y-2', 5, (i) => {
      fireEvent.change(i, { target: { value: '9999999' } });
      fireEvent.blur(i);
    });
    expect(screen.getByRole('status').textContent).toMatch(/999\.999/);
  });

  it('mensagem correta + aria-invalid=true quando o commit é inválido', () => {
    const input = renderWithFeedback('a11y-3', 5, (i) => {
      fireEvent.change(i, { target: { value: '' } });
      fireEvent.blur(i);
    });
    expect(screen.getByRole('status').textContent).toMatch(/inválido/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute(
      'aria-describedby',
      'cart-item-qty-fb-a11y-3',
    );
  });

  it('sem feedback: input NÃO expõe aria-invalid nem describedby', () => {
    render(
      <PopoverQtyInput
        itemId="a11y-4"
        productName="Item"
        quantity={5}
        onCommit={vi.fn()}
      />,
    );
    const input = screen.getByTestId('cart-item-qty-a11y-4') as HTMLInputElement;
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('<PopoverQtyInput /> — limites exatos [1, 999999, 9999999, 0]', () => {
  function BoundaryHarness({ unitPrice = 10 }: { unitPrice?: number }) {
    const [qty, setQty] = useState(50);
    return (
      <div>
        <PopoverQtyInput
          itemId="bnd"
          productName="Item"
          quantity={qty}
          onCommit={setQty}
        />
        <span data-testid="bnd-total">{(unitPrice * qty).toFixed(2)}</span>
        <span data-testid="bnd-qty">{qty}</span>
      </div>
    );
  }

  const setAndCommit = (value: string) => {
    const input = screen.getByTestId('cart-item-qty-bnd') as HTMLInputElement;
    act(() => input.focus());
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
    return input;
  };

  it('boundary 1: commit → qty=1, Total=1×preço', () => {
    render(<BoundaryHarness unitPrice={10} />);
    setAndCommit('1');
    expect(screen.getByTestId('bnd-qty').textContent).toBe('1');
    expect(screen.getByTestId('bnd-total').textContent).toBe('10.00');
  });

  it('boundary 999999: commit exato, sem clamp', () => {
    render(<BoundaryHarness unitPrice={2} />);
    const input = setAndCommit('999999');
    expect(screen.getByTestId('bnd-qty').textContent).toBe('999999');
    expect(screen.getByTestId('bnd-total').textContent).toBe(
      (2 * 999_999).toFixed(2),
    );
    // Não dispara clamp porque o valor bate exatamente no MAX.
    expect(input.dataset.feedback).not.toBe('clamped');
  });

  it('boundary 9999999: clamp em 999.999 e Total reflete o MAX', () => {
    render(<BoundaryHarness unitPrice={2} />);
    const input = setAndCommit('9999999');
    expect(screen.getByTestId('bnd-qty').textContent).toBe('999999');
    expect(screen.getByTestId('bnd-total').textContent).toBe(
      (2 * 999_999).toFixed(2),
    );
    expect(input.dataset.feedback).toBe('clamped');
  });

  it('boundary 0: revertido para o último valor válido (50), sem alterar Total', () => {
    render(<BoundaryHarness unitPrice={10} />);
    const input = setAndCommit('0');
    expect(screen.getByTestId('bnd-qty').textContent).toBe('50');
    expect(screen.getByTestId('bnd-total').textContent).toBe('500.00');
    expect(input.dataset.feedback).toBe('invalid');
    expect(input.value).toBe('50');
  });
});

describe('<PopoverQtyInput /> — múltiplos itens no mesmo carrinho', () => {
  function MultiHarness() {
    const [a, setA] = useState(2);
    const [b, setB] = useState(10);
    return (
      <div>
        <PopoverQtyInput
          itemId="m-a"
          productName="Item A"
          quantity={a}
          onCommit={setA}
          autoFocus
        />
        <span data-testid="total-a">{(50 * a).toFixed(2)}</span>
        <PopoverQtyInput
          itemId="m-b"
          productName="Item B"
          quantity={b}
          onCommit={setB}
        />
        <span data-testid="total-b">{(30 * b).toFixed(2)}</span>
      </div>
    );
  }

  it('cada item atualiza seu próprio Total sem afetar os outros', async () => {
    const user = userEvent.setup();
    render(<MultiHarness />);
    const inputA = screen.getByTestId('cart-item-qty-m-a') as HTMLInputElement;
    const inputB = screen.getByTestId('cart-item-qty-m-b') as HTMLInputElement;

    // A ganha autoFocus automaticamente
    expect(document.activeElement).toBe(inputA);

    await user.keyboard('{Control>}a{/Control}80{Enter}');
    expect(screen.getByTestId('total-a').textContent).toBe((50 * 80).toFixed(2));
    expect(screen.getByTestId('total-b').textContent).toBe((30 * 10).toFixed(2));

    await user.click(inputB);
    await user.keyboard('{Control>}a{/Control}999999{Enter}');
    expect(screen.getByTestId('total-b').textContent).toBe(
      (30 * 999_999).toFixed(2),
    );
    // A permaneceu em 80
    expect(screen.getByTestId('total-a').textContent).toBe((50 * 80).toFixed(2));
  });

  it('Tab move o foco do item A para o item B (sem travar)', async () => {
    const user = userEvent.setup();
    render(<MultiHarness />);
    const inputA = screen.getByTestId('cart-item-qty-m-a') as HTMLInputElement;
    const inputB = screen.getByTestId('cart-item-qty-m-b') as HTMLInputElement;

    expect(document.activeElement).toBe(inputA);
    await user.tab();
    expect(document.activeElement).toBe(inputB);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(inputA);
  });
});

describe('<PopoverQtyInput /> — limites 1/999999/9999999/0 em itens distintos', () => {
  function FourItemHarness() {
    const unitPrices = [10, 2, 3, 5];
    const initial = [50, 50, 50, 50];
    const [qs, setQs] = useState<number[]>(initial);
    const setAt = (idx: number, v: number) =>
      setQs((prev) => prev.map((x, i) => (i === idx ? v : x)));
    return (
      <div>
        {unitPrices.map((price, idx) => (
          <div key={idx}>
            <PopoverQtyInput
              itemId={`bnd-${idx}`}
              productName={`Item ${idx}`}
              quantity={qs[idx]}
              onCommit={(next) => setAt(idx, next)}
            />
            <span data-testid={`bnd-qty-${idx}`}>{qs[idx]}</span>
            <span data-testid={`bnd-total-${idx}`}>{(price * qs[idx]).toFixed(2)}</span>
          </div>
        ))}
      </div>
    );
  }

  it('cada item mantém quantidade e Total consistentes após 1 / 999999 / 9999999 / 0', () => {
    render(<FourItemHarness />);
    const boundaries = [
      { idx: 0, input: '1', expected: 1, unit: 10 },
      { idx: 1, input: '999999', expected: 999_999, unit: 2 },
      { idx: 2, input: '9999999', expected: 999_999, unit: 3 },
      { idx: 3, input: '0', expected: 50, unit: 5 }, // revertido
    ];

    for (const b of boundaries) {
      const input = screen.getByTestId(`cart-item-qty-bnd-${b.idx}`) as HTMLInputElement;
      act(() => input.focus());
      fireEvent.change(input, { target: { value: b.input } });
      fireEvent.blur(input);
    }

    for (const b of boundaries) {
      expect(screen.getByTestId(`bnd-qty-${b.idx}`).textContent).toBe(String(b.expected));
      expect(screen.getByTestId(`bnd-total-${b.idx}`).textContent).toBe(
        (b.unit * b.expected).toFixed(2),
      );
    }

    // Feedback semântico por item, cada um refletindo seu próprio caso.
    expect(
      (screen.getByTestId('cart-item-qty-bnd-0') as HTMLInputElement).dataset.feedback,
    ).not.toBe('clamped');
    expect(
      (screen.getByTestId('cart-item-qty-bnd-1') as HTMLInputElement).dataset.feedback,
    ).not.toBe('clamped');
    expect(
      (screen.getByTestId('cart-item-qty-bnd-2') as HTMLInputElement).dataset.feedback,
    ).toBe('clamped');
    expect(
      (screen.getByTestId('cart-item-qty-bnd-3') as HTMLInputElement).dataset.feedback,
    ).toBe('invalid');
  });
});


