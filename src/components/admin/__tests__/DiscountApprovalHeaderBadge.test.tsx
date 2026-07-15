import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DiscountApprovalHeaderBadge } from '../DiscountApprovalHeaderBadge';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, rolesLoaded: true }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => Promise.resolve({ count: 0, error: null }) }),
    }),
    channel: () => ({
      on () { return this; },
      subscribe () { return this; },
    }),
    removeChannel: vi.fn(),
  },
}));

const mockCount = vi.hoisted(() => ({ value: 3 }));
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({ data: mockCount.value }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

function renderBadge() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TooltipProvider delayDuration={0}>
          <DiscountApprovalHeaderBadge />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DiscountApprovalHeaderBadge', () => {
  beforeEach(() => {
    mockCount.value = 3;
  });

  it('renderiza ícone CircleDollarSign (lucide-circle-dollar-sign) e não Shield', () => {
    const { container } = renderBadge();
    expect(container.querySelector('.lucide-circle-dollar-sign')).toBeTruthy();
    expect(container.querySelector('.lucide-shield')).toBeNull();
  });

  it('não renderiza nada quando contagem é 0', () => {
    mockCount.value = 0;
    const { container } = renderBadge();
    expect(container.querySelector('button')).toBeNull();
  });

  it('aria-label no singular para 1 aprovação pendente', () => {
    mockCount.value = 1;
    renderBadge();
    expect(
      screen.getByRole('button', { name: '1 aprovações de desconto pendentes' }),
    ).toBeInTheDocument();
  });

  it('aria-label no plural para múltiplas aprovações pendentes', () => {
    mockCount.value = 5;
    renderBadge();
    expect(
      screen.getByRole('button', { name: '5 aprovações de desconto pendentes' }),
    ).toBeInTheDocument();
  });

  it('exibe "9+" quando contagem é maior que 9', () => {
    mockCount.value = 12;
    renderBadge();
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('exibe tooltip ao focar o badge', async () => {
    const user = userEvent.setup();
    renderBadge();
    await user.tab();
    await waitFor(() => {
      expect(
        screen.getAllByText(/aguardando aprovação/i).length,
      ).toBeGreaterThan(0);
    });
  });
});
