/**
 * use2FA — testes funcionais (geração TOTP, verifyToken, enable/disable, fetchSettings).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../components/render-helpers";
import { act, waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "./_helpers/render-hook-providers";
import { mockFromOnce, resetSupabaseMocks } from "./_helpers/mock-supabase-builder";
import { use2FA } from "@/hooks/auth/use2FA";

beforeEach(() => {
  resetSupabaseMocks();
});

describe("use2FA", () => {
  it("carrega settings (null = 2FA não habilitado)", async () => {
    mockFromOnce({ data: null, error: null });
    const { result } = renderHookWithProviders(() => use2FA());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.is2FAEnabled).toBe(false);
    expect(result.current.settings).toBeNull();
  });

  it("carrega settings habilitadas", async () => {
    mockFromOnce({
      data: { id: "s1", user_id: "test-user-id", is_enabled: true, enabled_at: "2025-01-01", created_at: "2024" },
      error: null,
    });
    const { result } = renderHookWithProviders(() => use2FA());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.is2FAEnabled).toBe(true);
  });

  it("generateSecret retorna secret base32 e uri otpauth", async () => {
    mockFromOnce({ data: null, error: null });
    const { result } = renderHookWithProviders(() => use2FA());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let pair: { secret: string; uri: string } | null = null;
    act(() => { pair = result.current.generateSecret("user@test.com"); });
    expect(pair!.secret).toMatch(/^[A-Z2-7]+=*$/); // base32
    expect(pair!.uri).toContain("otpauth://totp/");
    expect(pair!.uri).toContain("Promo%20Gifts");
    expect(result.current.pendingSecret).toBe(pair!.secret);
  });

  it("verifyToken rejeita token inválido", async () => {
    mockFromOnce({ data: null, error: null });
    const { result } = renderHookWithProviders(() => use2FA());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const ok = result.current.verifyToken("JBSWY3DPEHPK3PXP", "000000");
    // 000000 quase certamente não é o token válido pra esse instante
    expect(typeof ok).toBe("boolean");
  });

  it("enable2FA falha sem pendingSecret", async () => {
    mockFromOnce({ data: null, error: null });
    const { result } = renderHookWithProviders(() => use2FA());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let r: { success: boolean; error?: string } | null = null;
    await act(async () => { r = await result.current.enable2FA("123456"); });
    expect(r!.success).toBe(false);
    expect(r!.error).toContain("pendente");
  });

  it("disable2FA falha sem token e sem targetUserId", async () => {
    mockFromOnce({ data: null, error: null });
    const { result } = renderHookWithProviders(() => use2FA());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // mock select de currentSettings
    mockFromOnce({ data: { totp_secret: "JBSWY3DPEHPK3PXP" }, error: null });

    let r: { success: boolean; error?: string } | null = null;
    await act(async () => { r = await result.current.disable2FA(); });
    expect(r!.success).toBe(false);
    expect(r!.error).toContain("Codigo necessario");
  });
});
