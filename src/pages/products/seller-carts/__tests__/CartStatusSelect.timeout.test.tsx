/**
 * CartStatusSelect — cenários extremos de `confirmTimeoutMs`.
 *
 * Foco: garantir que o timer de falha:
 *  A. É corretamente cancelado quando o alvo (`pending`) muda ANTES do timeout,
 *     evitando toasts de erro órfãos do alvo anterior.
 *  B. É reiniciado quando `confirmTimeoutMs` muda no meio de um pending.
 *  C. Suporta valores extremos: 0ms, negativos (clamp), muito grandes e mudanças
 *     bruscas de grande → pequeno (dispara imediatamente sob o novo valor).
 *  D. Ao desmontar durante pending, nenhum toast é emitido depois.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import type { CartStatus } from '@/hooks/products';

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

vi.mock('@/components/ui/select', () => {
  type OnChange = (v: string) => void;
  const Ctx: { current: OnChange | null } = { current: null };
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
  const SelectTrigger = (p: React.HTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...p} />
  );
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectItem = ({ value, children }: { value: string; children: React.ReactNode }) => (
    <button
      type="button"
      data-mock-select-item
      data-value={value}
      onClick={() => Ctx.current?.(value)}
    >
      {children}
    </button>
  );
  return {
    Select,
    SelectTrigger,
    SelectValue: Pass,
    SelectContent: Pass,
    SelectItem,
  };
});
vi.mock('@/components/ui/tooltip', () => {
  const P = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  return { Tooltip: P, TooltipTrigger: P, TooltipContent: P };
});

import { CartStatusSelect } from '../../SellerCartsPage';

function click(v: CartStatus) {
  const el = document.querySelector<HTMLElement>(`[data-mock-select-item][data-value="${v}"]`);
  if (el) fireEvent.click(el);
}
function trigger() {
  return screen.getByTestId('cart-status-select');
}

describe('CartStatusSelect · timeout extremes', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('A · não emite toast.error quando currentStatus confirma antes do timeout', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CartStatusSelect currentStatus="em_separacao" onChange={onChange} confirmTimeoutMs={2000} />,
    );
    click('pronto_orcamento');
    expect(trigger().getAttribute('aria-busy')).toBe('true');
    // Confirmação chega bem antes do timeout.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    rerender(
      <CartStatusSelect
        currentStatus="pronto_orcamento"
        onChange={onChange}
        confirmTimeoutMs={2000}
      />,
    );
    // Deixamos passar tempo muito maior que o timeout ORIGINAL.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
    expect(trigger().getAttribute('aria-busy')).toBe('false');
  });

  it('B · trocar confirmTimeoutMs de grande → pequeno durante pending dispara sob o novo valor', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CartStatusSelect
        currentStatus="em_separacao"
        onChange={onChange}
        confirmTimeoutMs={60_000}
      />,
    );
    click('pronto_orcamento');
    // Nada acontece nos primeiros 5s do timer grande.
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(toastError).not.toHaveBeenCalled();
    // Mudança de prop mid-pending: o timer anterior é cancelado e um novo, curto, é armado.
    rerender(
      <CartStatusSelect currentStatus="em_separacao" onChange={onChange} confirmTimeoutMs={500} />,
    );
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(toastError).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(toastError).toHaveBeenCalledTimes(1);
    // Só um erro — o timer grande foi cancelado.
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('B2 · trocar confirmTimeoutMs de pequeno → grande durante pending reinicia o timer', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CartStatusSelect currentStatus="em_separacao" onChange={onChange} confirmTimeoutMs={1000} />,
    );
    click('pronto_orcamento');
    act(() => {
      vi.advanceTimersByTime(900);
    });
    // Sobe o timeout — timer antigo cancelado, novo de 10s começa AGORA.
    rerender(
      <CartStatusSelect
        currentStatus="em_separacao"
        onChange={onChange}
        confirmTimeoutMs={10_000}
      />,
    );
    // Passa muito do original (1000ms) — como o timer reiniciou, ainda não deu erro.
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(toastError).not.toHaveBeenCalled();
    // Só dispara ao completar 10s desde o rerender.
    act(() => {
      vi.advanceTimersByTime(5_001);
    });
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('C1 · confirmTimeoutMs=0 dispara toast.error na próxima tick', () => {
    const onChange = vi.fn();
    render(
      <CartStatusSelect currentStatus="em_separacao" onChange={onChange} confirmTimeoutMs={0} />,
    );
    click('pronto_orcamento');
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('C2 · confirmTimeoutMs negativo é clamped para 0 e ainda dispara uma única vez', () => {
    const onChange = vi.fn();
    render(
      <CartStatusSelect
        currentStatus="em_separacao"
        onChange={onChange}
        confirmTimeoutMs={-9999}
      />,
    );
    click('pronto_orcamento');
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(toastError).toHaveBeenCalledTimes(1);
    // Não dispara de novo com o passar do tempo.
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('C3 · confirmTimeoutMs muito grande (~24 dias, dentro do limite de setTimeout) não dispara em janela razoável', () => {
    // NOTE: `setTimeout` em Node/jsdom clamps delays > 2^31-1 ms para 1ms (spec HTML).
    // Usamos ~24 dias, o maior valor SEGURO, para simular "timeout praticamente infinito".
    const HUGE = 2_000_000_000; // ~23.1 dias
    const onChange = vi.fn();
    render(
      <CartStatusSelect currentStatus="em_separacao" onChange={onChange} confirmTimeoutMs={HUGE} />,
    );
    click('pronto_orcamento');
    act(() => {
      vi.advanceTimersByTime(24 * 60 * 60 * 1000); // 24h
    });
    expect(toastError).not.toHaveBeenCalled();
    expect(trigger().getAttribute('aria-busy')).toBe('true');
  });

  it('D · desmontar durante pending com timeout enorme não emite toasts depois', () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <CartStatusSelect
        currentStatus="em_separacao"
        onChange={onChange}
        confirmTimeoutMs={5_000}
      />,
    );
    click('pronto_orcamento');
    unmount();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('E · múltiplas mudanças de confirmTimeoutMs em sequência mantêm no máximo 1 toast.error', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <CartStatusSelect
        currentStatus="em_separacao"
        onChange={onChange}
        confirmTimeoutMs={5_000}
      />,
    );
    click('pronto_orcamento');
    for (const t of [4_000, 3_000, 2_000, 1_000, 500]) {
      rerender(
        <CartStatusSelect currentStatus="em_separacao" onChange={onChange} confirmTimeoutMs={t} />,
      );
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
    // Deixa o último (500ms) expirar completamente.
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(toastError).toHaveBeenCalledTimes(1);
    // E não emite mais nada depois.
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(toastError).toHaveBeenCalledTimes(1);
  });
});
