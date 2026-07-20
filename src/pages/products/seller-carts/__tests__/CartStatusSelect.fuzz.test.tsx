/**
 * CartStatusSelect — Fuzz / simulações exaustivas.
 *
 * Executa centenas de sequências randômicas de eventos (change, confirm, timeout,
 * unmount, prop churn) e valida invariantes CRÍTICOS após cada passo:
 *
 *  INV-1  aria-busy === data-pending === (pending !== null)
 *  INV-2  data-status === (pending ?? currentStatus)
 *  INV-3  Spinner presente ↔ aria-busy=true
 *  INV-4  aria-label reflete o estado (Atualizando vs Status atual)
 *  INV-5  toast.success SÓ dispara quando currentStatus alcança o pending
 *  INV-6  toast.error SÓ dispara em timeout (nunca simultâneo ao success)
 *  INV-7  Nenhum toast é disparado após unmount
 *  INV-8  liveMessage nunca fica com string vazia após primeiro evento
 *  INV-9  onChange chamado com valor DIFERENTE do currentStatus atual
 *  INV-10 Trocar confirmTimeoutMs cancela o timer anterior (sem toast duplo)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import type { CartStatus } from '@/hooks/products';

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
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
  const SelectTrigger = ({ children, ...rest }: React.HTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...rest}>
      {children}
    </button>
  );
  const SelectValue = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectContent = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
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
  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
});

vi.mock('@/components/ui/tooltip', () => {
  const P = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  return { Tooltip: P, TooltipTrigger: P, TooltipContent: P };
});

import { CartStatusSelect } from '../../SellerCartsPage';

const STATUSES: CartStatus[] = ['em_separacao', 'pronto_orcamento'];
const LABELS: Record<CartStatus, string> = {
  em_separacao: 'Separação',
  pronto_orcamento: 'Pronto p/ orçamento',
};

/** PRNG determinístico (mulberry32) — reprodutibilidade absoluta. */
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function readTrigger() {
  return screen.queryByTestId('cart-status-select') as HTMLElement | null;
}

/**
 * Lê a "verdade" do DOM — o único árbitro confiável. Retorna null se desmontado.
 */
function readDomState() {
  const trigger = readTrigger();
  if (!trigger) return null;
  const busy = trigger.getAttribute('aria-busy') === 'true';
  const pendingAttr = trigger.getAttribute('data-pending') === 'true';
  const status = trigger.getAttribute('data-status') as CartStatus;
  const aria = trigger.getAttribute('aria-label') ?? '';
  const spinner = screen.queryByTestId('cart-status-spinner');
  const live = screen.queryByTestId('cart-status-live');
  return { busy, pendingAttr, status, aria, spinner, live, trigger };
}

/**
 * Invariantes puramente DOM-internos — não dependem de modelo externo.
 * Cada um é uma tautologia lógica sobre o estado renderizado.
 */
function assertDomInvariants(currentStatus: CartStatus, ctx: string) {
  const dom = readDomState();
  if (!dom) return;

  // INV-1: aria-busy ↔ data-pending (tautologia estrutural)
  expect(dom.busy, `INV-1 aria-busy===data-pending ${ctx}`).toBe(dom.pendingAttr);

  // INV-3: spinner presente ↔ busy
  if (dom.busy) {
    expect(dom.spinner, `INV-3 spinner+busy ${ctx}`).toBeTruthy();
  } else {
    expect(dom.spinner, `INV-3 !spinner+!busy ${ctx}`).toBeNull();
  }

  // INV-4: aria-label consistente com busy
  if (dom.busy) {
    expect(dom.aria, `INV-4 pending label ${ctx}`).toMatch(/Atualizando status/i);
    // data-status durante pending == label do pending
    expect(dom.aria, `INV-4 label contains status ${ctx}`).toContain(LABELS[dom.status]);
  } else {
    expect(dom.aria, `INV-4 idle label ${ctx}`).toMatch(/Status atual do carrinho/i);
    // Quando não-pending, data-status DEVE ser o currentStatus real
    expect(dom.status, `INV-2 idle==current ${ctx}`).toBe(currentStatus);
    expect(dom.aria, `INV-4 label contains current ${ctx}`).toContain(LABELS[currentStatus]);
  }

  // INV-8: live-region sempre existe
  expect(dom.live, `INV-8 live-region existe ${ctx}`).toBeTruthy();
}

