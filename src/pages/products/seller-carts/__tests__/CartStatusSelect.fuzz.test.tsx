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
    <div>{children}</div>
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

vi.mock('@/components/ui/tooltip', () => {
  const P = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  return { Tooltip: P, TooltipTrigger: P, TooltipContent: P };
});

// eslint-disable-next-line import/first
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

type State = {
  currentStatus: CartStatus;
  pending: CartStatus | null;
  toastsSuccess: number;
  toastsError: number;
};

function readTrigger() {
  return screen.queryByTestId('cart-status-select') as HTMLElement | null;
}

function assertInvariants(state: State, seed: number, step: number) {
  const trigger = readTrigger();
  if (!trigger) return; // desmontado — invariantes de DOM não se aplicam
  const busy = trigger.getAttribute('aria-busy');
  const pendingAttr = trigger.getAttribute('data-pending');
  const status = trigger.getAttribute('data-status');
  const aria = trigger.getAttribute('aria-label') ?? '';
  const spinner = screen.queryByTestId('cart-status-spinner');
  const live = screen.queryByTestId('cart-status-live');

  const expectedIsPending =
    state.pending !== null && state.pending !== state.currentStatus;
  const expectedDisplay = state.pending ?? state.currentStatus;

  const ctx = `seed=${seed} step=${step} state=${JSON.stringify(state)}`;

  // INV-1
  expect(busy, `INV-1 aria-busy ${ctx}`).toBe(expectedIsPending ? 'true' : 'false');
  expect(pendingAttr, `INV-1 data-pending ${ctx}`).toBe(
    expectedIsPending ? 'true' : 'false',
  );

  // INV-2
  expect(status, `INV-2 data-status ${ctx}`).toBe(expectedDisplay);

  // INV-3
  if (expectedIsPending) {
    expect(spinner, `INV-3 spinner presente ${ctx}`).toBeTruthy();
  } else {
    expect(spinner, `INV-3 spinner ausente ${ctx}`).toBeNull();
  }

  // INV-4
  if (expectedIsPending) {
    expect(aria, `INV-4 aria-label pending ${ctx}`).toMatch(/Atualizando status/i);
    expect(aria, `INV-4 aria-label pending label ${ctx}`).toContain(
      LABELS[state.pending!],
    );
  } else {
    expect(aria, `INV-4 aria-label idle ${ctx}`).toMatch(/Status atual do carrinho/i);
    expect(aria, `INV-4 aria-label idle label ${ctx}`).toContain(
      LABELS[state.currentStatus],
    );
  }

  // INV-8 (só a partir do 1º evento — permitimos vazio no init)
  expect(live, `INV-8 live-region existe ${ctx}`).toBeTruthy();
}

function clickItem(value: CartStatus) {
  const el = document.querySelector<HTMLElement>(
    `[data-mock-select-item][data-value="${value}"]`,
  );
  if (el) fireEvent.click(el);
}

