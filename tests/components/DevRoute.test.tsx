/**
 * DevRoute — gating por papel para rotas técnicas
 *
 * Valida que:
 *  - dev: acessa telemetria, conexões e secrets (chaves) — children renderizam.
 *  - supervisor: é bloqueado, vê copy técnica + atalhos admin + CTA "Ir para Usuários".
 *  - agente (vendedor): é bloqueado, vê copy de vendedor + CTA "Voltar ao Catálogo".
 *  - anon: é redirecionado para /login.
 *  - "Tentar novamente" reabre a rota original (mesmo path) preservando estado.
 *
 * AdminRoute é coberto separadamente (tests/components/AdminRoute.test.tsx).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { DevRoute } from '@/components/layout/DevRoute';

// ----------------------------- mocks -----------------------------
const mockUseAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

// O helper de log de acesso negado faz I/O Supabase — neutralizamos.
vi.mock('@/lib/access/log-access-denied', () => ({
  logAccessDenied: vi.fn().mockResolvedValue(undefined),
}));

// O helper de telemetria UX também: validado em sua própria suíte.
vi.mock('@/lib/access/dev-route-telemetry', () => ({
  recordDevRouteTelemetry: vi.fn().mockResolvedValue(undefined),
}));

// Diálogos de MFA dependem de Supabase — só importam quando dev sem MFA.
vi.mock('@/components/security/MfaEnrollmentDialog', () => ({
  MfaEnrollmentDialog: () => null,
}));
vi.mock('@/components/security/MfaChallengeDialog', () => ({
  MfaChallengeDialog: () => null,
}));

// ------------------ rotas técnicas reais protegidas ------------------
const TECH_ROUTES = [
  { path: '/admin/telemetria',         label: 'Telemetria Page',  area: 'telemetria' },
  { path: '/admin/conexoes',           label: 'Conexões Page',    area: 'conexoes'   },
  { path: '/admin/conexoes/status',    label: 'Conexões Status',  area: 'conexoes'   },
  { path: '/admin/seguranca/chaves',   label: 'Chaves Page',      area: 'mcp'        },
  { path: '/admin/seguranca-acesso',   label: 'Segurança Acesso', area: 'audit'      },
  { path: '/admin/login-attempts',     label: 'Login Attempts',   area: 'audit'      },
] as const;

function PathProbe() {
  const loc = useLocation();
  return <div data-testid="current-path">{loc.pathname}</div>;
}

function renderProtected(initialPath: string) {
  return render(
    <HelmetProvider>
      <MemoryRouter
        initialEntries={[initialPath]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <PathProbe />
        <Routes>
          <Route path="/auth" element={<div>Login Page</div>} />
          <Route path="/" element={<div>Home Page</div>} />
          <Route path="/catalogo" element={<div>Catálogo</div>} />
          <Route path="/admin/usuarios" element={<div>Usuários Admin</div>} />
          <Route element={<DevRoute />}>
            {TECH_ROUTES.map((r) => (
              <Route key={r.path} path={r.path} element={<div>{r.label}</div>} />
            ))}
          </Route>
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );
}

// Shape compatível com a versão atual do useAuth() consumido pelo DevRoute.
const baseAuthShape = {
  user: null as { id: string; email?: string } | null,
  isLoading: false,
  isDev: false,
  isSupervisorOrAbove: false,
  currentAAL: 'aal2' as 'aal1' | 'aal2',
  hasMFA: true,
  mfaRequired: false,
  role: null as string | null,
};

beforeEach(() => {
  mockUseAuth.mockReset();
});

// ------------------------- LOADING / ANON --------------------------
describe('DevRoute — loading e anônimo', () => {
  it('mostra spinner enquanto isLoading=true', () => {
    mockUseAuth.mockReturnValue({ ...baseAuthShape, isLoading: true });
    renderProtected('/admin/telemetria');
    expect(screen.queryByText('Telemetria Page')).not.toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeTruthy();
  });

  it('redireciona anon para /login (sem expor a página técnica)', () => {
    mockUseAuth.mockReturnValue({ ...baseAuthShape, user: null });
    renderProtected('/admin/conexoes');
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Conexões Page')).not.toBeInTheDocument();
  });
});

// ------------------------------- DEV -------------------------------
describe('DevRoute — DEV passa por telemetria, conexões e MCP', () => {
  TECH_ROUTES.forEach(({ path, label, area }) => {
    it(`dev acessa ${path} (${area})`, () => {
      mockUseAuth.mockReturnValue({
        ...baseAuthShape,
        user: { id: 'dev-1', email: 'dev@x.com' },
        isDev: true,
        isSupervisorOrAbove: true,
        role: 'dev',
      });
      renderProtected(path);
      expect(screen.getByText(label)).toBeInTheDocument();
      // tela 403 NÃO renderiza
      expect(
        document.querySelector('[data-http-status="403"]'),
      ).toBeFalsy();
    });
  });
});

// ---------------------------- SUPERVISOR ---------------------------
describe('DevRoute — SUPERVISOR é bloqueado com copy específica', () => {
  function renderSupervisor(path: string) {
    mockUseAuth.mockReturnValue({
      ...baseAuthShape,
      user: { id: 'sup-1' },
      isDev: false,
      isSupervisorOrAbove: true,
      role: 'supervisor',
    });
    renderProtected(path);
  }

  TECH_ROUTES.forEach(({ path, label }) => {
    it(`supervisor em ${path} vê 403 com badge supervisor + CTA "Ir para Usuários"`, () => {
      renderSupervisor(path);

      // semântica 403
      const alert = document.querySelector('[role="alert"][data-http-status="403"]');
      expect(alert).toBeTruthy();
      expect(alert?.getAttribute('data-user-role')).toBe('supervisor');

      // copy é a do supervisor
      expect(
        screen.getByText(/Área técnica restrita à equipe de Desenvolvimento/i),
      ).toBeInTheDocument();
      // badge "Supervisor · 403"
      expect(screen.getByText(/Supervisor · 403/i)).toBeInTheDocument();

      // página técnica NÃO renderiza
      expect(screen.queryByText(label)).not.toBeInTheDocument();

      // CTA contextual aponta para /admin/usuarios
      expect(
        screen.getByRole('button', { name: /^Usuários$/i }),
      ).toBeInTheDocument();
    });
  });

  it('clicar no CTA leva supervisor para /admin/usuarios', () => {
    renderSupervisor('/admin/telemetria');
    fireEvent.click(screen.getByRole('button', { name: /^Usuários$/i }));
    expect(screen.getByText('Usuários Admin')).toBeInTheDocument();
  });
});

// ----------------------- AGENTE (vendedor) -------------------------
describe('DevRoute — AGENTE/vendedor vê copy de vendedor + CTA Catálogo', () => {
  function renderAgente(path: string, role: 'agente' | 'vendedor' | 'agent' = 'agente') {
    mockUseAuth.mockReturnValue({
      ...baseAuthShape,
      user: { id: 'ag-1' },
      isDev: false,
      isSupervisorOrAbove: false,
      role,
    });
    renderProtected(path);
  }

  TECH_ROUTES.forEach(({ path, label }) => {
    it(`agente em ${path} vê 403 com CTA "Voltar ao Catálogo"`, () => {
      renderAgente(path);

      const alert = document.querySelector('[role="alert"][data-http-status="403"]');
      expect(alert).toBeTruthy();
      expect(alert?.getAttribute('data-user-role')).toBe('agente');

      expect(
        screen.getByText(/Esta área é exclusiva da equipe técnica/i),
      ).toBeInTheDocument();

      expect(screen.queryByText(label)).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /^Voltar$/i }),
      ).toBeInTheDocument();
    });
  });

  it('clicar no CTA leva agente para /catalogo', () => {
    renderAgente('/admin/conexoes');
    fireEvent.click(screen.getByRole('button', { name: /^Voltar$/i }));
    expect(screen.getByText('Catálogo')).toBeInTheDocument();
  });

  it.each(['vendedor', 'agent'] as const)(
    'normaliza papel "%s" para a copy de agente',
    (role) => {
      renderAgente('/admin/telemetria', role);
      expect(
        screen.getByText(/Esta área é exclusiva da equipe técnica/i),
      ).toBeInTheDocument();
    },
  );
});

// ----------------- "Tentar novamente" preserva path ----------------
describe('DevRoute — botão "Tentar novamente" reabre o path bloqueado', () => {
  it('navega de volta para o mesmo path (não para fallback)', () => {
    mockUseAuth.mockReturnValue({
      ...baseAuthShape,
      user: { id: 'sup-1' },
      isDev: false,
      isSupervisorOrAbove: true,
      role: 'supervisor',
    });
    renderProtected('/admin/telemetria');

    // o probe espelha o pathname atual
    expect(screen.getByTestId('current-path').textContent).toBe('/admin/telemetria');
    fireEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));
    expect(screen.getByTestId('current-path').textContent).toBe('/admin/telemetria');
    // continua bloqueado (papel não mudou)
    expect(
      document.querySelector('[data-http-status="403"]'),
    ).toBeTruthy();
  });
});

// ----------------- Matriz role × área (smoke) ----------------------
describe('Matriz role × área técnica — apenas dev passa', () => {
  type Persona = 'dev' | 'supervisor' | 'agente' | 'anon';
  const personas: Record<
    Persona,
    Pick<typeof baseAuthShape, 'user' | 'isDev' | 'isSupervisorOrAbove' | 'role'>
  > = {
    dev:        { user: { id: 'd' }, isDev: true,  isSupervisorOrAbove: true,  role: 'dev' },
    supervisor: { user: { id: 's' }, isDev: false, isSupervisorOrAbove: true,  role: 'supervisor' },
    agente:     { user: { id: 'a' }, isDev: false, isSupervisorOrAbove: false, role: 'agente' },
    anon:       { user: null,        isDev: false, isSupervisorOrAbove: false, role: null },
  };

  const areas = Array.from(new Set(TECH_ROUTES.map((r) => r.area)));

  (['dev', 'supervisor', 'agente', 'anon'] as Persona[]).forEach((persona) => {
    areas.forEach((area) => {
      const expectAccess = persona === 'dev';
      it(`${persona} → ${area}: ${expectAccess ? 'acessa' : 'bloqueado'}`, () => {
        const route = TECH_ROUTES.find((r) => r.area === area)!;
        mockUseAuth.mockReturnValue({ ...baseAuthShape, ...personas[persona] });
        renderProtected(route.path);

        if (expectAccess) {
          expect(screen.getByText(route.label)).toBeInTheDocument();
        } else if (persona === 'anon') {
          expect(screen.getByText('Login Page')).toBeInTheDocument();
        } else {
          expect(screen.queryByText(route.label)).not.toBeInTheDocument();
          expect(
            document.querySelector('[data-http-status="403"]'),
          ).toBeTruthy();
        }
      });
    });
  });
});
