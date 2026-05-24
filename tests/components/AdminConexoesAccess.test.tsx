/**
 * Testes de acesso para /admin/conexoes.
 *
 * Garante que a rota só exibe credenciais quando o usuário está logado
 * como admin (defesa em profundidade: AdminRoute + ProtectedRoute requireAdmin),
 * e que erros 401/403 do secrets-manager produzem mensagem clara na UI
 * em vez de mostrarem todas as credenciais como "AUSENTE".
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AdminRoute } from '@/components/layout/AdminRoute';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { CardSourceDiagnostic } from '@/components/admin/connections/CardSourceDiagnostic';
import { ExplainModeProvider } from '@/components/admin/connections/ExplainModeContext';

const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const baseAuth = {
  currentAAL: 'aal2' as const,
  hasMFA: true,
  mfaRequired: false,
  isLoading: false,
  refreshAAL: vi.fn(),
};

/**
 * Reproduz o aninhamento real de App.tsx para /admin/conexoes:
 *   <AdminRoute>            ← exige canManage + MFA AAL2
 *     <ProtectedRoute requireAdmin>  ← exige isAdmin estrito
 *       <AdminConexoesPage />
 */
function renderConexoesRoute() {
  return render(
    <MemoryRouter
      initialEntries={['/admin/conexoes']}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Routes>
        <Route path="/auth" element={<div>Login Page</div>} />
        <Route path="/" element={<div>Home Page</div>} />
        <Route element={<AdminRoute />}>
          <Route element={<ProtectedRoute requireAdmin />}>
            <Route
              path="/admin/conexoes"
              element={<div>Credenciais Sensíveis</div>}
            />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('Acesso a /admin/conexoes', () => {
  it('redireciona para /login quando não há sessão', () => {
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      user: null,
      canManage: false,
      isAdmin: false,
    });
    renderConexoesRoute();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Credenciais Sensíveis')).not.toBeInTheDocument();
  });

  it('redireciona para / quando o usuário é vendedor (sem canManage)', () => {
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      user: { id: 'u-1' },
      roles: [],
      canManage: false,
      isAdmin: false,
    });
    renderConexoesRoute();
    // ProtectedRoute exibe EmptyState 'Acesso Restrito' em vez de Navigate.
    expect(screen.getByText(/Acesso Restrito/i)).toBeInTheDocument();
    expect(screen.queryByText('Credenciais Sensíveis')).not.toBeInTheDocument();
  });

  it('libera manager (canManage + supervisorOrAbove via alias legacy)', () => {
    // Hierarquia oficial: dev > supervisor > agente
    // Manager é alias legacy de supervisor (auth-utils.ts:isSupervisorOrAbove
    // inclui 'manager' na lista). Portanto manager passa BOTH AdminRoute
    // (canManage) E ProtectedRoute requireAdmin (supervisorOrAbove).
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      user: { id: 'u-2' },
      roles: ['manager'],
      canManage: true,
      isAdmin: false,
    });
    renderConexoesRoute();
    expect(screen.getByText('Credenciais Sensíveis')).toBeInTheDocument();
  });

  it('renderiza credenciais quando o usuário é admin com MFA AAL2', () => {
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      user: { id: 'u-3' },
      roles: ['admin', 'supervisor'],
      canManage: true,
      isAdmin: true,
      isSupervisorOrAbove: true,
    });
    renderConexoesRoute();
    expect(screen.getByText('Credenciais Sensíveis')).toBeInTheDocument();
  });

  it('bloqueia admin sem MFA (gate de enrollment)', () => {
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      user: { id: 'u-3' },
      roles: ['admin', 'supervisor'],
      canManage: true,
      isAdmin: true,
      hasMFA: false,
    });
    renderConexoesRoute();
    expect(screen.queryByText('Credenciais Sensíveis')).not.toBeInTheDocument();
  });
});

describe('CardSourceDiagnostic — erros 401/403 do secrets-manager', () => {
  function renderDiag(loadError: { code: string; message: string }) {
    return render(
      <ExplainModeProvider>
        <CardSourceDiagnostic
          fields={[
            { label: 'URL do projeto', status: undefined },
            { label: 'Service Role Key', status: undefined },
          ]}
          loadError={loadError}
        />
      </ExplainModeProvider>,
    );
  }

  it('exibe mensagem clara para 401 (sessão expirada)', () => {
    renderDiag({ code: 'unauthenticated', message: 'jwt expired' });
    expect(
      screen.getByText(/Sessão expirada — não foi possível ler as credenciais/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Faça login novamente/i)).toBeInTheDocument();
    expect(screen.getByText(/código: unauthenticated/i)).toBeInTheDocument();
    // Não deve regredir para o diagnóstico "AUSENTE" (false positive)
    expect(screen.queryByText(/AUSENTE/)).not.toBeInTheDocument();
  });

  it('exibe mensagem clara para 403 (sem permissão)', () => {
    renderDiag({ code: 'forbidden', message: 'admin only' });
    expect(
      screen.getByText(/Sem permissão para ler credenciais/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Apenas administradores podem visualizar\/editar credenciais/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/código: forbidden/i)).toBeInTheDocument();
    expect(screen.queryByText(/AUSENTE/)).not.toBeInTheDocument();
  });

  it('alerta tem role=alert e aria-live para tecnologias assistivas', () => {
    renderDiag({ code: 'unauthenticated', message: 'jwt expired' });
    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute('aria-live', 'polite');
  });
});
