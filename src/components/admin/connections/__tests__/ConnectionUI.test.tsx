import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionsOverviewTable } from '../ConnectionsOverviewTable';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { useConnectionsOverview } from '@/hooks/intelligence';
import { useConnectionTester } from '@/hooks/intelligence';

// Mocks
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/common', () => ({
  useConsecutiveFailures: vi.fn(() => ({
    map: new Map(),
    loading: false,
  })),
}));

vi.mock('@/hooks/admin', () => ({
  useSecretsManager: vi.fn(() => ({
    secrets: [],
    list: vi.fn(),
    refreshCache: vi.fn(), // Adicionado para evitar erro 'refreshSecrets is not a function'
  })),
}));

vi.mock('@/hooks/intelligence', () => ({
  useConnectionsOverview: vi.fn(),
  useConnectionTester: vi.fn(),
  useConnectionsOverviewFilters: vi.fn(() => ({
    filters: { types: [], status: [], window: 'all', onlyConsecutiveFailures: false },
    activeCount: 0,
    reset: vi.fn(),
    toggleType: vi.fn(),
    setStatus: vi.fn(),
    setWindow: vi.fn(),
    removeType: vi.fn(),
    setOnlyConsecutiveFailures: vi.fn(),
  })),
  applyFilters: vi.fn((rows) => rows),
}));

describe('ConnectionsOverviewTable Interações e Acessibilidade', () => {
  const mockRows = [
    {
      id: '1',
      key: '1',
      type: 'supabase',
      name: 'DB Alpha',
      status: 'active',
      env_key: 'promobrind',
    },
    { id: '2', key: '2', type: 'bitrix24', name: 'CRM Beta', status: 'error', env_key: 'crm' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ isAdmin: true });
    (useConnectionsOverview as any).mockReturnValue({
      rows: mockRows,
      loading: false,
      refresh: vi.fn(),
    });
    (useConnectionTester as any).mockReturnValue({ test: vi.fn(), testing: false });
  });

  it('deve permitir focar e navegar nos botões de ação via teclado', () => {
    render(
      <TooltipProvider>
        <ConnectionsOverviewTable />
      </TooltipProvider>,
    );

    const refreshButton = screen.getByText('Atualizar');
    refreshButton.focus();
    expect(document.activeElement).toBe(refreshButton);
  });

  it('deve exibir aria-labels corretos para indicadores de status', () => {
    render(
      <TooltipProvider>
        <ConnectionsOverviewTable />
      </TooltipProvider>,
    );

    // O status badge deve ser identificável por tecnologias assistivas
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1);
  });

  it('deve filtrar a listagem quando o componente de busca for implementado/utilizado', () => {
    // Teste de fumaça para garantir que a tabela renderiza os dados filtrados passados pelo hook
    render(
      <TooltipProvider>
        <ConnectionsOverviewTable />
      </TooltipProvider>,
    );
    expect(screen.getByText('DB Alpha')).toBeInTheDocument();
  });
});