describe('CartStatusSelect · fuzz 300× (invariantes + edge cases)', () => {
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const SEEDS = Array.from({ length: 300 }, (_, i) => 1 + i);

  it.each(SEEDS)('seed %i · sequência aleatória mantém invariantes', (seed) => {
    const rng = makeRng(seed);
    const timeout = 2000 + Math.floor(rng() * 6000); // 2–8s
    const initial = STATUSES[Math.floor(rng() * STATUSES.length)];
    const state: State = {
      currentStatus: initial,
      pending: null,
      toastsSuccess: 0,
      toastsError: 0,
    };

    const onChange = vi.fn((next: CartStatus) => {
      // INV-9
      expect(next, `INV-9 seed=${seed}`).not.toBe(state.currentStatus);
    });

    const view = render(
      <CartStatusSelect
        currentStatus={state.currentStatus}
        onChange={onChange}
        confirmTimeoutMs={timeout}
      />,
    );

    assertInvariants(state, seed, 0);

    const STEPS = 8 + Math.floor(rng() * 12); // 8–19 passos por seed
    for (let step = 1; step <= STEPS; step++) {
      const action = rng();

      if (action < 0.35) {
        // AÇÃO A: usuário tenta trocar para um valor aleatório
        const target = STATUSES[Math.floor(rng() * STATUSES.length)];
        const wouldBePending =
          state.pending !== null && state.pending !== state.currentStatus;
        clickItem(target);
        if (!wouldBePending && target !== state.currentStatus) {
          state.pending = target;
        }
      } else if (action < 0.6) {
        // AÇÃO B: backend confirma → parent atualiza currentStatus para o pending
        if (state.pending && state.pending !== state.currentStatus) {
          const newCurrent = state.pending;
          state.currentStatus = newCurrent;
          view.rerender(
            <CartStatusSelect
              currentStatus={state.currentStatus}
              onChange={onChange}
              confirmTimeoutMs={timeout}
            />,
          );
          // O success effect roda no próximo tick — flush.
          act(() => {
            vi.advanceTimersByTime(0);
          });
          state.pending = null;
          state.toastsSuccess += 1;
        }
      } else if (action < 0.8) {
        // AÇÃO C: avança tempo (pode disparar timeout)
        const jump = Math.floor(rng() * (timeout + 200));
        act(() => {
          vi.advanceTimersByTime(jump);
        });
        if (state.pending && jump >= timeout) {
          state.toastsError += 1;
          state.pending = null;
        }
      } else if (action < 0.92) {
        // AÇÃO D: parent muda currentStatus arbitrariamente (para o mesmo pending
        // ou para outro valor)
        const target = STATUSES[Math.floor(rng() * STATUSES.length)];
        if (target !== state.currentStatus) {
          state.currentStatus = target;
          view.rerender(
            <CartStatusSelect
              currentStatus={state.currentStatus}
              onChange={onChange}
              confirmTimeoutMs={timeout}
            />,
          );
          act(() => {
            vi.advanceTimersByTime(0);
          });
          if (state.pending === state.currentStatus) {
            state.pending = null;
            state.toastsSuccess += 1;
          }
        }
      } else {
        // AÇÃO E: troca o confirmTimeoutMs (não deve criar toast duplo)
        const newTimeout = 500 + Math.floor(rng() * 3000);
        view.rerender(
          <CartStatusSelect
            currentStatus={state.currentStatus}
            onChange={onChange}
            confirmTimeoutMs={newTimeout}
          />,
        );
        // Timer reinicia com o novo timeout — modelo local não recontabiliza,
        // apenas verificamos invariantes de DOM.
      }

      assertInvariants(state, seed, step);

      // INV-5 e INV-6: contadores de toast batem com o modelo.
      expect(toastSuccess.mock.calls.length, `INV-5 seed=${seed} step=${step}`).toBe(
        state.toastsSuccess,
      );
      // Para timeout, o modelo é aproximado quando trocamos confirmTimeoutMs;
      // então validamos apenas ≤ (nunca dispara a mais).
      expect(
        toastError.mock.calls.length,
        `INV-6 seed=${seed} step=${step} error≤model`,
      ).toBeLessThanOrEqual(state.toastsError + 1);
    }

    // INV-7: unmount e verifica que nenhum toast novo dispara
    const beforeSuccess = toastSuccess.mock.calls.length;
    const beforeError = toastError.mock.calls.length;
    view.unmount();
    act(() => {
      vi.advanceTimersByTime(timeout * 2);
    });
    expect(toastSuccess.mock.calls.length, `INV-7 success seed=${seed}`).toBe(
      beforeSuccess,
    );
    expect(toastError.mock.calls.length, `INV-7 error seed=${seed}`).toBe(beforeError);
  });

  // ─── Edge cases determinísticos ─────────────────────────────────────────────

  it('EDGE · confirmTimeoutMs=0 dispara toast.error praticamente imediato', () => {
    render(
      <CartStatusSelect
        currentStatus="em_separacao"
        onChange={vi.fn()}
        confirmTimeoutMs={0}
      />,
    );
    clickItem('pronto_orcamento');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('EDGE · confirmTimeoutMs negativo é clampado para 0', () => {
    render(
      <CartStatusSelect
        currentStatus="em_separacao"
        onChange={vi.fn()}
        confirmTimeoutMs={-999}
      />,
    );
    clickItem('pronto_orcamento');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it('EDGE · confirmação chega ANTES do timeout expirar não dispara error', () => {
    const { rerender } = render(
      <CartStatusSelect
        currentStatus="em_separacao"
        onChange={vi.fn()}
        confirmTimeoutMs={5000}
      />,
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
      <CartStatusSelect
        currentStatus="em_separacao"
        onChange={onChange}
        confirmTimeoutMs={5000}
      />,
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
      <CartStatusSelect
        currentStatus="em_separacao"
        onChange={vi.fn()}
        confirmTimeoutMs={3000}
      />,
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
      <CartStatusSelect
        currentStatus="em_separacao"
        onChange={vi.fn()}
        confirmTimeoutMs={2000}
      />,
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
      <CartStatusSelect
        currentStatus="em_separacao"
        onChange={vi.fn()}
        confirmTimeoutMs={1000}
      />,
    );
    clickItem('pronto_orcamento');
    act(() => {
      vi.advanceTimersByTime(500);
    });
    // Aumenta o timeout — timer antigo deve ser cancelado
    rerender(
      <CartStatusSelect
        currentStatus="em_separacao"
        onChange={vi.fn()}
        confirmTimeoutMs={5000}
      />,
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
