/**
 * Garante em RUNTIME (complementando `scripts/check-route-error-element.mjs`,
 * que faz a varredura estática em src/) que durante a navegação pelas rotas
 * admin/dev/protected NENHUM elemento React renderizado declara a prop
 * `errorElement`.
 *
 * Por que ambos? O checker estático só lê texto-fonte; ele não pega:
 *   - props passadas via spread (`{...routeConfig}`);
 *   - `errorElement` injetado por HOCs/wrappers em runtime;
 *   - rotas geradas por loops/maps com objetos dinâmicos.
 *
 * Esta verificação inspeciona a árvore real de fibers do React e, para cada
 * destino navegado, garante que:
 *   1. nenhum `<Route>` renderizado tem `errorElement` definido;
 *   2. nenhum elemento (de qualquer tipo) tem prop `errorElement` definida
 *      — bloqueia wrappers customizados que poderiam reintroduzir a prop.
 *
 * Reusa o harness de `reduced-app-navigation.test.tsx` (mesma árvore com
 * ProtectedRoute → AdminRoute → DevRoute reais + stubs de página).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

// ---------- Mocks (mesmo perfil do reduced-app-navigation) ----------------

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

import { AdminRoute } from "@/components/layout/AdminRoute";
import { DevRoute } from "@/components/layout/DevRoute";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

// ---------- Stubs ---------------------------------------------------------

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

function NavigationProbe({
  onReady,
}: {
  onReady: (navigate: ReturnType<typeof useNavigate>) => void;
}) {
  const nav = useNavigate();
  React.useEffect(() => { onReady(nav); }, [nav, onReady]);
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
          <Route path="/auth" element={<LoginStub />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<HomeStub />} />
            <Route path="/dashboard" element={<DashboardStub />} />
            <Route path="/produtos" element={<ProductsStub />} />
            <Route path="/orcamentos" element={<QuotesStub />} />
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<Navigate to="/admin/usuarios" replace />} />
              <Route path="/admin/usuarios" element={<AdminUsersStub />} />
              <Route path="/admin/temas" element={<AdminThemesStub />} />
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

// ---------- Inspeção de fibers --------------------------------------------

interface Violation {
  componentName: string;
  hasErrorElement: true;
  // Pequeno snippet textual para diagnóstico.
  preview: string;
}

/**
 * Percorre a árvore de fibers a partir do container do RTL e retorna toda
 * fiber cuja `memoizedProps.errorElement` esteja definida (não-nullish).
 *
 * Funciona em React 18 (devtools-style traversal: child / sibling).
 */
function collectErrorElementUsages(container: HTMLElement): Violation[] {
  const violations: Violation[] = [];

  // O container do RTL é um <div> dentro do body; o root fiber está no
  // primeiro filho real (o React anexa `__reactContainer$<id>` no element).
  const rootHostKey = Object.keys(container).find((k) =>
    k.startsWith("__reactContainer$"),
  );
  if (!rootHostKey) return violations; // jsdom estranho — não falha por isso.
  const root = (container as unknown as Record<string, unknown>)[rootHostKey] as
    | { stateNode?: { current?: unknown } }
    | undefined;
  const rootFiber = root?.stateNode && typeof root.stateNode === "object"
    ? (root.stateNode as { current?: unknown }).current
    : undefined;
  if (!rootFiber) return violations;

  const seen = new Set<unknown>();
  const stack: unknown[] = [rootFiber];

  while (stack.length) {
    const node = stack.pop() as
      | {
          memoizedProps?: Record<string, unknown> | null;
          pendingProps?: Record<string, unknown> | null;
          type?: unknown;
          elementType?: unknown;
          child?: unknown;
          sibling?: unknown;
        }
      | null
      | undefined;
    if (!node || seen.has(node)) continue;
    seen.add(node);

    const props = node.memoizedProps ?? node.pendingProps;
    if (props && typeof props === "object" && "errorElement" in props) {
      const value = (props as Record<string, unknown>).errorElement;
      if (value !== undefined && value !== null && value !== false) {
        const t = node.type ?? node.elementType;
        const componentName =
          (typeof t === "function" && (t as { displayName?: string; name?: string }).displayName) ||
          (typeof t === "function" && (t as { name?: string }).name) ||
          (typeof t === "string" ? t : "anonymous");
        let preview = "";
        try {
          preview = JSON.stringify(props, (_k, v) =>
            typeof v === "function" ? "[fn]" : v,
          ).slice(0, 200);
        } catch {
          preview = "[unserializable props]";
        }
        violations.push({
          componentName,
          hasErrorElement: true,
          preview,
        });
      }
    }

    if (node.child) stack.push(node.child);
    if (node.sibling) stack.push(node.sibling);
  }

  return violations;
}

