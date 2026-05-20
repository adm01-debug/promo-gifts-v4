import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const invokeMock = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invokeMock(...args) } },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

import { useConnectionTester } from "@/hooks/intelligence/useConnectionTester";
import {
  makeTimeoutResult,
  makeNetworkResult,
  makeDnsResult,
  makeAuthResult,
  makeHttpResult,
  makeOkResult,
} from "../_helpers/connection-fixtures";

beforeEach(() => {
  invokeMock.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
});

async function runTest(result: ReturnType<typeof makeOkResult>, opts?: { silent?: boolean }) {
  invokeMock.mockResolvedValueOnce({ data: { result }, error: null });
  const { result: hook } = renderHook(() => useConnectionTester());
  let r: Awaited<ReturnType<typeof hook.current.test>> | undefined;
  await act(async () => {
    r = await hook.current.test("webhook_outbound", { silent: opts?.silent });
  });
  return { r: r!, hook };
}

describe("useConnectionTester", () => {
  it("Timeout: preserva error_kind, timeout_ms, latency e dispara toast 'Tempo esgotado'", async () => {
    const { r } = await runTest(makeTimeoutResult());
    expect(r.ok).toBe(false);
    expect(r.error_kind).toBe("timeout");
    expect(r.timeout_ms).toBe(12000);
    expect(r.latency_ms).toBe(12001);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(toastError.mock.calls[0][0]).toBe("Tempo esgotado");
    expect(toastError.mock.calls[0][1].description).toContain("12000");
  });

  it("Network error: kind preservado e toast 'Sem conexão'", async () => {
    const { r } = await runTest(makeNetworkResult());
    expect(r.error_kind).toBe("network");
    expect(r.latency_ms).toBe(47);
    expect(toastError.mock.calls[0][0]).toBe("Sem conexão com o serviço");
  });

  it("DNS: toast 'URL não encontrada'", async () => {
    const { r } = await runTest(makeDnsResult());
    expect(r.error_kind).toBe("dns");
    expect(toastError.mock.calls[0][0]).toBe("URL não encontrada");
  });

  it("Auth 401: toast 'Credenciais rejeitadas'", async () => {
    const { r } = await runTest(makeAuthResult());
    expect(r.error_kind).toBe("auth");
    expect(r.status).toBe(401);
    expect(toastError.mock.calls[0][0]).toBe("Credenciais rejeitadas");
  });

  it("HTTP 504: toast title contém '504'", async () => {
    const { r } = await runTest(makeHttpResult(504));
    expect(r.error_kind).toBe("http");
    expect(r.status).toBe(504);
    expect(toastError.mock.calls[0][0]).toContain("504");
  });

  it("Sucesso: toast.success e lastResult.ok=true", async () => {
    const { r, hook } = await runTest(makeOkResult());
    expect(r.ok).toBe(true);
    expect(r.latency_ms).toBe(120);
    expect(toastSuccess).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
    expect(hook.current.lastResult?.ok).toBe(true);
  });

  it("Silent mode: não dispara toast em falha", async () => {
    await runTest(makeTimeoutResult(), { silent: true });
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("Erro de invoke: retorna ok=false, kind=unknown e toast genérico", async () => {
    invokeMock.mockRejectedValueOnce(new Error("network down"));
    const { result: hook } = renderHook(() => useConnectionTester());
    let r: Awaited<ReturnType<typeof hook.current.test>> | undefined;
    await act(async () => {
      r = await hook.current.test("webhook_outbound");
    });
    expect(r!.ok).toBe(false);
    expect(r!.error_kind).toBe("unknown");
    expect(toastError).toHaveBeenCalledWith("Erro ao testar conexão", { description: "network down" });
  });

  it("Latência preservada em todos os cenários", async () => {
    const cases = [
      makeTimeoutResult({ latency_ms: 9999 }),
      makeNetworkResult({ latency_ms: 12 }),
      makeAuthResult({ latency_ms: 200 }),
      makeOkResult({ latency_ms: 33 }),
    ];
    for (const c of cases) {
      invokeMock.mockResolvedValueOnce({ data: { result: c }, error: null });
      const { result: hook } = renderHook(() => useConnectionTester());
      let r: Awaited<ReturnType<typeof hook.current.test>> | undefined;
      await act(async () => {
        r = await hook.current.test("webhook_outbound", { silent: true });
      });
      expect(r!.latency_ms).toBe(c.latency_ms);
    }
  });
});
