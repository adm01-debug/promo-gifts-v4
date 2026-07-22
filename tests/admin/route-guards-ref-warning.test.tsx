/**
 * Smoke render dos guards de rota (AdminRoute / DevRoute / ProtectedRoute)
 * com `installReactWarningGuard` para garantir que nenhum dispara
 * "Function components cannot be given refs".
 *
 * Cobre cenários sem usuário (redirect → <Navigate />) e com loading.
 * Renderiza dentro de Routes para que `<Outlet />` e `<Navigate />` se
 * comportem como em produção.
 */
import { describe, it, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, Outlet } from "react-router-dom";
import { EnhancedErrorBoundary } from "@/components/errors/EnhancedErrorBoundary";
import { installReactWarningGuard } from "../helpers/react-warning-guard";

// Mock do AuthContext: retorna estado controlável por teste.
const authState = {
  user: null as null | { id: string; email: string },
  isLoading: false,
  canManage: false,
  isDev: false,
  isSupervisorOrAbove: false,
  hasMFA: false,
  mfaRequired: false,
  currentAAL: "aal1" as "aal1" | "aal2" | null,
  role: "agente" as const,
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mocks neutros para subdependências dos guards.
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
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { AdminRoute } from "@/components/layout/AdminRoute";
import { DevRoute } from "@/components/layout/DevRoute";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

function renderWithRoute(element: React.ReactElement, initial = "/admin") {
  return render(
    <MemoryRouter initialEntries={[initial]}>
      <Routes>
        <Route path="/" element={<div>home</div>} />
        <Route path="/login" element={<div>login</div>} />
        <Route element={element}>
          <Route path="/admin" element={<div>admin-child</div>} />
          <Route path="/dev" element={<div>dev-child</div>} />
          <Route path="/p" element={<div>p-child</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("Route guards — React ref warning guard", () => {
  let guard: ReturnType<typeof installReactWarningGuard>;

  beforeEach(() => {
    guard = installReactWarningGuard();
    Object.assign(authState, {
      user: null, isLoading: false, canManage: false, isDev: false,
      isSupervisorOrAbove: false, hasMFA: false, mfaRequired: false,
      currentAAL: "aal1", role: "agente",
    });
  });

  afterEach(() => {
    guard.dispose();
    cleanup();
  });

  it("AdminRoute (loading) — sem warning de ref", () => {
    authState.isLoading = true;
    renderWithRoute(<AdminRoute />);
    guard.expectNoRefWarning("AdminRoute loading");
  });

  it("AdminRoute (sem user → Navigate /login) — sem warning de ref", () => {
    renderWithRoute(<AdminRoute />);
    guard.expectNoRefWarning("AdminRoute → /login");
  });

  it("AdminRoute (admin com MFA OK → Outlet) — sem warning de ref", () => {
    Object.assign(authState, {
      user: { id: "u1", email: "a@b.c" }, canManage: true,
      hasMFA: true, mfaRequired: true, currentAAL: "aal2",
    });
    renderWithRoute(<AdminRoute />);
    guard.expectNoRefWarning("AdminRoute outlet");
  });

  it("AdminRoute bloqueia render do filho quando AAL ainda está indefinido", () => {
    Object.assign(authState, {
      user: { id: "u1", email: "a@b.c" },
      canManage: true,
      hasMFA: true,
      mfaRequired: true,
      currentAAL: null,
    });
    renderWithRoute(<AdminRoute />);
    expect(screen.queryByText("admin-child")).not.toBeInTheDocument();
    guard.expectNoRefWarning("AdminRoute AAL null");
  });

  it("DevRoute (sem user → Navigate /login) — sem warning de ref", () => {
    renderWithRoute(<DevRoute />, "/dev");
    guard.expectNoRefWarning("DevRoute → /login");
  });

  it("DevRoute (não-dev → DevAccessDeniedPage) — sem warning de ref", () => {
    Object.assign(authState, {
      user: { id: "u1", email: "a@b.c" }, isDev: false, role: "agente",
    });
    renderWithRoute(<DevRoute />, "/dev");
    guard.expectNoRefWarning("DevRoute denied");
  });

  it("DevRoute (dev com MFA OK → Outlet) — sem warning de ref", () => {
    Object.assign(authState, {
      user: { id: "u1", email: "a@b.c" }, isDev: true,
      hasMFA: true, mfaRequired: true, currentAAL: "aal2", role: "dev",
    });
    renderWithRoute(<DevRoute />, "/dev");
    guard.expectNoRefWarning("DevRoute outlet");
  });

  it("DevRoute bloqueia render do filho dev quando AAL ainda está indefinido", () => {
    Object.assign(authState, {
      user: { id: "u1", email: "a@b.c" },
      isDev: true,
      hasMFA: true,
      mfaRequired: true,
      currentAAL: null,
      role: "dev",
    });
    renderWithRoute(<DevRoute />, "/dev");
    expect(screen.queryByText("dev-child")).not.toBeInTheDocument();
    guard.expectNoRefWarning("DevRoute AAL null");
  });

  it("ProtectedRoute (sem user → Navigate /login) — sem warning de ref", () => {
    renderWithRoute(<ProtectedRoute />, "/p");
    guard.expectNoRefWarning("ProtectedRoute redirect");
  });

  it("ProtectedRoute (autenticado → Outlet) — sem warning de ref", () => {
    Object.assign(authState, { user: { id: "u1", email: "a@b.c" } });
    renderWithRoute(<ProtectedRoute />, "/p");
    guard.expectNoRefWarning("ProtectedRoute outlet");
  });
});

/**
 * Cenários de erro: garantem que quando um filho lança durante render
 * (sync ou em effect), o EnhancedErrorBoundary captura o erro e renderiza seu
 * fallback SEM emitir o warning de "Function components cannot be given refs".
 *
 * Cobre os 3 padrões mais comuns de fallback:
 *   1. EnhancedErrorBoundary global envolvendo <MemoryRouter>;
 *   2. EnhancedErrorBoundary com fallback custom (ReactNode) — análogo a errorElement;
 *   3. EnhancedErrorBoundary aninhado dentro de uma rota protegida.
 */

/** Componente que lança imediatamente — simula crash de render. */
function Boom({ message = "boom" }: { message?: string }): never {
  throw new Error(message);
}

/** Componente que lança ao montar (efeito de pós-render). */
function BoomOnMount({ message = "mount-boom" }: { message?: string }) {
  // Lançar no body do componente cobre o caminho síncrono — suficiente
  // para acionar getDerivedStateFromError do EnhancedErrorBoundary.
  throw new Error(message);
}

/** Fallback simples (ReactNode) usado como "errorElement" análogo. */
function CustomFallback() {
  return <div role="alert">custom-error-fallback</div>;
}

describe("Route guards + EnhancedErrorBoundary — sem warning de ref ao falhar", () => {
  let guard: ReturnType<typeof installReactWarningGuard>;
  // Silencia o console.error que React emite ao capturar o erro no boundary
  // — ele não é um ref warning e não deve poluir o output do teste.
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    guard = installReactWarningGuard();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    Object.assign(authState, {
      user: { id: "u1", email: "a@b.c" },
      isLoading: false, canManage: true, isDev: true,
      isSupervisorOrAbove: true, hasMFA: true, mfaRequired: true,
      currentAAL: "aal2", role: "dev",
    });
  });

  afterEach(() => {
    guard.dispose();
    errorSpy.mockRestore();
    cleanup();
  });

  it("EnhancedErrorBoundary global captura throw em rota não-protegida — sem warning", () => {
    render(
      <EnhancedErrorBoundary fallback={<CustomFallback />}>
        <MemoryRouter initialEntries={["/x"]}>
          <Routes>
            <Route path="/x" element={<Boom />} />
          </Routes>
        </MemoryRouter>
      </EnhancedErrorBoundary>,
    );
    // Confirma que o fallback renderizou (boundary funcionou).
    screen.getByText("custom-error-fallback");
    guard.expectNoRefWarning("EnhancedErrorBoundary global + Boom");
  });

  it("AdminRoute envolve filho que lança — fallback sem warning", () => {
    // AdminRoute tem EnhancedErrorBoundary INTERNO (defesa em profundidade) com
    // fallback "Erro Administrativo / Recarregar". Esse boundary captura o erro
    // ANTES do externo (CustomFallback), então validamos o fallback interno.
    // Objetivo do teste continua sendo: SEM warning de ref ao lançar.
    render(
      <EnhancedErrorBoundary fallback={<CustomFallback />}>
        <MemoryRouter initialEntries={["/admin"]}>
          <Routes>
            <Route element={<AdminRoute />}>
              <Route path="/admin" element={<Boom message="admin-boom" />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </EnhancedErrorBoundary>,
    );
    // Boundary interno do AdminRoute capturou — fallback "Erro Administrativo"
    screen.getByText("Erro Administrativo");
    guard.expectNoRefWarning("AdminRoute child Boom");
  });

  it("DevRoute envolve filho que lança — fallback sem warning", () => {
    render(
      <EnhancedErrorBoundary fallback={<CustomFallback />}>
        <MemoryRouter initialEntries={["/dev"]}>
          <Routes>
            <Route element={<DevRoute />}>
              <Route path="/dev" element={<BoomOnMount message="dev-boom" />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </EnhancedErrorBoundary>,
    );
    screen.getByText("custom-error-fallback");
    guard.expectNoRefWarning("DevRoute child BoomOnMount");
  });

  it("ProtectedRoute envolve filho que lança — fallback sem warning", () => {
    // ProtectedRoute tem EnhancedErrorBoundary INTERNO (defesa em profundidade) com
    // fallback "Falha no Módulo / Recarregar". Esse boundary captura o erro
    // ANTES do externo (CustomFallback), então validamos o fallback interno.
    // Objetivo do teste continua sendo: SEM warning de ref ao lançar.
    render(
      <EnhancedErrorBoundary fallback={<CustomFallback />}>
        <MemoryRouter initialEntries={["/p"]}>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/p" element={<Boom message="p-boom" />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </EnhancedErrorBoundary>,
    );
    // Boundary interno do ProtectedRoute capturou — fallback "Falha no Módulo"
    screen.getByText("Falha no Módulo");
    guard.expectNoRefWarning("ProtectedRoute child Boom");
  });

  it("EnhancedErrorBoundary aninhado dentro de rota protegida — fallback sem warning", () => {
    // Padrão real do projeto: cada página crítica envolve seu próprio boundary.
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route
              path="/admin"
              element={
                <EnhancedErrorBoundary fallback={<CustomFallback />}>
                  <Boom message="nested-boom" />
                </EnhancedErrorBoundary>
              }
            />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    screen.getByText("custom-error-fallback");
    guard.expectNoRefWarning("AdminRoute > nested EnhancedErrorBoundary");
  });

  it("EnhancedErrorBoundary com fallback padrão (UI completa) — sem warning de ref", () => {
    // Sem `fallback` custom: o EnhancedErrorBoundary renderiza sua UI rica
    // (Card + Button + Collapsible). Esse caminho exercita componentes
    // shadcn/Radix sob o boundary — exatamente o padrão do main.tsx global.
    render(
      <EnhancedErrorBoundary>
        <MemoryRouter initialEntries={["/x"]}>
          <Routes>
            <Route element={<Outlet />}>
              <Route path="/x" element={<Boom message="full-ui" />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </EnhancedErrorBoundary>,
    );
    // A UI default contém o título "Algo deu errado" / botões — basta
    // confirmar que renderizou alguma role="alert" ou botão "Tentar novamente".
    // (Não dependemos do texto exato para não acoplar ao copy.)
    const buttons = screen.queryAllByRole("button");
    if (buttons.length === 0) {
      throw new Error("EnhancedErrorBoundary default UI não renderizou botões.");
    }
    guard.expectNoRefWarning("EnhancedErrorBoundary default UI");
  });

  it("Recover via remount após erro (key bump) — sem warning de ref", () => {
    // Simula o fluxo "Tentar novamente" que reinicia a árvore via key bump.
    const Harness = () => {
      const [k, setK] = React.useState(0);
      return (
        <>
          <button onClick={() => setK((v) => v + 1)}>retry</button>
          <EnhancedErrorBoundary key={k} fallback={<CustomFallback />}>
            <Boom message="retry-boom" />
          </EnhancedErrorBoundary>
        </>
      );
    };
    render(<Harness />);
    screen.getByText("custom-error-fallback");
    fireEvent.click(screen.getByText("retry"));
    // Após remount, o boundary captura novamente e exibe fallback.
    screen.getByText("custom-error-fallback");
    guard.expectNoRefWarning("EnhancedErrorBoundary remount cycle");
  });
});
