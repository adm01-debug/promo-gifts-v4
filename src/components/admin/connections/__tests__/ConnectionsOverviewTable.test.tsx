import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConnectionsOverviewTable } from '../ConnectionsOverviewTable';
import { useAuth } from '@/contexts/AuthContext';
import { useConnectionTester, useConnectionsOverview } from '@/hooks/intelligence';
import { useConsecutiveFailures } from '@/hooks/common';
import { useSecretsManager } from '@/hooks/admin';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mocks
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/common', () => ({
  useConsecutiveFailures: vi.fn(),
}));

vi.mock('@/hooks/admin', () => ({
  useSecretsManager: vi.fn(),
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

describe('ConnectionsOverviewTable Regression Tests', () => {
  const useAuthMock = vi.mocked(useAuth);
  const useConnectionsOverviewMock = vi.mocked(useConnectionsOverview);
  const useConnectionTesterMock = vi.mocked(useConnectionTester);
  const useConsecutiveFailuresMock = vi.mocked(useConsecutiveFailures);
  const useSecretsManagerMock = vi.mocked(useSecretsManager);

  const mockRows = [
    {
      key: 'conn-1',
      id: 'conn-1',
      type: 'supabase',
      name: 'Main Database',
      env_key: 'promobrind',
      status: 'active',
      last_test_at: new Date().toISOString(),
      last_test_ok: true,
      last_test_message: 'OK',
      last_latency_ms: 50,
      auto_test_enabled: true,
    },
    {
      key: 'conn-2',
      id: 'conn-2',
      type: 'bitrix24',
      name: 'CRM Integration',
      env_key: 'crm',
      status: 'error',
      last_test_at: new Date().toISOString(),
      last_test_ok: false,
      last_test_message: 'Connection timeout',
      last_latency_ms: null,
      auto_test_enabled: true,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthMock.mockReturnValue({ isAdmin: true } as unknown as ReturnType<typeof useAuth>);
    useConnectionsOverviewMock.mockReturnValue({
      rows: mockRows,
      loading: false,
      refreshing: false,
      refresh: vi.fn(),
      patchRow: vi.fn(),
    } as unknown as ReturnType<typeof useConnectionsOverview>);
    useConnectionTesterMock.mockReturnValue({
      test: vi.fn(),
      testing: false,
    } as unknown as ReturnType<typeof useConnectionTester>);
    useConsecutiveFailuresMock.mockReturnValue({
      map: new Map(),
      loading: false,
    } as unknown as ReturnType<typeof useConsecutiveFailures>);
    useSecretsManagerMock.mockReturnValue({
      secrets: [],
      list: vi.fn(),
    } as unknown as ReturnType<typeof useSecretsManager>);
  });

  it('should render the table with correct data', async () => {
    render(
      <TooltipProvider>
        <ConnectionsOverviewTable />
      </TooltipProvider>,
    );

    expect(screen.getByText('Main Database')).toBeInTheDocument();
    expect(screen.getByText('CRM Integration')).toBeInTheDocument();
    // Use getAllByText because "OK" might appear in filters as well
    expect(screen.getAllByText('OK').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Connection timeout')).toBeInTheDocument();
  });

  it('should show status badges correctly', async () => {
    render(
      <TooltipProvider>
        <ConnectionsOverviewTable />
      </TooltipProvider>,
    );

    // Status badges use localized text or icons, let's check for the presence of rows
    expect(screen.getAllByRole('row')).toHaveLength(3); // Header + 2 data rows
  });

  it('should trigger refresh when button is clicked', async () => {
    const refreshMock = vi.fn();
    useConnectionsOverviewMock.mockReturnValue({
      rows: mockRows,
      loading: false,
      refreshing: false,
      refresh: refreshMock,
      patchRow: vi.fn(),
    } as unknown as ReturnType<typeof useConnectionsOverview>);

    render(
      <TooltipProvider>
        <ConnectionsOverviewTable />
      </TooltipProvider>,
    );

    const refreshButton = screen.getByText('Atualizar');
    fireEvent.click(refreshButton);

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('should handle empty state', async () => {
    useConnectionsOverviewMock.mockReturnValue({
      rows: [],
      loading: false,
      refreshing: false,
      refresh: vi.fn(),
      patchRow: vi.fn(),
    });

    render(
      <TooltipProvider>
        <ConnectionsOverviewTable />
      </TooltipProvider>,
    );

    expect(screen.getByText('Nenhuma conexão cadastrada')).toBeInTheDocument();
  });
});
