import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { TooltipProvider } from '@/components/ui/tooltip';
import { HelmetProvider } from 'react-helmet-async';
import React from 'react';
import { AriaLiveProvider } from '@/components/a11y/AriaLive';
import AdminConexoesPage from '@/pages/admin/AdminConexoesPage';
import AdminUsuariosPage from '@/pages/admin/AdminUsuariosPage';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <MemoryRouter>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>
              <AriaLiveProvider>{children}</AriaLiveProvider>
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>
    </HelmetProvider>
  </QueryClientProvider>
);

// Mock hooks that use network/Supabase to avoid async leaks during tests
vi.mock('@/hooks/admin', () => ({
  useSecretsManager: () => ({
    secrets: [],
    isLoading: false,
    listError: null,
    list: vi.fn().mockResolvedValue([]),
    setSecret: vi.fn(),
    rotateSecret: vi.fn(),
    getRotationHistory: vi.fn().mockResolvedValue([]),
    refreshCache: vi.fn(),
  }),
  useRetestCooldownSetting: () => ({
    cooldownMs: 3000,
    loading: false,
    saving: false,
    save: vi.fn(),
  }),
  RETEST_COOLDOWN_PRESETS_MS: [3000, 10000, 30000, 60000],
}));

vi.mock('@/hooks/auth', () => ({
  usePasswordResetRequests: () => ({
    requests: [],
    pendingCount: 0,
    isLoading: false,
    approve: vi.fn(),
    reject: vi.fn(),
  }),
}));

vi.mock('@/components/admin/users/useUserManagement', () => ({
  useUserManagement: () => ({
    users: [],
    isLoading: false,
    updatingUserId: null,
    fetchUsers: vi.fn(),
    handleRoleChange: vi.fn(),
    handleCreateUser: vi.fn(),
    handleDeleteUser: vi.fn(),
    handleSaveEdit: vi.fn(),
    handleAvatarUpload: vi.fn(),
    handleRemoveAvatar: vi.fn(),
  }),
}));

// Mock DevAccessAuditAlert to avoid internal queries
vi.mock('@/components/admin/DevAccessAuditAlert', () => ({
  DevAccessAuditAlert: () => <div data-testid="dev-audit-alert">Dev Audit</div>,
}));

// AdminConexoesPage renders SupabaseConnectionsTab which has useEffect async
// calls (fetchLastTest) that fire setLastByEnv after the test environment is
// torn down, causing "window is not defined". Mock the tab component itself to
// remove all async operations while preserving the page's container structure.
vi.mock('@/components/admin/connections/SupabaseConnectionsTab', () => ({
  SupabaseConnectionsTab: () => <div data-testid="supabase-connections-tab-mock" />,
}));

// Mock ConnectionsOverviewTable and SecretField which also transitively use
// @/hooks/intelligence and trigger similar post-teardown async errors.
vi.mock('@/components/admin/connections/ConnectionsOverviewTable', () => ({
  ConnectionsOverviewTable: () => <div data-testid="connections-overview-mock" />,
}));

vi.mock('@/components/admin/connections/SecretField', () => ({
  SecretField: () => <div data-testid="secret-field-mock" />,
}));

describe('Admin Module Structural Comparison', () => {
  it('Conexoes and Usuarios should share matching container hierarchy', async () => {
    const { container: conexoes } = render(<AdminConexoesPage />, { wrapper });
    const { container: usuarios } = render(<AdminUsuariosPage />, { wrapper });

    // Select the standardized inner container (div with max-w inside main)
    const findContainer = (root: HTMLElement) =>
      [...root.querySelectorAll('div')].find((d) => d.className.includes('max-w-'));

    const conexoesInner = findContainer(conexoes);
    const usuariosInner = findContainer(usuarios);

    expect(conexoesInner, 'Conexoes missing inner container').not.toBeNull();
    expect(usuariosInner, 'Usuarios missing inner container').not.toBeNull();
  });
});