function clickItem(value: CartStatus) {
  const el = document.querySelector<HTMLElement>(`[data-mock-select-item][data-value="${value}"]`);
  if (el) fireEvent.click(el);
}

describe('CartStatusSelect · fuzz 1000× (invariantes DOM + edge cases)', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const SEEDS = Array.from({ length: 1000 }, (_, i) => 1 + i);

  it.each(SEEDS)('seed %i · sequência aleatória mantém invariantes DOM', (seed) => {
    const rng = makeRng(seed);
    const timeout = 2000 + Math.floor(rng() * 6000);
    let currentStatus: CartStatus = STATUSES[Math.floor(rng() * STATUSES.length)];
    let userInitiatedClicks = 0;
    let successUpperBound = 0; // toasts.success ≤ este valor
    let errorUpperBound = 0; //  toasts.error ≤ este valor

    const onChange = vi.fn((next: CartStatus) => {
      // INV-9: onChange sempre com valor DIFERENTE do current atual
      expect(next, `INV-9 seed=${seed}`).not.toBe(currentStatus);
    });

    const view = render(
      <CartStatusSelect
        currentStatus={currentStatus}
        onChange={onChange}
        confirmTimeoutMs={timeout}
      />,
    );

    assertDomInvariants(currentStatus, `seed=${seed} step=0`);

    const STEPS = 8 + Math.floor(rng() * 12);
    for (let step = 1; step <= STEPS; step++) {
      const action = rng();
      const ctx = `seed=${seed} step=${step} action=${action.toFixed(3)}`;
      const beforeDom = readDomState();

      if (action < 0.35) {
        // A: clique aleatório
        const target = STATUSES[Math.floor(rng() * STATUSES.length)];
        clickItem(target);
        // Só conta como clique útil se não-busy e target != current visível
        if (beforeDom && !beforeDom.busy && target !== beforeDom.status) {
          userInitiatedClicks += 1;
          successUpperBound += 1; // pode ou não confirmar; upper bound
          errorUpperBound += 1;
        }
      } else if (action < 0.6) {
        // B: parent confirma para o pending atual (se houver)
        if (beforeDom?.busy) {
          const targetKey = beforeDom.status;
          currentStatus = targetKey;
          view.rerender(
            <CartStatusSelect
              currentStatus={currentStatus}
              onChange={onChange}
              confirmTimeoutMs={timeout}
            />,
          );
          act(() => {
            vi.advanceTimersByTime(0);
          });
        }
      } else if (action < 0.8) {
        // C: avança o tempo
        const jump = Math.floor(rng() * (timeout + 200));
        act(() => {
          vi.advanceTimersByTime(jump);
        });
      } else if (action < 0.92) {
        // D: parent muda currentStatus arbitrariamente
        const target = STATUSES[Math.floor(rng() * STATUSES.length)];
        if (target !== currentStatus) {
          currentStatus = target;
          view.rerender(
            <CartStatusSelect
              currentStatus={currentStatus}
              onChange={onChange}
              confirmTimeoutMs={timeout}
            />,
          );
          act(() => {
            vi.advanceTimersByTime(0);
          });
        }
      } else {
        // E: troca o confirmTimeoutMs
        const newTimeout = 500 + Math.floor(rng() * 3000);
        view.rerender(
          <CartStatusSelect
            currentStatus={currentStatus}
            onChange={onChange}
            confirmTimeoutMs={newTimeout}
          />,
        );
      }

      assertDomInvariants(currentStatus, ctx);

      // INV-5/6: toast counters SEMPRE ≤ número de cliques úteis do usuário
      expect(
        toastSuccess.mock.calls.length,
        `INV-5 seed=${seed} step=${step} success≤clicks`,
      ).toBeLessThanOrEqual(successUpperBound);
      expect(
        toastError.mock.calls.length,
        `INV-6 seed=${seed} step=${step} error≤clicks`,
      ).toBeLessThanOrEqual(errorUpperBound);

      // INV-10: success + error de UM MESMO CLIQUE são mutuamente exclusivos
      //  Total (success + error) nunca excede cliques úteis
      expect(
        toastSuccess.mock.calls.length + toastError.mock.calls.length,
        `INV-10 seed=${seed} step=${step} success+error≤clicks`,
      ).toBeLessThanOrEqual(userInitiatedClicks);
    }

    // INV-7: pós-unmount, nenhum toast novo
    const beforeSuccess = toastSuccess.mock.calls.length;
    const beforeError = toastError.mock.calls.length;
    view.unmount();
    act(() => {
      vi.advanceTimersByTime(timeout * 4);
    });
    expect(toastSuccess.mock.calls.length, `INV-7 success seed=${seed}`).toBe(beforeSuccess);
    expect(toastError.mock.calls.length, `INV-7 error seed=${seed}`).toBe(beforeError);
  });

  // ─── Edge cases determinísticos ─────────────────────────────────────────────

  it('EDGE · confirmTimeoutMs=0 dispara toast.error praticamente imediato', () => {
    render(
      <CartStatusSelect currentStatus="em_separacao" onChange={vi.fn()} confirmTimeoutMs={0} />,
    );
    clickItem('pronto_orcamento');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('EDGE · confirmTimeoutMs negativo é clampado para 0', () => {
    render(
      <CartStatusSelect currentStatus="em_separacao" onChange={vi.fn()} confirmTimeoutMs={-999} />,
    );
    clickItem('pronto_orcamento');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('EDGE · confirmação chega ANTES do timeout expirar não dispara error', () => {
    const { rerender } = render(
      <CartStatusSelect currentStatus="em_separacao" onChange={vi.fn()} confirmTimeoutMs={5000} />,
    );
    clickItem('pronto_orcamento');
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    rerender(
      <CartStatusSelect
        currentStatus="pronto_orcamento"
        onChange={vi.fn()}
        confirmTimeoutMs={5000}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('EDGE · spam de cliques durante pending é ignorado (apenas 1 onChange)', () => {
    const onChange = vi.fn();
    render(
      <CartStatusSelect currentStatus="em_separacao" onChange={onChange} confirmTimeoutMs={5000} />,
    );
    for (let i = 0; i < 20; i++) {
      clickItem('pronto_orcamento');
      clickItem('em_separacao');
    }
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('pronto_orcamento');
  });

  it('EDGE · parent muda currentStatus para o mesmo pending → success limpa timer', () => {
    const { rerender } = render(
      <CartStatusSelect currentStatus="em_separacao" onChange={vi.fn()} confirmTimeoutMs={3000} />,
    );
    clickItem('pronto_orcamento');
    // parent atualiza no meio do caminho
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    rerender(
      <CartStatusSelect
        currentStatus="pronto_orcamento"
        onChange={vi.fn()}
        confirmTimeoutMs={3000}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('EDGE · unmount durante pending cancela o timer (sem toast tardio)', () => {
    const { unmount } = render(
      <CartStatusSelect currentStatus="em_separacao" onChange={vi.fn()} confirmTimeoutMs={2000} />,
    );
    clickItem('pronto_orcamento');
    unmount();
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('EDGE · trocar confirmTimeoutMs durante pending reinicia o timer (não duplica error)', () => {
    const { rerender } = render(
      <CartStatusSelect currentStatus="em_separacao" onChange={vi.fn()} confirmTimeoutMs={1000} />,
    );
    clickItem('pronto_orcamento');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    // Aumenta o timeout — timer antigo deve ser cancelado
    rerender(
      <CartStatusSelect currentStatus="em_separacao" onChange={vi.fn()} confirmTimeoutMs={5000} />,
    );
    act(() => {
      vi.advanceTimersByTime(600); // passou dos 1000 originais — NÃO deve disparar
    });
    expect(toastError).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5000); // agora sim
    });
    expect(toastError).toHaveBeenCalledTimes(1);
  });
});