// ---------- Testes --------------------------------------------------------

describe("Rotas admin/dev/protected — nenhum elemento renderizado usa `errorElement`", () => {
  beforeEach(() => {
    Object.assign(authState, {
      user: { id: "u1", email: "dev@promogifts.test" },
      isLoading: false, canManage: true, isDev: true,
      isSupervisorOrAbove: true, hasMFA: true, mfaRequired: true,
      currentAAL: "aal2", role: "dev",
    });
  });

  afterEach(() => cleanup());

  it("auto-teste: o coletor consegue detectar `errorElement` quando ele existe", () => {
    // Sentinela: se o coletor ficar quebrado (ex.: mudança de internals do
    // React), os outros testes ficariam "verdes silenciosos". Este teste
    // injeta um `errorElement` propositalmente e espera detecção.
    function Bait() {
      // Renderizamos um elemento *qualquer* com a prop — o React preserva
      // props desconhecidas em componentes de função custom.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Custom = (_: any) => <span data-testid="bait" />;
      return <Custom errorElement={<div>boom</div>} />;
    }
    const { container } = render(<Bait />);
    const found = collectErrorElementUsages(container);
    expect(found.length).toBeGreaterThan(0);
    expect(found[0].componentName).toBe("Custom");
  });

  it("home (/) — árvore limpa de errorElement", () => {
    const { container } = render(<ReducedApp initial="/" />);
    screen.getByTestId("page-home");
    expect(collectErrorElementUsages(container)).toEqual([]);
  });

  it("deep-link em todas as rotas relevantes — árvore limpa", () => {
    const targets = [
      { path: "/dashboard", testid: "page-dashboard" },
      { path: "/produtos", testid: "page-products" },
      { path: "/orcamentos", testid: "page-quotes" },
      { path: "/admin/usuarios", testid: "page-admin-users" },
      { path: "/admin/temas", testid: "page-admin-themes" },
      { path: "/admin/telemetria", testid: "page-admin-telemetry" },
      { path: "/admin/conexoes", testid: "page-admin-connections" },
      { path: "/status", testid: "page-system-status" },
    ];
    for (const { path, testid } of targets) {
      const { container, unmount } = render(<ReducedApp initial={path} />);
      screen.getByTestId(testid);
      const violations = collectErrorElementUsages(container);
      expect(
        violations,
        `errorElement detectado em ${path}: ${JSON.stringify(violations, null, 2)}`,
      ).toEqual([]);
      unmount();
    }
  });

  it("navegação programática protected → admin → dev → protected — árvore limpa em cada passo", async () => {
    let navigate!: ReturnType<typeof useNavigate>;
    const { container } = render(
      <ReducedApp
        initial="/"
        onNavigateReady={(n) => { navigate = n; }}
      />,
    );
    await act(async () => {});

    const trail = [
      "/dashboard",
      "/admin/usuarios",
      "/admin/temas",
      "/admin/telemetria",
      "/admin/conexoes",
      "/status",
      "/admin/usuarios", // back
      "/dashboard",       // back
      "/",
    ];

    for (const path of trail) {
      await act(async () => { navigate(path); });
      const violations = collectErrorElementUsages(container);
      expect(
        violations,
        `errorElement detectado após navegar para ${path}: ${JSON.stringify(violations, null, 2)}`,
      ).toEqual([]);
    }
  });

  it("estado de loading dos guards — árvore limpa", () => {
    Object.assign(authState, { isLoading: true });
    const { container } = render(<ReducedApp initial="/admin/conexoes" />);
    expect(collectErrorElementUsages(container)).toEqual([]);
  });

  it("não-dev em rota dev (DevAccessDeniedPage) — árvore limpa", () => {
    Object.assign(authState, { isDev: false, role: "supervisor" });
    const { container } = render(<ReducedApp initial="/admin/telemetria" />);
    screen.getByText("access-denied");
    expect(collectErrorElementUsages(container)).toEqual([]);
  });

  it("anônimo em rota protegida → /login — árvore limpa", () => {
    Object.assign(authState, {
      user: null, canManage: false, isDev: false,
      isSupervisorOrAbove: false, hasMFA: false, mfaRequired: false,
      currentAAL: "aal1", role: "agente",
    });
    const { container } = render(<ReducedApp initial="/admin/usuarios" />);
    screen.getByTestId("page-login");
    expect(collectErrorElementUsages(container)).toEqual([]);
  });
});
