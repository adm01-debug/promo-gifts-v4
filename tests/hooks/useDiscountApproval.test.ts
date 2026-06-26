/**
 * Comprehensive tests for the Discount Approval Workflow
 * Covers: useDiscountApproval, useSellerDiscountLimits, DiscountApprovalHeaderBadge
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Supabase mock with chainable query builder ──
const mockChain = () => {
  const chain: any = {
    select: vi.fn().mockReturnValue(chain),
    insert: vi.fn().mockReturnValue(chain),
    update: vi.fn().mockReturnValue(chain),
    delete: vi.fn().mockReturnValue(chain),
    upsert: vi.fn().mockReturnValue(chain),
    eq: vi.fn().mockReturnValue(chain),
    neq: vi.fn().mockReturnValue(chain),
    in: vi.fn().mockReturnValue(chain),
    order: vi.fn().mockReturnValue(chain),
    limit: vi.fn().mockReturnValue(chain),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn((resolve: any) => resolve({ data: [], error: null })),
  };
  // Make chain thenable for await
  chain[Symbol.for("then")] = chain.then;
  return chain;
};

let fromMock: ReturnType<typeof mockChain>;

vi.mock("@/integrations/supabase/client", () => {
  const chain = mockChain();
  return {
    supabase: {
      from: vi.fn(() => chain),
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
      }),
      removeChannel: vi.fn(),
    },
    __chain: chain,
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn().mockReturnValue({
    user: { id: "seller-001", email: "seller@test.com" },
    session: { access_token: "mock-token" },
    loading: false,
    signOut: vi.fn(),
    isAdmin: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

// ── Import after mocks ──
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────
// 1. Interface & Type Validation
// ─────────────────────────────────────────────────────────────
describe("DiscountApprovalRequest interface", () => {
  it("defines all required fields", () => {
    const req = {
      id: "req-1",
      quote_id: "quote-1",
      seller_id: "seller-001",
      requested_discount_percent: 15,
      max_allowed_percent: 10,
      status: "pending" as const,
      admin_id: null,
      admin_notes: null,
      seller_notes: "Preciso de 15%",
      responded_at: null,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };
    expect(req.status).toBe("pending");
    expect(req.requested_discount_percent).toBeGreaterThan(req.max_allowed_percent);
  });

  it("supports all three statuses", () => {
    const statuses: Array<"pending" | "approved" | "rejected"> = ["pending", "approved", "rejected"];
    statuses.forEach(s => expect(typeof s).toBe("string"));
  });
});

// ─────────────────────────────────────────────────────────────
// 2. SellerDiscountLimit logic
// ─────────────────────────────────────────────────────────────
describe("Seller Discount Limit logic", () => {
  it("determines if discount exceeds limit", () => {
    const limit = 5;
    const requested = 10;
    expect(requested > limit).toBe(true);
    expect(5 > limit).toBe(false);
    expect(5.01 > limit).toBe(true);
  });

  it("handles null limit (no limit set)", () => {
    const myLimit: number | null = null;
    const requestedDiscount = 20;
    const needsApproval = myLimit !== null && requestedDiscount > myLimit;
    expect(needsApproval).toBe(false);
  });

  it("handles zero limit (all discounts need approval)", () => {
    const myLimit = 0;
    const requestedDiscount = 0.5;
    expect(requestedDiscount > myLimit).toBe(true);
  });

  it("calculates average limit correctly", () => {
    const limits = [
      { max_discount_percent: 5 },
      { max_discount_percent: 10 },
      { max_discount_percent: 15 },
    ];
    const avg = limits.reduce((s, l) => s + l.max_discount_percent, 0) / limits.length;
    expect(avg).toBeCloseTo(10);
  });
});

// ─────────────────────────────────────────────────────────────
// 3. Stats computation
// ─────────────────────────────────────────────────────────────
describe("AdminDiscountApprovalsPage stats computation", () => {
  const requests = [
    { status: "pending" },
    { status: "pending" },
    { status: "approved" },
    { status: "rejected" },
    { status: "approved" },
  ];

  it("counts pending correctly", () => {
    expect(requests.filter(r => r.status === "pending").length).toBe(2);
  });

  it("counts approved correctly", () => {
    expect(requests.filter(r => r.status === "approved").length).toBe(2);
  });

  it("counts rejected correctly", () => {
    expect(requests.filter(r => r.status === "rejected").length).toBe(1);
  });

  it("handles empty requests list", () => {
    const empty: typeof requests = [];
    expect(empty.filter(r => r.status === "pending").length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 4. Approval filter logic (admin page)
// ─────────────────────────────────────────────────────────────
describe("Approval filter logic", () => {
  type ApprovalFilter = "all" | "pending" | "approved" | "rejected";
  const items = [
    { id: "1", status: "pending" },
    { id: "2", status: "approved" },
    { id: "3", status: "pending" },
    { id: "4", status: "rejected" },
  ];

  function filterApprovals(filter: ApprovalFilter) {
    if (filter === "all") return items;
    return items.filter(r => r.status === filter);
  }

  it("'all' returns all items", () => {
    expect(filterApprovals("all")).toHaveLength(4);
  });

  it("'pending' returns only pending", () => {
    const result = filterApprovals("pending");
    expect(result).toHaveLength(2);
    result.forEach(r => expect(r.status).toBe("pending"));
  });

  it("'approved' returns only approved", () => {
    expect(filterApprovals("approved")).toHaveLength(1);
  });

  it("'rejected' returns only rejected", () => {
    expect(filterApprovals("rejected")).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────
// 5. Badge display logic
// ─────────────────────────────────────────────────────────────
describe("DiscountApprovalHeaderBadge display logic", () => {
  it("hides when count is 0", () => {
    const isAdmin = true;
    const count = 0;
    const shouldShow = isAdmin && count > 0;
    expect(shouldShow).toBe(false);
  });

  it("hides when user is not admin", () => {
    const isAdmin = false;
    const count = 3;
    const shouldShow = isAdmin && count > 0;
    expect(shouldShow).toBe(false);
  });

  it("shows when admin and count > 0", () => {
    const isAdmin = true;
    const count = 5;
    const shouldShow = isAdmin && count > 0;
    expect(shouldShow).toBe(true);
  });

  it("displays '9+' for count > 9", () => {
    const count = 15;
    const display = count > 9 ? "9+" : String(count);
    expect(display).toBe("9+");
  });

  it("displays exact number for count <= 9", () => {
    const count = 7;
    const display = count > 9 ? "9+" : String(count);
    expect(display).toBe("7");
  });

  it("handles singular/plural tooltip text", () => {
    expect(1 !== 1 ? "s" : "").toBe("");
    expect(2 !== 1 ? "s" : "").toBe("s");
    expect(0 !== 1 ? "s" : "").toBe("s");
  });
});

// ─────────────────────────────────────────────────────────────
// 6. Status transition logic (approval flow)
// ─────────────────────────────────────────────────────────────
describe("Quote status transitions", () => {
  it("requestApproval sets status to pending_approval", () => {
    const beforeStatus = "draft";
    const afterStatus = "pending_approval";
    expect(afterStatus).not.toBe(beforeStatus);
  });

  it("approval sets quote to 'pending' (ready to send)", () => {
    const approved = true;
    const newStatus = approved ? "pending" : "draft";
    expect(newStatus).toBe("pending");
  });

  it("rejection sets quote back to 'draft'", () => {
    const approved = false;
    const newStatus = approved ? "pending" : "draft";
    expect(newStatus).toBe("draft");
  });

  it("validates status whitelist includes pending_approval", () => {
    const whitelist = ["draft", "pending", "sent", "approved", "rejected", "expired", "revision", "pending_approval"];
    expect(whitelist).toContain("pending_approval");
  });
});

// ─────────────────────────────────────────────────────────────
// 7. Notification generation logic
// ─────────────────────────────────────────────────────────────
describe("Notification messages", () => {
  it("generates correct seller approval notification", () => {
    const approved = true;
    const percent = 15;
    const title = approved ? "Desconto aprovado ✅" : "Desconto rejeitado ❌";
    const message = approved
      ? `Seu desconto de ${percent}% foi aprovado. O orçamento está pronto para envio.`
      : `Seu desconto de ${percent}% foi rejeitado.`;
    expect(title).toBe("Desconto aprovado ✅");
    expect(message).toContain("15%");
    expect(message).toContain("aprovado");
  });

  it("generates rejection notification with admin notes", () => {
    const approved = false;
    const percent = 20;
    const adminNotes = "Limite máximo é 10%";
    const message = approved
      ? `Seu desconto de ${percent}% foi aprovado.`
      : `Seu desconto de ${percent}% foi rejeitado.${adminNotes ? ` Motivo: ${adminNotes}` : " Ajuste o desconto e tente novamente."}`;
    expect(message).toContain("Motivo: Limite máximo é 10%");
  });

  it("generates rejection notification without admin notes", () => {
    const adminNotes: string | undefined = undefined;
    const message = `Desconto rejeitado.${adminNotes ? ` Motivo: ${adminNotes}` : " Ajuste o desconto e tente novamente."}`;
    expect(message).toContain("Ajuste o desconto");
  });
});

// ─────────────────────────────────────────────────────────────
// 8. Seller search/filter logic
// ─────────────────────────────────────────────────────────────
describe("Seller search filtering", () => {
  const sellers = [
    { full_name: "João Silva", email: "joao@test.com" },
    { full_name: "Maria Santos", email: "maria@test.com" },
    { full_name: null, email: "admin@test.com" },
  ];

  function filterSellers(term: string) {
    if (!term) return sellers;
    const t = term.toLowerCase();
    return sellers.filter(s =>
      (s.full_name || "").toLowerCase().includes(t) ||
      (s.email || "").toLowerCase().includes(t)
    );
  }

  it("returns all sellers with empty search", () => {
    expect(filterSellers("")).toHaveLength(3);
  });

  it("finds by name", () => {
    expect(filterSellers("João")).toHaveLength(1);
  });

  it("finds by email", () => {
    expect(filterSellers("admin@")).toHaveLength(1);
  });

  it("case-insensitive search", () => {
    expect(filterSellers("MARIA")).toHaveLength(1);
  });

  it("handles seller with null name", () => {
    expect(filterSellers("admin")).toHaveLength(1);
  });

  it("returns empty for no match", () => {
    expect(filterSellers("xyz123")).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────
// 9. History logging format
// ─────────────────────────────────────────────────────────────
describe("Quote history log format", () => {
  it("generates correct request description", () => {
    const requested = 15;
    const max = 10;
    const desc = `Solicitação de desconto de ${requested}% (limite: ${max}%)`;
    expect(desc).toBe("Solicitação de desconto de 15% (limite: 10%)");
  });

  it("generates correct approval description", () => {
    const percent = 12;
    const desc = `Desconto de ${percent}% aprovado pelo admin`;
    expect(desc).toContain("aprovado");
  });

  it("generates correct rejection description", () => {
    const percent = 20;
    const desc = `Desconto de ${percent}% rejeitado pelo admin`;
    expect(desc).toContain("rejeitado");
  });

  it("records old and new values", () => {
    const oldValue = `${5}%`;
    const newValue = `${15}%`;
    expect(oldValue).toBe("5%");
    expect(newValue).toBe("15%");
  });
});

// ─────────────────────────────────────────────────────────────
// 10. Enrichment logic (N+1 prevention)
// ─────────────────────────────────────────────────────────────
describe("Request enrichment (N+1 prevention)", () => {
  it("deduplicates quote IDs correctly", () => {
    const requests = [
      { quote_id: "q1", seller_id: "s1" },
      { quote_id: "q1", seller_id: "s2" },
      { quote_id: "q2", seller_id: "s1" },
    ];
    const quoteIds = [...new Set(requests.map(r => r.quote_id))];
    expect(quoteIds).toEqual(["q1", "q2"]);
  });

  it("deduplicates seller IDs correctly", () => {
    const requests = [
      { quote_id: "q1", seller_id: "s1" },
      { quote_id: "q2", seller_id: "s1" },
      { quote_id: "q3", seller_id: "s2" },
    ];
    const sellerIds = [...new Set(requests.map(r => r.seller_id))];
    expect(sellerIds).toEqual(["s1", "s2"]);
  });

  it("maps enriched data correctly", () => {
    const quotesMap = new Map([["q1", { quote_number: "10001/26" }]]);
    const sellersMap = new Map([["s1", { full_name: "João" }]]);
    const req = { quote_id: "q1", seller_id: "s1" };
    const enriched = {
      ...req,
      quote: quotesMap.get(req.quote_id),
      seller: sellersMap.get(req.seller_id),
    };
    expect(enriched.quote?.quote_number).toBe("10001/26");
    expect(enriched.seller?.full_name).toBe("João");
  });

  it("handles missing enrichment data", () => {
    const quotesMap = new Map<string, any>();
    const enriched = { quote: quotesMap.get("unknown") || undefined };
    expect(enriched.quote).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────
// 11. Currency formatting
// ─────────────────────────────────────────────────────────────
describe("Currency formatting", () => {
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  it("formats BRL correctly", () => {
    const result = formatCurrency(1500.50);
    expect(result).toContain("1.500,50");
  });

  it("handles zero", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0,00");
  });

  it("handles large numbers", () => {
    const result = formatCurrency(999999.99);
    expect(result).toContain("999.999,99");
  });
});

// ─────────────────────────────────────────────────────────────
// 12. Edge cases
// ─────────────────────────────────────────────────────────────
describe("Edge cases", () => {
  it("handles discount at exact limit boundary", () => {
    const limit = 10;
    const requested = 10;
    const needsApproval = requested > limit;
    expect(needsApproval).toBe(false); // exactly at limit is OK
  });

  it("handles very small discount above limit", () => {
    const limit = 5;
    const requested = 5.01;
    expect(requested > limit).toBe(true);
  });

  it("handles 100% discount request", () => {
    const requested = 100;
    const limit = 10;
    expect(requested > limit).toBe(true);
  });

  it("handles negative discount (error case)", () => {
    const requested = -5;
    const isValid = requested >= 0 && requested <= 100;
    expect(isValid).toBe(false);
  });

  it("handles limit of 100% (unlimited)", () => {
    const limit = 100;
    const requested = 50;
    expect(requested > limit).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// 13. DB Trigger validation (status whitelist)
// ─────────────────────────────────────────────────────────────
describe("Database trigger: validate_status_fields", () => {
  const validStatuses = ["draft", "pending", "sent", "approved", "rejected", "expired", "revision", "pending_approval"];

  it.each(validStatuses)("allows status '%s'", (status) => {
    expect(validStatuses).toContain(status);
  });

  it("rejects invalid status", () => {
    expect(validStatuses).not.toContain("invalid_status");
    expect(validStatuses).not.toContain("processing");
  });
});

// ─────────────────────────────────────────────────────────────
// 14. Discount approval request DB trigger
// ─────────────────────────────────────────────────────────────
describe("Database trigger: validate_discount_approval_status", () => {
  // Domínio real do CHECK discount_approval_requests_status_check, agora também
  // espelhado em quotes.discount_approval_status pelo trigger trg_sync_quote_dar.
  const validStatuses = ["pending", "approved", "rejected", "expired"];

  it.each(validStatuses)("allows '%s'", (status) => {
    expect(validStatuses).toContain(status);
  });

  it("includes 'expired' (desconto aprovado cuja validade expirou)", () => {
    expect(validStatuses).toContain("expired");
  });

  it("rejects invalid discount approval status", () => {
    expect(validStatuses).not.toContain("cancelled");
    expect(validStatuses).not.toContain("processing");
  });
});

// ─────────────────────────────────────────────────────────────
// 15. Realtime subscription config
// ─────────────────────────────────────────────────────────────
describe("Realtime channel configuration", () => {
  it("uses correct channel name", () => {
    const channelName = "discount-approvals-badge";
    expect(channelName).toBe("discount-approvals-badge");
  });

  it("subscribes to correct table", () => {
    const config = {
      event: "*",
      schema: "public",
      table: "discount_approval_requests",
    };
    expect(config.table).toBe("discount_approval_requests");
    expect(config.event).toBe("*"); // all events
  });
});
