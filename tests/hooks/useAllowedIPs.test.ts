/**
 * useAllowedIPs — testes funcionais.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "../components/render-helpers";
import { act, waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "./_helpers/render-hook-providers";
import { mockFromOnce, resetSupabaseMocks } from "./_helpers/mock-supabase-builder";
import { useAllowedIPs } from "@/hooks/admin/useAllowedIPs";

beforeEach(() => {
  resetSupabaseMocks();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ ip: "9.9.9.9" }),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useAllowedIPs", () => {
  it("carrega lista de IPs do usuário", async () => {
    const ips = [
      { id: "1", user_id: "test-user-id", ip_address: "1.1.1.1", label: "casa", is_active: true, created_at: "2025-01-01" },
    ];
    mockFromOnce({ data: ips, error: null });
    const { result } = renderHookWithProviders(() => useAllowedIPs());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.allowedIPs).toHaveLength(1);
    expect(result.current.hasIPRestriction).toBe(true);
  });

  it("isIPAllowed permite tudo quando lista vazia", async () => {
    mockFromOnce({ data: [], error: null });
    const { result } = renderHookWithProviders(() => useAllowedIPs());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isIPAllowed("1.2.3.4")).toBe(true);
    expect(result.current.hasIPRestriction).toBe(false);
  });

  it("isIPAllowed bloqueia IPs não cadastrados quando há restrição", async () => {
    mockFromOnce({
      data: [{ id: "1", user_id: "u", ip_address: "10.0.0.1", label: null, is_active: true, created_at: "" }],
      error: null,
    });
    const { result } = renderHookWithProviders(() => useAllowedIPs());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isIPAllowed("10.0.0.1")).toBe(true);
    expect(result.current.isIPAllowed("8.8.8.8")).toBe(false);
  });

  it("addIP retorna erro 'já cadastrado' em conflito 23505", async () => {
    mockFromOnce({ data: [], error: null }); // load inicial
    const { result } = renderHookWithProviders(() => useAllowedIPs());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockFromOnce({ data: null, error: { message: "dup", code: "23505" } });
    let r: { success: boolean; error?: string } | null = null;
    await act(async () => { r = await result.current.addIP("1.1.1.1"); });
    expect(r!.success).toBe(false);
    expect(r!.error).toContain("já está cadastrado");
  });

  it("currentIP é populado pelo ipify", async () => {
    mockFromOnce({ data: [], error: null });
    const { result } = renderHookWithProviders(() => useAllowedIPs());
    await waitFor(() => expect(result.current.currentIP).toBe("9.9.9.9"));
  });
});
