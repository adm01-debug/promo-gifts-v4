import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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
      select: () => ({
        eq: () => Promise.resolve({ count: 3, error: null }),
      }),
    }),
    channel: () => ({
      on: function () { return this; },
      subscribe: function () { return this; },
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({ data: 3 }),
    useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  };
});

function renderBadge() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <TooltipProvider>
          <DiscountApprovalHeaderBadge />
        </TooltipProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DiscountApprovalHeaderBadge', () => {
  it('renderiza ícone CircleDollarSign (lucide-circle-dollar-sign) e não Shield', () => {
    const { container } = renderBadge();
    expect(container.querySelector('.lucide-circle-dollar-sign')).toBeTruthy();
    expect(container.querySelector('.lucide-shield')).toBeNull();
  });

  it('mantém aria-label acessível com contagem pendente', () => {
    renderBadge();
    expect(
      screen.getByRole('button', { name: /3 aprovações de desconto pendentes/i }),
    ).toBeInTheDocument();
  });
});
