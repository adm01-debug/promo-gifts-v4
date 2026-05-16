/**
 * Integration tests — Route guards de sessão e permissão.
 *
 * Cobre os redirects/bloqueios exigidos pela política de auth:
 *  1. ProtectedRoute sem sessão → /auth com state.from preservado
 *  2. AdminRoute sem sessão → /auth com state.from preservado
 *  3. DevRoute sem sessão → /auth com state.from preservado
 *  4. ProtectedRoute com sessão mas role insuficiente → bloqueia (EmptyState)
 *  5. AdminRoute com sessão mas sem canManage → bloqueia (EmptyState)
 *  6. DevRoute com sessão mas não-dev → DevAccessDeniedPage
 *  7. Acessar destino privado após "login" entrega o conteúdo (Outlet)
 *  8. savePostLoginRedirect é chamado com o path bloqueado (sobrevive ao OAuth round-trip)
 */
import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import * as React from "react";
import { render, cleanup, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";

// ---- Auth state mockado (controlável por teste) -----------------------------
const authState = {
  user: null as null | { id: string; email: string },
  isLoading: false,
  canManage: false,
  isDev: false,
  isSupervisorOrAbove: false,
  roles: [] as string[],
  hasMFA: false,
  mfaRequired: false,
  currentAAL: "aal1" as "aal1" | "aal2",
  role: "agente" as string | null,
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---- Mocks neutros para subdependências --------------------------------------
vi.mock("@/components/security/MfaEnrollmentDialog", () => ({
  MfaEnrollmentDialog: () => null,
}));
vi.mock("@/components/security/MfaChallengeDialog", () => ({
  MfaChallengeDialog: () => null,
}));
vi.mock("@/components/access/DevAccessDeniedPage", () => ({
  DevAccessDeniedPage: () => <div data-testid="dev-denied">dev-access-denied</div>,
}));
vi.mock("@/lib/access/log-access-denied", () => ({
  logAccessDenied: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

// Espia savePostLoginRedirect para checar persistência de destino.
const savePostLoginRedirect = vi.fn();
vi.mock("@/lib/auth/post-login-redirect", () => ({
  savePostLoginRedirect: (path: string) => savePostLoginRedirect(path),
}));

import { AdminRoute } from "@/components/layout/AdminRoute";
import { DevRoute } from "@/components/layout/DevRoute";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";

// ---- Helpers -----------------------------------------------------------------

/** Renderiza /auth e expõe pathname + state.from para asserções. */
function AuthProbe() {
  const loc = useLocation();
  const from = (loc.state as { from?: { pathname?: string } } | null)?.from;
  return (
    <div>
      <span data-testid="probe-path">{loc.pathname}</span>
      <span data-testid="probe-from">{from?.pathname ?? "(none)"}</span>
    </div>
  );
}

function renderApp(initialPath: string, guard: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<div>home</div>} />
        <Route path="/auth" element={<AuthProbe />} />
        <Route path="/login" element={<AuthProbe />} />
        <Route element={guard}>
          <Route path="/admin" element={<div data-testid="admin-child">admin-content</div>} />
          <Route path="/dev" element={<div data-testid="dev-child">dev-content</div>} />
          <Route path="/p" element={<div data-testid="p-child">protected-content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

function resetAuth() {
  Object.assign(authState, {
    user: null,
    isLoading: false,
    canManage: false,
    isDev: false,
    isSupervisorOrAbove: false,
    roles: [],
    hasMFA: false,
    mfaRequired: false,
    currentAAL: "aal1" as const,
    role: "agente",
  });
}

// =============================================================================

describe("Route guards — exigem sessão (redirect → /auth)", () => {
  beforeEach(() => {
    resetAuth();
    savePostLoginRedirect.mockClear();
  });
  afterEach(() => cleanup());

  it("ProtectedRoute sem sessão redireciona para /auth e preserva state.from", () => {
    renderApp("/p?x=1", <ProtectedRoute />);

    expect(screen.getByTestId("probe-path").textContent).toBe("/auth");
    expect(screen.getByTestId("probe-from").textContent).toBe("/p");
    // Persistência cross-tab para sobreviver ao OAuth round-trip:
    expect(savePostLoginRedirect).toHaveBeenCalledWith("/p?x=1");
  });

  it("AdminRoute sem sessão redireciona para /auth e preserva state.from", () => {
    renderApp("/admin", <AdminRoute />);

    expect(screen.getByTestId("probe-path").textContent).toBe("/auth");
    expect(screen.getByTestId("probe-from").textContent).toBe("/admin");
  });

  it("DevRoute sem sessão redireciona para /auth e preserva state.from", () => {
    renderApp("/dev", <DevRoute />);

    expect(screen.getByTestId("probe-path").textContent).toBe("/auth");
    expect(screen.getByTestId("probe-from").textContent).toBe("/dev");
  });

  it("ProtectedRoute em loading não redireciona (renderiza spinner)", () => {
    authState.isLoading = true;
    renderApp("/p", <ProtectedRoute />);

    // Não saiu de /p para /auth
    expect(screen.queryByTestId("probe-path")).toBeNull();
    expect(screen.queryByTestId("p-child")).toBeNull();
  });
});

describe("Route guards — usuário sem permissão é bloqueado corretamente", () => {
  beforeEach(() => {
    resetAuth();
    // Usuário autenticado mas sem privilégios elevados
    authState.user = { id: "u1", email: "agente@test.com" };
    authState.role = "agente";
  });
  afterEach(() => cleanup());

  it("AdminRoute com sessão de agente bloqueia (não renderiza filho)", () => {
    renderApp("/admin", <AdminRoute />);

    expect(screen.queryByTestId("admin-child")).toBeNull();
    // EmptyState do AdminRoute exibe a copy "Área Administrativa"
    expect(screen.getByText("Área Administrativa")).toBeTruthy();
  });

  it("DevRoute com sessão de agente renderiza DevAccessDeniedPage", () => {
    renderApp("/dev", <DevRoute />);

    expect(screen.queryByTestId("dev-child")).toBeNull();
    expect(screen.getByTestId("dev-denied")).toBeTruthy();
  });

  it("ProtectedRoute com requiredRole=supervisor bloqueia agente", () => {
    renderApp(
      "/p",
      <ProtectedRoute requiredRole="supervisor" />,
    );

    expect(screen.queryByTestId("p-child")).toBeNull();
    expect(screen.getByText("Acesso Restrito")).toBeTruthy();
  });

  it("ProtectedRoute sem requiredRole permite agente autenticado (Outlet)", () => {
    renderApp("/p", <ProtectedRoute />);

    expect(screen.getByTestId("p-child").textContent).toBe("protected-content");
  });
});

describe("Route guards — autorização concedida entrega conteúdo", () => {
  beforeEach(() => {
    resetAuth();
    Object.assign(authState, {
      user: { id: "u1", email: "admin@test.com" },
      canManage: true,
      isSupervisorOrAbove: true,
      hasMFA: true,
      mfaRequired: true,
      currentAAL: "aal2" as const,
      role: "supervisor",
    });
  });
  afterEach(() => cleanup());

  it("AdminRoute com supervisor + MFA aal2 renderiza filho", () => {
    renderApp("/admin", <AdminRoute />);
    expect(screen.getByTestId("admin-child").textContent).toBe("admin-content");
  });

  it("DevRoute com dev + MFA aal2 renderiza filho", () => {
    Object.assign(authState, { isDev: true, role: "dev" });
    renderApp("/dev", <DevRoute />);
    expect(screen.getByTestId("dev-child").textContent).toBe("dev-content");
  });
});
