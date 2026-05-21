/**
 * useRBAC — testes funcionais (hierarquia atual: dev > supervisor > agente).
 * Mantém compatibilidade com nomes legados (admin/manager/seller) que ainda
 * vivem em `role_permissions` no banco.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../components/render-helpers"; // ativa mocks globais (Supabase, Auth, sonner)
import { useAuth } from "@/contexts/AuthContext";
import { renderHookWithProviders } from "./_helpers/render-hook-providers";
import { mockFromOnce, resetSupabaseMocks } from "./_helpers/mock-supabase-builder";
import { useRBAC } from "@/hooks/auth/useRBAC";
import { waitFor } from "@testing-library/react";

const mockedUseAuth = vi.mocked(useAuth);

function authMock(overrides: Record<string, unknown> = {}) {
  return {
    // @ts-expect-error mock parcial
    user: { id: "user-1", email: "u@test.com" },
    session: { access_token: "tok" },
    loading: false,
    isLoading: false,
    profile: { id: "profile-1" },
    role: "vendedor",
    roles: ["vendedor"],
    isDev: false,
    isSupervisor: false,
    isSupervisorOrAbove: false,
    isAgente: true,
    signOut: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  resetSupabaseMocks();
  mockedUseAuth.mockReturnValue(authMock() as never);
});

describe("useRBAC", () => {
  it("dev tem wildcard mesmo sem permissões no banco", async () => {
    mockedUseAuth.mockReturnValue(
      authMock({
        user: { id: "u" },
        role: "dev",
        roles: ["dev"],
        isDev: true,
        isSupervisor: true,
        isSupervisorOrAbove: true,
        isAgente: false,
      }) as never
    );
    mockFromOnce({ data: [], error: null });

    const { result } = renderHookWithProviders(() => useRBAC());
    expect(result.current.isDev).toBe(true);
    expect(result.current.isAdmin).toBe(true); // alias legado
    expect(result.current.hasPermission("delete", "anything")).toBe(true);
    expect(result.current.hasPermissionByCode("any_code")).toBe(true);
  });

  it("agente recebe permissões do banco e parseia code → action/resource", async () => {
    mockFromOnce({
      data: [{ permission_code: "create_quotes" }, { permission_code: "view_catalog" }],
      error: null,
    });

    const { result } = renderHookWithProviders(() => useRBAC());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.role.name).toBe("agente");
    expect(result.current.hasPermission("create", "quotes")).toBe(true);
    expect(result.current.hasPermission("view", "catalog")).toBe(true);
    expect(result.current.hasPermission("delete", "quotes")).toBe(false);
    expect(result.current.hasPermissionByCode("create_quotes")).toBe(true);
    expect(result.current.hasPermissionByCode("delete_quotes")).toBe(false);
  });

  it("hasRole considera o role atual (agente)", async () => {
    mockFromOnce({ data: [], error: null });
    const { result } = renderHookWithProviders(() => useRBAC());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasRole("agente")).toBe(true);
    expect(result.current.hasRole("dev")).toBe(false);
    expect(result.current.hasRole("dev", "supervisor", "agente")).toBe(true);
  });

  it("isManagerOrAbove (alias) é false para agente", async () => {
    mockFromOnce({ data: [], error: null });
    const { result } = renderHookWithProviders(() => useRBAC());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isManagerOrAbove).toBe(false);
    expect(result.current.isSupervisorOrAbove).toBe(false);
  });

  it("supervisor passa em meetsRequiredRole('supervisor') mas não em 'dev'", async () => {
    mockedUseAuth.mockReturnValue(
      authMock({
        role: "supervisor",
        roles: ["supervisor"],
        isSupervisor: true,
        isSupervisorOrAbove: true,
        isAgente: false,
      }) as never
    );
    mockFromOnce({ data: [], error: null });
    const { result } = renderHookWithProviders(() => useRBAC());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.role.name).toBe("supervisor");
    expect(result.current.meetsRequiredRole("supervisor")).toBe(true);
    expect(result.current.meetsRequiredRole("dev")).toBe(false);
    expect(result.current.meetsRequiredRole("agente")).toBe(true);
  });

  it("erro na query → permissions = [] (sem crash)", async () => {
    mockFromOnce({ data: null, error: { message: "boom" } });
    const { result } = renderHookWithProviders(() => useRBAC());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.getPermissions()).toEqual([]);
  });
});
