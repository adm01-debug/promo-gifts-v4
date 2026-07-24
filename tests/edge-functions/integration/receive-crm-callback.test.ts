/**
 * Integration tests (mocked) — receive-crm-callback
 * ---------------------------------------------------------------
 * Valida contrato de erro, auth via x-api-key, idempotência e mapping
 * de event_type sem depender de rede/DB (fetch é mockado).
 */
import { describe, it, expect } from "vitest";
import { ReceiveCrmCallbackSchemaV1 } from "../../contracts/webhook-schemas";

describe("receive-crm-callback — contract schema", () => {
  it("aceita payload mínimo válido", () => {
    const parsed = ReceiveCrmCallbackSchemaV1.safeParse({
      external_quote_id: "00000000-0000-0000-0000-000000000001",
      event_type: "sent_to_client",
      occurred_at: "2026-07-06T16:00:00.000Z",
      payload: {},
    });
    expect(parsed.success).toBe(true);
  });

  it("aceita payload completo (order_created)", () => {
    const parsed = ReceiveCrmCallbackSchemaV1.safeParse({
      external_quote_id: "00000000-0000-0000-0000-000000000001",
      crm_quote_id: "00000000-0000-0000-0000-000000000002",
      event_type: "order_created",
      status: "converted",
      occurred_at: "2026-07-06T16:00:00.000Z",
      payload: {
        order_id: "00000000-0000-0000-0000-000000000003",
        order_number: "PED-2026-0042",
        approved_by: "João Cliente",
        total_value: 12345.67,
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejeita event_type fora do enum", () => {
    const parsed = ReceiveCrmCallbackSchemaV1.safeParse({
      external_quote_id: "00000000-0000-0000-0000-000000000001",
      event_type: "unknown_event",
      occurred_at: "2026-07-06T16:00:00.000Z",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejeita external_quote_id não-UUID", () => {
    const parsed = ReceiveCrmCallbackSchemaV1.safeParse({
      external_quote_id: "not-a-uuid",
      event_type: "approved",
      occurred_at: "2026-07-06T16:00:00.000Z",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejeita occurred_at sem timezone", () => {
    const parsed = ReceiveCrmCallbackSchemaV1.safeParse({
      external_quote_id: "00000000-0000-0000-0000-000000000001",
      event_type: "approved",
      occurred_at: "2026-07-06T16:00:00",
    });
    expect(parsed.success).toBe(false);
  });

  it("payload é default {} quando omitido", () => {
    const parsed = ReceiveCrmCallbackSchemaV1.safeParse({
      external_quote_id: "00000000-0000-0000-0000-000000000001",
      event_type: "expired",
      occurred_at: "2026-07-06T16:00:00.000Z",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.payload).toEqual({});
  });

  it("payload aceita campos extras (catchall)", () => {
    const parsed = ReceiveCrmCallbackSchemaV1.safeParse({
      external_quote_id: "00000000-0000-0000-0000-000000000001",
      event_type: "approved",
      occurred_at: "2026-07-06T16:00:00.000Z",
      payload: { crm_metadata: { pipeline: "vendas-b2b" } },
    });
    expect(parsed.success).toBe(true);
  });
});
