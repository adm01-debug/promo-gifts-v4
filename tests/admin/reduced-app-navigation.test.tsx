/**
 * Integração: monta uma versão reduzida da árvore de rotas do App.tsx
 * (BrowserRouter + Routes com ProtectedRoute → AdminRoute → DevRoute reais)
 * e navega programaticamente entre rotas admin/dev/protected, garantindo
 * que NENHUM warning de "Function components cannot be given refs" — nem
 * outros warnings críticos do React — apareça durante a navegação.
 *
 * Por que reduzido? `App.tsx` puxa Auth/Theme/Query/Tooltip/AppProviders
 * + ~80 páginas via lazy. Em jsdom, montar tudo é caro e instável (cada
 * página tenta tocar Supabase). A árvore reduzida usa os guards REAIS e
 * stubs leves para as páginas — exatamente o que prova a hipótese da
 * suite (warnings em *navegação*, não em *carregamento de página*).
 */
import { describe, it, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { render, cleanup, screen, act } from "@testing-library/react";
import {
  MemoryRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { Suspense } from "react";
import { installReactWarningGuard } from "../helpers/react-warning-guard";

// ---------- Mocks de contexto e subdependências ---------------------------

const authState = {
  user: { id: "u1", email: "dev@promogifts.test" },
  isLoading: false,
  canManage: true,
  isDev: true,
  isSupervisorOrAbove: true,
  hasMFA: true,
  mfaRequired: true,
  currentAAL: "aal2" as const,
  role: "dev" as const,
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/security/MfaEnrollmentDialog", () => ({
  MfaEnrollmentDialog: () => null,
}));
vi.mock("@/components/security/MfaChallengeDialog", () => ({
  MfaChallengeDialog: () => null,
}));
vi.mock("@/components/access/DevAccessDeniedPage", () => ({
  DevAccessDeniedPage: () => <div>access-denied</div>,
}));
vi.mock("@/lib/access/log-access-denied", () => ({
  logAccessDenied: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

// Imports DEPOIS dos mocks para garantir resolução correta.
import { AdminRoute } from "@/components/layout/AdminRoute";
import { DevRoute } from "@/components/layout/DevRoute";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

// ---------- Stubs de página (mantêm forma do App real) --------------------

const Stub = (label: string) => () => <div data-testid={`page-${label}`}>{label}</div>;

const HomeStub = Stub("home");
const DashboardStub = Stub("dashboard");
const ProductsStub = Stub("products");
const QuotesStub = Stub("quotes");
const AdminUsersStub = Stub("admin-users");
const AdminThemesStub = Stub("admin-themes");
const AdminTelemetryStub = Stub("admin-telemetry");
const AdminConnectionsStub = Stub("admin-connections");
const SystemStatusStub = Stub("system-status");
const LoginStub = Stub("login");

/**
 * Harness que expõe `navigate` para fora via callback — permite que o teste
 * dispare transições programáticas dentro do contexto do BrowserRouter.
 */
function NavigationProbe({
  onReady,
}: {
  onReady: (navigate: ReturnType<typeof useNavigate>) => void;
}) {
  const nav = useNavigate();
  React.useEffect(() => {
    onReady(nav);
  }, [nav, onReady]);
  return null;
}

function ReducedApp({
  initial = "/",
  onNavigateReady,
}: {
  initial?: string;
  onNavigateReady?: (n: ReturnType<typeof useNavigate>) => void;
}) {
  return (
    <MemoryRouter initialEntries={[initial]} future={{ v7_relativeSplatPath: true }}>
      <Suspense fallback={<div>loading…</div>}>
        {onNavigateReady && <NavigationProbe onReady={onNavigateReady} />}
        <Routes>
          {/* Public */}
          <Route path="/auth" element={<LoginStub />} />

          {/* Protected layer */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeStub />} />
            <Route path="/dashboard" element={<DashboardStub />} />
            <Route path="/produtos" element={<ProductsStub />} />
            <Route path="/orcamentos" element={<QuotesStub />} />

            {/* Admin layer */}
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<Navigate to="/admin/usuarios" replace />} />
              <Route path="/admin/usuarios" element={<AdminUsersStub />} />
              <Route path="/admin/temas" element={<AdminThemesStub />} />

              {/* Dev layer */}
              <Route element={<DevRoute />}>
                <Route path="/admin/telemetria" element={<AdminTelemetryStub />} />
                <Route path="/admin/conexoes" element={<AdminConnectionsStub />} />
                <Route path="/status" element={<SystemStatusStub />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </MemoryRouter>
  );
}

// ---------- Testes --------------------------------------------------------

describe("Reduced App integration — navegação não emite ref warning", () => {
  let guard: ReturnType<typeof installReactWarningGuard>;

  beforeEach(() => {
    guard = installReactWarningGuard();
    Object.assign(authState, {
      user: { id: "u1", email: "dev@promogifts.test" },
      isLoading: false, canManage: true, isDev: true,
      isSupervisorOrAbove: true, hasMFA: true, mfaRequired: true,
      currentAAL: "aal2", role: "dev",
    });
  });

  afterEach(() => {
    guard.dispose();
    cleanup();
  });

  it("monta na home e renderiza Outlet sem warning", () => {
    render(<ReducedApp initial="/" />);
    screen.getByTestId("page-home");
    guard.expectNoRefWarning("home boot");
  });

  it("navegação protected → admin → dev → protected sem warning", async () => {
    let navigate!: ReturnType<typeof useNavigate>;
    render(
      <ReducedApp
        initial="/"
        onNavigateReady={(n) => {
          navigate = n;
        }}
      />,
    );
    // Aguarda probe receber `navigate`.
    await act(async () => {});

    const trail = [
      "/dashboard",
      "/produtos",
      "/orcamentos",
      "/admin/usuarios",
      "/admin/temas",
      "/admin/telemetria",
      "/admin/conexoes",
      "/status",
      "/admin/usuarios", // back para admin (Dev → Admin)
      "/dashboard",      // back para protected (Admin → Protected)
      "/",
    ];

    for (const path of trail) {
      await act(async () => {
        navigate(path);
      });
      // Confirma que cada destino renderizou — falha cedo se houver
      // regressão de roteamento (não só de warnings).
      const expectedTestId = ({
        "/": "page-home",
        "/dashboard": "page-dashboard",
        "/produtos": "page-products",
        "/orcamentos": "page-quotes",
        "/admin/usuarios": "page-admin-users",
        "/admin/temas": "page-admin-themes",
        "/admin/telemetria": "page-admin-telemetry",
        "/admin/conexoes": "page-admin-connections",
        "/status": "page-system-status",
      } as Record<string, string>)[path];
      if (expectedTestId) screen.getByTestId(expectedTestId);
      guard.expectNoRefWarning(`após navegar para ${path}`);
    }
  });

  it("acesso direto a rota dev (deep link) não emite warning", () => {
    render(<ReducedApp initial="/admin/telemetria" />);
    screen.getByTestId("page-admin-telemetry");
    guard.expectNoRefWarning("deep link /admin/telemetria");
  });

  it("usuário não-dev em rota dev → DevAccessDeniedPage sem warning", async () => {
    Object.assign(authState, { isDev: false, role: "supervisor" });
    render(<ReducedApp initial="/admin/telemetria" />);
    // Sob não-dev a rota Dev cai no DevAccessDeniedPage (mockado).
    screen.getByText("access-denied");
    guard.expectNoRefWarning("não-dev em rota dev");
  });

  it("usuário sem sessão em rota protegida → redirect /login sem warning", () => {
    Object.assign(authState, {
      user: null, canManage: false, isDev: false,
      isSupervisorOrAbove: false, hasMFA: false, mfaRequired: false,
      currentAAL: "aal1", role: "agente",
    });
    render(<ReducedApp initial="/admin/usuarios" />);
    screen.getByTestId("page-login");
    guard.expectNoRefWarning("anon → /login");
  });

  it("loading state em todos os guards (Loader2 spinner) sem warning", () => {
    Object.assign(authState, { isLoading: true });
    render(<ReducedApp initial="/admin/conexoes" />);
    guard.expectNoRefWarning("isLoading=true em guards aninhados");
  });
});
