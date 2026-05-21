/**
 * useUrlState / useUrlBoolean — sincronia com URL search params.
 */
import { describe, it, expect } from "vitest";
import { act } from "@testing-library/react";
import { renderHookWithProviders } from "./_helpers/render-hook-providers";
import { useUrlState, useUrlBoolean } from "@/hooks/common/useUrlState";

describe("useUrlState", () => {
  it("retorna defaultValue quando param ausente", () => {
    const { result } = renderHookWithProviders(() => useUrlState("view", "grid"), { route: "/" });
    expect(result.current[0]).toBe("grid");
  });

  it("lê valor do param da URL", () => {
    const { result } = renderHookWithProviders(() => useUrlState("view", "grid"), { route: "/?view=list" });
    expect(result.current[0]).toBe("list");
  });

  it("setValue atualiza para valor não-default", () => {
    const { result } = renderHookWithProviders(() => useUrlState("view", "grid"), { route: "/" });
    act(() => { result.current[1]("table"); });
    expect(result.current[0]).toBe("table");
  });

  it("setValue removendo (igual ao default) limpa o param", () => {
    const { result } = renderHookWithProviders(() => useUrlState("view", "grid"), { route: "/?view=list" });
    act(() => { result.current[1]("grid"); });
    expect(result.current[0]).toBe("grid");
  });
});

describe("useUrlBoolean", () => {
  it("retorna defaultValue quando ausente", () => {
    const { result } = renderHookWithProviders(() => useUrlBoolean("admin", false), { route: "/" });
    expect(result.current[0]).toBe(false);
  });

  it("aceita '1', 'true' como true", () => {
    const { result: r1 } = renderHookWithProviders(() => useUrlBoolean("a", false), { route: "/?a=1" });
    expect(r1.current[0]).toBe(true);
    const { result: r2 } = renderHookWithProviders(() => useUrlBoolean("a", false), { route: "/?a=true" });
    expect(r2.current[0]).toBe(true);
    const { result: r3 } = renderHookWithProviders(() => useUrlBoolean("a", false), { route: "/?a=0" });
    expect(r3.current[0]).toBe(false);
  });

  it("setValue alterna o param", () => {
    const { result } = renderHookWithProviders(() => useUrlBoolean("a", false), { route: "/" });
    act(() => { result.current[1](true); });
    expect(result.current[0]).toBe(true);
  });
});
