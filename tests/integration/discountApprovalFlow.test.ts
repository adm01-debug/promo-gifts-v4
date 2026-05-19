/**
 * E2E/Integration test: Discount Approval Workflow
 *
 * Testa o fluxo completo: vendedor solicita > admin aprova/rejeita > notificações.
 *
 * Modos:
 *  1) MOCK (default em CI): simula a sequência de chamadas ao Supabase com mocks
 *     orquestrados, validando a ORDEM e o PAYLOAD de cada operação do hook
 *     `useDiscountApproval`.
 *  2) LIVE (opt-in): se as variáveis de ambiente abaixo estiverem definidas,
 *     o teste executa contra o Supabase real, autenticando dois usuários fixos
 *     criados via painel Auth + a função RPC `seed_discount_test_users`.
 *
 * Para rodar em modo LIVE:
 *   INTEGRATION_TEST_SUPABASE_URL=...
 *   INTEGRATION_TEST_SUPABASE_ANON_KEY=...
 *   INTEGRATION_TEST_SELLER_PASSWORD=...
 *   INTEGRATION_TEST_ADMIN_PASSWORD=...
 *   bunx vitest run tests/integration/discountApprovalFlow.test.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ─────────────────────────────────────────────────────────────
// Hoisted mock state — accessible inside vi.mock factories
// ─────────────────────────────────────────────────────────────

const H = vi.hoisted(() => {
  const SELLER_ID = "seller-test-uuid";
  const ADMIN_ID = "admin-test-uuid";
  const QUOTE_ID = "quote-test-uuid";
  const REQUEST_ID = "request-test-uuid";

  type Op = {
    table: string;
    method: string;
    payload?: unknown;
    filter?: { col: string; val: unknown };
  };
  const ops: Op[] = [];

  function makeBuilder(table: string, results: Record<string, unknown> = {}) {
    let currentMethod = "select";
    let currentPayload: unknown = undefined;
    let currentFilter: { col: string; val: unknown } | undefined;

    const record = () => {
      ops.push({ table, method: currentMethod, payload: currentPayload, filter: currentFilter });
    };

    const builder: Record<string, unknown> = {};
    Object.assign(builder, {
      select: (_cols?: string) => builder,
      insert: (payload: unknown) => {
        currentMethod = "insert";
        currentPayload = payload;
        record();
        return builder;
      },
      update: (payload: unknown) => {
        currentMethod = "update";
        currentPayload = payload;
        return builder;
      },
      eq: (col: string, val: unknown) => {
        currentFilter = { col, val };
        if (currentMethod === "update") record();
        return builder;
      },
      in: () => builder,
      order: () => builder,
      limit: () => builder,
      single: () => Promise.resolve({ data: results.single ?? null, error: null }),
      maybeSingle: () => Promise.resolve({ data: results.maybeSingle ?? null, error: null }),
      then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
        resolve({ data: results.list ?? [], error: null }),
    });
    return builder;
  }

  let overrides: Record<string, Record<string, unknown>> = {};

  function defaultResults(table: string): Record<string, unknown> {
    if (overrides[table]) return overrides[table];
    switch (table) {
      case "discount_approval_requests":
        return {
          single: {
            id: REQUEST_ID,
            quote_id: QUOTE_ID,
            seller_id: SELLER_ID,
            requested_discount_percent: 15,
            max_allowed_percent: 10,
            status: "approved",
          },
        };
      case "user_roles":
        return { list: [{ user_id: ADMIN_ID }] };
      case "profiles":
        return { maybeSingle: { full_name: "Vendedor Teste" } };
      default:
        return {};
    }
  }

  let currentUser: { id: string; email: string } | null = {
    id: SELLER_ID,
    email: "seller-test@discount-approval.test",
  };

  return {
    SELLER_ID, ADMIN_ID, QUOTE_ID, REQUEST_ID,
    ops,
    fromImpl: (table: string) => makeBuilder(table, defaultResults(table)),
    setOverride: (table: string, results: Record<string, unknown>) => {
      overrides[table] = results;
    },
    clearOverrides: () => { overrides = {}; },
    getUser: () => currentUser,
    setUser: (u: { id: string; email: string } | null) => { currentUser = u; },
  };
});

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => H.fromImpl(table) },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: H.getUser(),
    loading: false,
    isAdmin: H.getUser()?.id === H.ADMIN_ID,
  }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

// Imports AFTER mocks
import { useDiscountApproval } from "@/hooks/quotes";
import { toast } from "sonner";

const { SELLER_ID, ADMIN_ID, QUOTE_ID, REQUEST_ID, ops } = H;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function setUser(role: "seller" | "admin" | "none") {
  if (role === "none") { H.setUser(null); return; }
  H.setUser(
    role === "seller"
      ? { id: SELLER_ID, email: "seller-test@discount-approval.test" }
      : { id: ADMIN_ID, email: "admin-test@discount-approval.test" }
  );
}

beforeEach(() => {
  ops.length = 0;
  H.clearOverrides();
  vi.clearAllMocks();
  setUser("seller");
});

// ─────────────────────────────────────────────────────────────
// 1. Vendedor solicita aprovação (happy path)
// ─────────────────────────────────────────────────────────────
describe("E2E: Vendedor solicita aprovação de desconto", () => {
  it("cria request, atualiza quote, loga histórico e notifica admins", async () => {
    setUser("seller");
    const { result } = renderHook(() => useDiscountApproval());

    let success = false;
    await act(async () => {
      success = await result.current.requestApproval(QUOTE_ID, 15, 10, "Cliente VIP");
    });

    expect(success).toBe(true);
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("Solicitação de aprovação enviada")
    );

    // Operação 1: insert em discount_approval_requests
    const reqInsert = ops.find(o => o.table === "discount_approval_requests" && o.method === "insert");
    expect(reqInsert).toBeDefined();
    expect(reqInsert?.payload).toMatchObject({
      quote_id: QUOTE_ID,
      seller_id: SELLER_ID,
      requested_discount_percent: 15,
      max_allowed_percent: 10,
      seller_notes: "Cliente VIP",
    });

    // Operação 2: update do quote para pending_approval
    const quoteUpdate = ops.find(o => o.table === "quotes" && o.method === "update");
    expect(quoteUpdate?.payload).toEqual({ status: "pending_approval" });
    expect(quoteUpdate?.filter).toEqual({ col: "id", val: QUOTE_ID });

    // Operação 3: insert em quote_history
    const history = ops.find(o => o.table === "quote_history" && o.method === "insert");
    expect(history?.payload).toMatchObject({
      action: "discount_approval_requested",
      field_changed: "discount",
      new_value: "15%",
    });

    // Operação 4: notificações para admins
    const notifs = ops.find(o => o.table === "workspace_notifications" && o.method === "insert");
    expect(notifs).toBeDefined();
    const payload = notifs?.payload as Array<{ user_id: string; category: string }>;
    expect(Array.isArray(payload)).toBe(true);
    expect(payload[0]).toMatchObject({
      user_id: ADMIN_ID,
      category: "discount",
    });
  });

  it("retorna false se não houver usuário autenticado", async () => {
    setUser("none");
    const { result } = renderHook(() => useDiscountApproval());
    let success = true;
    await act(async () => {
      success = await result.current.requestApproval(QUOTE_ID, 15, 10);
    });
    expect(success).toBe(false);
  });

  it("não envia notificação se nenhum admin existir", async () => {
    setUser("seller");
    H.setOverride("user_roles", { list: [] });
    const { result } = renderHook(() => useDiscountApproval());
    await act(async () => {
      await result.current.requestApproval(QUOTE_ID, 15, 10);
    });
    const notifs = ops.find(o => o.table === "workspace_notifications" && o.method === "insert");
    expect(notifs).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Admin aprova
// ─────────────────────────────────────────────────────────────
describe("E2E: Admin aprova solicitação", () => {
  it("atualiza request, muda quote para 'pending', loga histórico e notifica vendedor", async () => {
    setUser("admin");
    const { result } = renderHook(() => useDiscountApproval());

    let success = false;
    await act(async () => {
      success = await result.current.respondToApproval(REQUEST_ID, true, "Aprovado");
    });

    expect(success).toBe(true);
    expect(toast.success).toHaveBeenCalledWith("Desconto aprovado!");

    // Update no request
    const reqUpdate = ops.find(o => o.table === "discount_approval_requests" && o.method === "update");
    expect(reqUpdate?.payload).toMatchObject({
      status: "approved",
      admin_id: ADMIN_ID,
      admin_notes: "Aprovado",
    });
    expect(reqUpdate?.payload).toHaveProperty("responded_at");

    // Quote vai para pending
    const quoteUpdate = ops.find(o => o.table === "quotes" && o.method === "update");
    expect(quoteUpdate?.payload).toEqual({ status: "pending" });

    // Histórico de aprovação
    const history = ops.find(o => o.table === "quote_history" && o.method === "insert");
    expect(history?.payload).toMatchObject({
      action: "discount_approved",
      field_changed: "discount",
    });

    // Notificação ao vendedor
    const notif = ops.find(o => o.table === "workspace_notifications" && o.method === "insert");
    expect(notif?.payload).toMatchObject({
      user_id: SELLER_ID,
      type: "success",
      category: "discount",
    });
    expect((notif?.payload as { title: string }).title).toContain("aprovado");
  });
});

// ─────────────────────────────────────────────────────────────
// 3. Admin rejeita
// ─────────────────────────────────────────────────────────────
describe("E2E: Admin rejeita solicitação", () => {
  it("muda quote para 'draft' e notifica vendedor com type=error", async () => {
    setUser("admin");
    H.setOverride("discount_approval_requests", {
      single: {
        id: REQUEST_ID,
        quote_id: QUOTE_ID,
        seller_id: SELLER_ID,
        requested_discount_percent: 20,
        max_allowed_percent: 10,
        status: "rejected",
      },
    });

    const { result } = renderHook(() => useDiscountApproval());

    let success = false;
    await act(async () => {
      success = await result.current.respondToApproval(REQUEST_ID, false, "Margem insuficiente");
    });

    expect(success).toBe(true);
    expect(toast.success).toHaveBeenCalledWith("Desconto rejeitado");

    const quoteUpdate = ops.find(o => o.table === "quotes" && o.method === "update");
    expect(quoteUpdate?.payload).toEqual({ status: "draft" });

    const notif = ops.find(o => o.table === "workspace_notifications" && o.method === "insert");
    expect(notif?.payload).toMatchObject({
      user_id: SELLER_ID,
      type: "error",
      category: "discount",
    });
    expect((notif?.payload as { message: string }).message).toContain("Margem insuficiente");
  });
});

// ─────────────────────────────────────────────────────────────
// 4. LIVE mode (opcional, contra Supabase real)
// ─────────────────────────────────────────────────────────────

const LIVE_URL = process.env.INTEGRATION_TEST_SUPABASE_URL;
const LIVE_KEY = process.env.INTEGRATION_TEST_SUPABASE_ANON_KEY;
const SELLER_PWD = process.env.INTEGRATION_TEST_SELLER_PASSWORD;
const ADMIN_PWD = process.env.INTEGRATION_TEST_ADMIN_PASSWORD;

const liveDescribe = LIVE_URL && LIVE_KEY && SELLER_PWD && ADMIN_PWD ? describe : describe.skip;

liveDescribe("E2E LIVE: fluxo real contra Supabase", () => {
  it("seed > seller request > admin approve > notification", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const supa = createClient(LIVE_URL!, LIVE_KEY!);

    // 1. Login seller
    const sellerLogin = await supa.auth.signInWithPassword({
      email: "seller-test@discount-approval.test",
      password: SELLER_PWD!,
    });
    expect(sellerLogin.error).toBeNull();
    const sellerId = sellerLogin.data.user!.id;

    // 2. Seed roles
    const seedRes = await supa.rpc("seed_discount_test_users");
    expect((seedRes.data as { ok: boolean }).ok).toBe(true);

    // 3. Cleanup
    await supa.rpc("cleanup_discount_test_data");

    // 4. Quote
    const { data: quote, error: qErr } = await supa
      .from("quotes")
      .insert({
        seller_id: sellerId,
        client_name: "Cliente E2E",
        subtotal: 1000,
        total: 850,
        discount_percent: 15,
        discount_amount: 150,
        status: "draft",
      })
      .select("id")
      .single();
    expect(qErr).toBeNull();

    // 5. Request
    const { error: reqErr } = await supa
      .from("discount_approval_requests")
      .insert({
        quote_id: quote!.id,
        seller_id: sellerId,
        requested_discount_percent: 15,
        max_allowed_percent: 10,
        seller_notes: "Test E2E",
      });
    expect(reqErr).toBeNull();

    // 6. Admin login & approve
    await supa.auth.signOut();
    const adminLogin = await supa.auth.signInWithPassword({
      email: "admin-test@discount-approval.test",
      password: ADMIN_PWD!,
    });
    expect(adminLogin.error).toBeNull();
    const adminId = adminLogin.data.user!.id;

    const { data: pending } = await supa
      .from("discount_approval_requests")
      .select("id")
      .eq("quote_id", quote!.id)
      .single();

    const { error: updErr } = await supa
      .from("discount_approval_requests")
      .update({
        status: "approved",
        admin_id: adminId,
        admin_notes: "OK E2E",
        responded_at: new Date().toISOString(),
      })
      .eq("id", pending!.id);
    expect(updErr).toBeNull();

    // 7. Verifica notificação criada pelo trigger
    const { data: notifs } = await supa
      .from("workspace_notifications")
      .select("user_id, type, category")
      .eq("user_id", sellerId)
      .eq("category", "quotes")
      .order("created_at", { ascending: false })
      .limit(1);
    expect(notifs?.length).toBeGreaterThan(0);
    expect(notifs![0].type).toBe("success");

    // 8. Cleanup
    await supa.rpc("cleanup_discount_test_data");
  }, 30_000);
});
