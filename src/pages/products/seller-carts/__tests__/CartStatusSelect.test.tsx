/**
 * CartStatusSelect — testes de integração do feedback visual e a11y.
 *
 * Cobre:
 *   1) Ao alterar o valor, o spinner aparece e o live-region anuncia início.
 *   2) Ao rerenderizar com currentStatus = pending, toast.success é chamado.
 *   3) Se a mutação não confirmar antes do timeout, toast.error é chamado e o
 *      estado de loading é limpo.
 *   4) aria-label reflete o estado atual e o estado de loading.
 *   5) aria-busy alterna corretamente durante o pending.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import type { CartStatus } from '@/hooks/products';

// Mock sonner para inspecionar toasts.
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

// Mock do shadcn Select para um <select> nativo — Radix Select depende de
// PointerEvent/ResizeObserver que não existem em jsdom.
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
  }: {
    value: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      data-mock-select-item
      data-value={value}
      onClick={() => Ctx.current?.(value)}
    >
      {children}
    </button>
  );
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

// Tooltip mock — apenas passa children.
vi.mock('@/components/ui/tooltip', () => {
  const Passthrough = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  return {
    Tooltip: Passthrough,
    TooltipTrigger: Passthrough,
    TooltipContent: Passthrough,
  };
});

// Importado depois dos mocks.
// eslint-disable-next-line import/first
import { CartStatusSelect } from '../../SellerCartsPage';

describe('CartStatusSelect', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(initial: CartStatus = 'em_separacao') {
    const onChange = vi.fn();
    const utils = render(
      <CartStatusSelect currentStatus={initial} onChange={onChange} confirmTimeoutMs={4000} />,
    );
    return { onChange, ...utils };
  }

  it('exibe o rótulo do status atual e aria-label descritivo', () => {
    setup('em_separacao');
    const trigger = screen.getByTestId('cart-status-select');
    expect(trigger).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Status atual do carrinho: Separação'),
    );
    expect(trigger).toHaveAttribute('aria-busy', 'false');
    expect(trigger).toHaveAttribute('data-pending', 'false');
  });

  it('ao trocar de status, mostra spinner, aria-busy=true e chama onChange', () => {
    const { onChange } = setup('em_separacao');
    const target = screen
      .getAllByTestId(/^cart-status-select$|mock-select-item$/)
      .find((el) => el.getAttribute('data-value') === 'pronto_orcamento');
    // fallback: buscar por data-mock-select-item com valor
    const item =
      target ??
      document.querySelector<HTMLElement>('[data-mock-select-item][data-value="pronto_orcamento"]');
    expect(item).toBeTruthy();
    fireEvent.click(item!);

    expect(onChange).toHaveBeenCalledWith('pronto_orcamento');
    const trigger = screen.getByTestId('cart-status-select');
    expect(trigger).toHaveAttribute('aria-busy', 'true');
    expect(trigger).toHaveAttribute('data-pending', 'true');
    expect(screen.getByTestId('cart-status-spinner')).toBeInTheDocument();
    // aria-label troca para o modo "Atualizando"
    expect(trigger.getAttribute('aria-label')).toMatch(/Atualizando status/i);
    // Live region anuncia início
    expect(screen.getByTestId('cart-status-live').textContent).toMatch(/Atualizando status/i);
  });

  it('quando currentStatus confirma o pending, dispara toast.success e limpa loading', () => {
    const { rerender } = setup('em_separacao');
    fireEvent.click(
      document.querySelector<HTMLElement>('[data-mock-select-item][data-value="pronto_orcamento"]')!,
    );
    expect(screen.getByTestId('cart-status-select')).toHaveAttribute('aria-busy', 'true');

    // Simula o hook confirmando a mudança.
    rerender(
      <CartStatusSelect
        currentStatus="pronto_orcamento"
        onChange={vi.fn()}
        confirmTimeoutMs={4000}
      />,
    );

    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastSuccess.mock.calls[0][0]).toMatch(/Pronto p\/ orçamento/);
    const trigger = screen.getByTestId('cart-status-select');
    expect(trigger).toHaveAttribute('aria-busy', 'false');
    expect(trigger).toHaveAttribute('data-pending', 'false');
    expect(trigger).toHaveAttribute('data-status', 'pronto_orcamento');
    // aria-label volta ao formato de "Status atual: <novo label>".
    expect(trigger.getAttribute('aria-label')).toMatch(
      /Status atual do carrinho:\s*Pronto p\/ orçamento/i,
    );
    expect(screen.queryByTestId('cart-status-spinner')).not.toBeInTheDocument();
    // Live-region reflete a confirmação da atualização.
    expect(screen.getByTestId('cart-status-live').textContent).toMatch(
      /Status atualizado para Pronto p\/ orçamento/i,
    );
  });

  it('se a mutação não confirmar antes do timeout, exibe toast.error e reseta o loading', () => {
    setup('em_separacao');
    fireEvent.click(
      document.querySelector<HTMLElement>('[data-mock-select-item][data-value="pronto_orcamento"]')!,
    );
    expect(screen.getByTestId('cart-status-select')).toHaveAttribute('aria-busy', 'true');

    act(() => {
      vi.advanceTimersByTime(4001);
    });

    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError.mock.calls[0][0]).toMatch(/Não foi possível atualizar o status/i);
    const trigger = screen.getByTestId('cart-status-select');
    expect(trigger).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByTestId('cart-status-live').textContent).toMatch(
      /Não foi possível atualizar o status para Pronto p\/ orçamento/i,
    );
  });

  it('ignora seleção do mesmo valor (não vira loading)', () => {
    const { onChange } = setup('em_separacao');
    fireEvent.click(
      document.querySelector<HTMLElement>('[data-mock-select-item][data-value="em_separacao"]')!,
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('cart-status-select')).toHaveAttribute('aria-busy', 'false');
  });
});
