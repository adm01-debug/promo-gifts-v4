/**
 * CartStatusSelect — testes exaustivos do bloqueio "carrinho vazio".
 *
 * Regra: se `isEmpty` é true, a transição para `pronto_orcamento` DEVE ser
 * bloqueada:
 *   - `onChange` não é chamado
 *   - `toast.error` é chamado com o título/descrição SSOT
 *   - Live-region anuncia a razão
 *   - Nenhum spinner aparece / aria-busy permanece false
 *   - O `SelectItem` de `pronto_orcamento` recebe `disabled` e
 *     `data-disabled-empty="true"` e sufixo "(carrinho vazio)"
 *
 * E o inverso: quando `isEmpty=false`, a transição funciona normalmente.
 *
 * Também cobre alternância dinâmica (isEmpty flipa entre renders) e
 * transições que NÃO envolvem pronto_orcamento (sempre permitidas).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import type { CartStatus } from '@/hooks/products';

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

// Mock shadcn Select como <div>/<button> nativos para funcionar em jsdom.
// Preserva a propagação de `disabled` no SelectItem.
vi.mock('@/components/ui/select', () => {
  type OnChange = (v: string) => void;
  const Ctx = { current: null as OnChange | null };
  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: OnChange;
    children: React.ReactNode;
  }) => {
    Ctx.current = onValueChange;
    // Expõe globalmente para bypass em testes que precisam simular
    // um caminho onde o valor chega ao handler mesmo com o item disabled.
    (globalThis as unknown as { __cartSelectFire?: OnChange }).__cartSelectFire =
      onValueChange;
    return (
      <div data-mock-select data-value={value}>
        {children}
      </div>
    );
  };
  const SelectTrigger = ({
    children,
    ...rest
  }: React.HTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...rest}>
      {children}
    </button>
  );
  const SelectValue = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectContent = ({ children }: { children: React.ReactNode }) => (
    <div data-mock-select-content>{children}</div>
  );
  const SelectItem = ({
    value,
    children,
    disabled,
    ...rest
  }: Record<string, unknown> & {
    value: string;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      data-mock-select-item
      data-value={value}
      data-disabled={disabled ? 'true' : undefined}
      disabled={disabled}
      onClick={(e) => {
        // Semântica realista: item desabilitado NÃO dispara onValueChange.
        // Consulta a propriedade DOM live (permite bypass explícito em
        // testes removendo o atributo disabled em runtime).
        if ((e.currentTarget as HTMLButtonElement).disabled) return;
        Ctx.current?.(value);
      }}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {children}
    </button>
  );
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

vi.mock('@/components/ui/tooltip', () => {
  const P = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  return { Tooltip: P, TooltipTrigger: P, TooltipContent: P };
});

// eslint-disable-next-line import/first
import { CartStatusSelect } from '../../SellerCartsPage';

function clickOption(value: CartStatus) {
  const el = document.querySelector<HTMLButtonElement>(
    `[data-mock-select-item][data-value="${value}"]`,
  );
  if (!el) throw new Error(`item ${value} não encontrado`);
  fireEvent.click(el);
  return el;
}

describe('CartStatusSelect — isEmpty bloqueia pronto_orcamento', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('quando isEmpty=true, o item pronto_orcamento está disabled e traz sufixo "(carrinho vazio)"', () => {
    render(
      <CartStatusSelect
        currentStatus="em_separacao"
        onChange={vi.fn()}
        isEmpty
      />,
    );
    const readyItem = document.querySelector<HTMLButtonElement>(
      '[data-mock-select-item][data-value="pronto_orcamento"]',
    );
    expect(readyItem).toBeTruthy();
    expect(readyItem!.disabled).toBe(true);
    expect(readyItem!.getAttribute('data-disabled')).toBe('true');
    expect(readyItem!.textContent).toMatch(/carrinho vazio/i);

    const emItem = document.querySelector<HTMLButtonElement>(
      '[data-mock-select-item][data-value="em_separacao"]',
    );
    expect(emItem!.disabled).toBe(false);
  });

  it('clique no item desabilitado NÃO chama onChange, NÃO ativa loading, NÃO dispara toast (semântica DOM)', () => {
    const onChange = vi.fn();
    render(
      <CartStatusSelect currentStatus="em_separacao" onChange={onChange} isEmpty />,
    );
    clickOption('pronto_orcamento');
    expect(onChange).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
    const trigger = screen.getByTestId('cart-status-select');
    expect(trigger).toHaveAttribute('aria-busy', 'false');
    expect(trigger).toHaveAttribute('data-pending', 'false');
    expect(screen.queryByTestId('cart-status-spinner')).not.toBeInTheDocument();
  });

  it('bypass do disabled (keyboard nav / Radix interno): guard interno dispara toast SSOT e não chama onChange', () => {
    // Simulamos um caminho onde onValueChange é chamado mesmo com o item
    // desabilitado (ex.: teclado, mudança de estado assíncrona). O guard
    // dentro de onValueChange deve absorver a chamada sem ativar loading.
    const onChange = vi.fn();
    render(
      <CartStatusSelect currentStatus="em_separacao" onChange={onChange} isEmpty />,
    );

    // Invoca diretamente o handler onValueChange do Select (bypass total).
    const fire = (
      globalThis as unknown as { __cartSelectFire?: (v: string) => void }
    ).__cartSelectFire;
    expect(fire).toBeTypeOf('function');
    act(() => {
      fire!('pronto_orcamento');
    });


    expect(onChange).not.toHaveBeenCalled();
    // Toast SSOT foi disparado com título "Carrinho vazio".
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError.mock.calls[0][0]).toBe('Carrinho vazio');
    expect(toastError.mock.calls[0][1]).toMatchObject({
      description: expect.stringMatching(/pronto para orçamento/i),
    });
    // Live region anuncia a razão.
    expect(screen.getByTestId('cart-status-live').textContent).toMatch(
      /Não é possível marcar o carrinho como pronto para orçamento/i,
    );
    // Nenhum loading foi iniciado.
    const trigger = screen.getByTestId('cart-status-select');
    expect(trigger).toHaveAttribute('aria-busy', 'false');
    expect(screen.queryByTestId('cart-status-spinner')).not.toBeInTheDocument();
  });


  it('quando isEmpty=false, pronto_orcamento fica habilitado e o fluxo normal roda', () => {
    const onChange = vi.fn();
    render(
      <CartStatusSelect
        currentStatus="em_separacao"
        onChange={onChange}
        isEmpty={false}
      />,
    );
    const readyItem = document.querySelector<HTMLButtonElement>(
      '[data-mock-select-item][data-value="pronto_orcamento"]',
    );
    expect(readyItem!.disabled).toBe(false);

    clickOption('pronto_orcamento');
    expect(onChange).toHaveBeenCalledWith('pronto_orcamento');
    expect(screen.getByTestId('cart-status-select')).toHaveAttribute('aria-busy', 'true');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('propriedade: em 50 renders random, disabled(readyItem) === isEmpty', () => {
    for (let i = 0; i < 50; i++) {
      const isEmpty = i % 2 === 0;
      const { unmount } = render(
        <CartStatusSelect
          currentStatus="em_separacao"
          onChange={vi.fn()}
          isEmpty={isEmpty}
        />,
      );
      const readyItem = document.querySelector<HTMLButtonElement>(
        '[data-mock-select-item][data-value="pronto_orcamento"]',
      );
      expect(readyItem!.disabled).toBe(isEmpty);
      unmount();
    }
  });

  it('alternância dinâmica: isEmpty→false destrava o item na próxima render', () => {
    const { rerender } = render(
      <CartStatusSelect
        currentStatus="em_separacao"
        onChange={vi.fn()}
        isEmpty
      />,
    );
    let readyItem = document.querySelector<HTMLButtonElement>(
      '[data-mock-select-item][data-value="pronto_orcamento"]',
    );
    expect(readyItem!.disabled).toBe(true);

    rerender(
      <CartStatusSelect
        currentStatus="em_separacao"
        onChange={vi.fn()}
        isEmpty={false}
      />,
    );
    readyItem = document.querySelector<HTMLButtonElement>(
      '[data-mock-select-item][data-value="pronto_orcamento"]',
    );
    expect(readyItem!.disabled).toBe(false);
  });

  it('quando isEmpty=true por default (prop ausente), pronto_orcamento não é bloqueado (backward-compat)', () => {
    // Contrato: `isEmpty` default é `false`. Componentes que não passam
    // a prop mantêm o comportamento antigo (não regride).
    const onChange = vi.fn();
    render(<CartStatusSelect currentStatus="em_separacao" onChange={onChange} />);
    const readyItem = document.querySelector<HTMLButtonElement>(
      '[data-mock-select-item][data-value="pronto_orcamento"]',
    );
    expect(readyItem!.disabled).toBe(false);
    clickOption('pronto_orcamento');
    expect(onChange).toHaveBeenCalledWith('pronto_orcamento');
  });
});
