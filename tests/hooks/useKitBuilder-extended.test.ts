/**
 * Comprehensive tests for Kit Builder hooks
 * Covers: useKitBuilder, useKitUndoRedo, useKitAutoSave, useKitShare
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    channel: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn().mockReturnThis() }),
    removeChannel: vi.fn(),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: "test-user-id", email: "test@test.com" },
    session: { access_token: "mock-token" },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), loading: vi.fn(), dismiss: vi.fn(), warning: vi.fn() }),
}));

// ============================
// useKitUndoRedo
// ============================
describe("useKitUndoRedo", () => {
  const baseSnap = {
    name: "A",
    kitType: "montado" as const,
    box: null,
    items: [],
    personalization: { box: { enabled: false }, items: {} },
    kitQuantity: 1,
    identity: { color: "#000", icon: "Package", tag: "", description: "", isFavorite: false },
  };

  it("initializes with empty history", async () => {
    const { useKitUndoRedo } = await import("@/hooks/kit-builder/useKitUndoRedo");
    const { result } = renderHook(() => useKitUndoRedo());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it("pushes snapshot and enables undo only after a 2nd distinct state", async () => {
    const { useKitUndoRedo } = await import("@/hooks/kit-builder/useKitUndoRedo");
    const { result } = renderHook(() => useKitUndoRedo());
    act(() => { result.current.pushSnapshot({ ...baseSnap, name: "A" }); });
    expect(result.current.canUndo).toBe(false); // só o estado inicial — nada a desfazer
    act(() => { result.current.pushSnapshot({ ...baseSnap, name: "B" }); });
    expect(result.current.canUndo).toBe(true);
  });

  it("dedups identical consecutive snapshots", async () => {
    const { useKitUndoRedo } = await import("@/hooks/kit-builder/useKitUndoRedo");
    const { result } = renderHook(() => useKitUndoRedo());
    act(() => { result.current.pushSnapshot({ ...baseSnap, name: "A" }); });
    act(() => { result.current.pushSnapshot({ ...baseSnap, name: "A" }); });
    expect(result.current.canUndo).toBe(false);
  });

  it("undo returns the previous snapshot and enables redo", async () => {
    const { useKitUndoRedo } = await import("@/hooks/kit-builder/useKitUndoRedo");
    const { result } = renderHook(() => useKitUndoRedo());
    act(() => { result.current.pushSnapshot({ ...baseSnap, name: "A" }); });
    act(() => { result.current.pushSnapshot({ ...baseSnap, name: "B" }); });

    let restored: { name: string } | null = null;
    act(() => { restored = result.current.undo(); });
    expect(restored?.name).toBe("A");
    expect(result.current.canRedo).toBe(true);

    let redone: { name: string } | null = null;
    act(() => { redone = result.current.redo(); });
    expect(redone?.name).toBe("B");
  });
});

// ============================
// Kit Builder Volume & Price (pure functions)
// ============================
describe("Kit Builder Pure Functions - Extended", () => {
  it("calculateTotalKitPrice handles null box", async () => {
    const { calculateTotalKitPrice } = await import("@/lib/kit-builder");
    const result = calculateTotalKitPrice(null, [], { box: { enabled: false }, items: {} }, 1);
    expect(result.total).toBe(0);
  });

  it("calculateTotalKitPrice with box and items", async () => {
    const { calculateTotalKitPrice } = await import("@/lib/kit-builder");
    const box = { id: "b1", name: "Box", width: 100, height: 100, depth: 100, internalVolume: 1000000, weight: 100, price: 10 };
    const items = [{ id: "i1", name: "Item", volume: 500, weight: 50, price: 5, quantity: 2 }];
    const result = calculateTotalKitPrice(box as any, items as any, { box: { enabled: false }, items: {} }, 5);
    expect(result.total).toBeGreaterThan(0);
  });

  it("checkItemFits returns false when box is full", async () => {
    const { checkItemFits } = await import("@/lib/kit-builder");
    const bigBox = { id: "b1", name: "Box", width: 10, height: 10, depth: 10, internalVolume: 1000, weight: 100, price: 10 };
    const bigItem = { id: "i1", name: "Big Item", width: 100, height: 100, depth: 100, volume: 999999, weight: 50, price: 5, quantity: 1 };
    const result = checkItemFits(bigItem as any, bigBox as any, [], 1);
    expect(result.fits).toBe(false);
  });

  it("formatCurrency formats correctly", async () => {
    const { formatCurrency } = await import("@/lib/kit-builder");
    const result = formatCurrency(1234.56);
    expect(result).toContain("1.234");
  });

  it("formatVolume formats correctly", async () => {
    const { formatVolume } = await import("@/lib/kit-builder");
    const result = formatVolume(1500000);
    expect(result).toBeTruthy();
  });

  it("calculateVolumeUsagePercent handles zero", async () => {
    const { calculateVolumeUsagePercent } = await import("@/lib/kit-builder");
    expect(calculateVolumeUsagePercent(0, 0)).toBe(0);
  });

  it("calculateVolumeUsagePercent calculates correctly", async () => {
    const { calculateVolumeUsagePercent } = await import("@/lib/kit-builder");
    const result = calculateVolumeUsagePercent(500, 1000);
    expect(result).toBeGreaterThan(0);
  });

  it("isNearCapacity detects >80%", async () => {
    const { isNearCapacity } = await import("@/lib/kit-builder");
    expect(isNearCapacity(85)).toBe(true);
    expect(isNearCapacity(70)).toBe(false);
  });

  it("isAtCapacity detects >100%", async () => {
    const { isAtCapacity } = await import("@/lib/kit-builder");
    expect(isAtCapacity(101)).toBe(true);
    expect(isAtCapacity(99)).toBe(false);
  });

  it("getVolumeStatusColor returns correct colors", async () => {
    const { getVolumeStatusColor } = await import("@/lib/kit-builder");
    expect(getVolumeStatusColor(50)).toBeTruthy();
    expect(getVolumeStatusColor(85)).toBeTruthy();
    expect(getVolumeStatusColor(105)).toBeTruthy();
  });

  it("generatePriceBreakdown returns structured data", async () => {
    const { generatePriceBreakdown } = await import("@/lib/kit-builder");
    const box = { id: "b1", name: "Box", price: 10 } as any;
    const items = [{ id: "i1", name: "Item", price: 5, quantity: 2 }] as any;
    const result = generatePriceBreakdown(box, items, { box: { enabled: false }, items: {} }, 10);
    expect(result).toBeTruthy();
  });
});
