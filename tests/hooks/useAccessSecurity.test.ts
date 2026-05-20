/**
 * useAccessSecurity — testes funcionais.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../components/render-helpers";
import { act, waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "./_helpers/render-hook-providers";
import { resetSupabaseMocks, makeChain } from "./_helpers/mock-supabase-builder";
import { supabase } from "@/integrations/supabase/client";
import { useAccessSecurity } from "@/hooks/auth/useAccessSecurity";
import { toast } from "sonner";

const mockedFrom = supabase.from as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetSupabaseMocks();
  // 4 chamadas no fetchAll (settings, ips, cities, logs)
  mockedFrom
    .mockReturnValueOnce(makeChain({ data: { id: "s1", ip_whitelist_enabled: false, city_whitelist_enabled: false, block_unknown_locations: false, max_failed_attempts: 5, lockout_duration_minutes: 15 }, error: null }))
    .mockReturnValueOnce(makeChain({ data: [{ id: "ip1", ip_address: "1.1.1.1", label: "x", is_active: true, created_at: "" }], error: null }))
    .mockReturnValueOnce(makeChain({ data: [], error: null }))
    .mockReturnValueOnce(makeChain({ data: [], error: null }));
});

describe("useAccessSecurity", () => {
  it("carrega settings, IPs, cidades e logs em paralelo", async () => {
    const { result } = renderHookWithProviders(() => useAccessSecurity());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.settings?.id).toBe("s1");
    expect(result.current.ips).toHaveLength(1);
    expect(result.current.cities).toEqual([]);
    expect(result.current.blockedLogs).toEqual([]);
  });

  it("addIp insere e retorna true em sucesso", async () => {
    const { result } = renderHookWithProviders(() => useAccessSecurity());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockedFrom.mockReturnValueOnce(makeChain({
      data: { id: "ip2", ip_address: "2.2.2.2", label: "novo", is_active: true, created_at: "" },
      error: null,
    }));

    let ok = false;
    await act(async () => { ok = await result.current.addIp("2.2.2.2", "novo"); });
    expect(ok).toBe(true);
    expect(toast.success).toHaveBeenCalled();
  });

  it("addIp retorna false e mostra erro 'já cadastrado' em 23505", async () => {
    const { result } = renderHookWithProviders(() => useAccessSecurity());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockedFrom.mockReturnValueOnce(makeChain({ data: null, error: { code: "23505", message: "dup" } }));
    let ok = true;
    await act(async () => { ok = await result.current.addIp("1.1.1.1"); });
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("IP já cadastrado");
  });

  it("toggleIp atualiza estado local", async () => {
    const { result } = renderHookWithProviders(() => useAccessSecurity());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockedFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));
    await act(async () => { await result.current.toggleIp("ip1", false); });
    expect(result.current.ips[0].is_active).toBe(false);
  });

  it("removeIp filtra a lista", async () => {
    const { result } = renderHookWithProviders(() => useAccessSecurity());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockedFrom.mockReturnValueOnce(makeChain({ data: null, error: null }));
    await act(async () => { await result.current.removeIp("ip1"); });
    expect(result.current.ips).toHaveLength(0);
  });
});
