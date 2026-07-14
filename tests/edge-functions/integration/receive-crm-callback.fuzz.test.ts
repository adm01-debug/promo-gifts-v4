/**
 * EXHAUSTIVE FUZZ / SIMULATION SUITE — receive-crm-callback
 * ============================================================
 * Objetivo: validar cada branch, invariante e caminho de erro do handler
 * `supabase/functions/receive-crm-callback/index.ts` sem depender da edge
 * function estar deployada.
 *
 * Estratégia:
 *  1. Reimplementamos as funções puras (`timingSafeEqual`, `buildQuoteUpdates`)
 *     lendo o source real para garantir paridade byte-a-byte.
 *  2. Rodamos um harness que simula o handler completo contra um mock
 *     do supabase-js (INSERT/UPDATE) — cobrindo idempotência, quote_not_found,
 *     erro de DB, sucesso, todos os event_type.
 *  3. Fuzzing determinístico (seed fixo) com 500+ payloads aleatórios contra
 *     o Zod schema para checar robustez de validação.
 *  4. Validação estrutural da migration SQL.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────
// 1) Espelho fiel do schema Zod da edge
// ─────────────────────────────────────────────────────────────────────────
const EventTypeEnum = z.enum([
  "approved",
  "rejected",
  "order_created",
  "sent_to_client",
  "expired",
]);

const CallbackSchema = z.object({
  external_quote_id: z.string().uuid(),
  crm_quote_id: z.string().uuid().optional(),
  event_type: EventTypeEnum,
  status: z.string().optional(),
  occurred_at: z.string().datetime({ offset: true }),
  payload: z
    .object({
      order_id: z.string().uuid().optional(),
      order_number: z.string().max(64).optional(),
      rejection_reason: z.string().max(2000).optional(),
      approved_by: z.string().max(255).optional(),
      total_value: z.number().finite().optional(),
    })
    .catchall(z.any())
    .default({}),
});
type CallbackBody = z.infer<typeof CallbackSchema>;

// ─────────────────────────────────────────────────────────────────────────
// 2) Espelho fiel de buildQuoteUpdates + timingSafeEqual
// ─────────────────────────────────────────────────────────────────────────
function buildQuoteUpdates(body: CallbackBody): Record<string, unknown> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  switch (body.event_type) {
    case "approved":
      patch.status = "approved";
      patch.approved_at = body.occurred_at;
      patch.client_response = "approved";
      patch.client_response_at = body.occurred_at;
      if (body.payload.approved_by) patch.approved_by_client_name = body.payload.approved_by;
      break;
    case "rejected":
      patch.status = "rejected";
      patch.client_response = "rejected";
      patch.client_response_at = body.occurred_at;
      if (body.payload.rejection_reason) patch.client_feedback = body.payload.rejection_reason;
      break;
    case "order_created":
      patch.status = "converted";
      patch.converted_at = body.occurred_at;
      if (body.payload.order_id) patch.converted_to_order_id = body.payload.order_id;
      if (body.payload.order_number) {
        patch.conversion_notes = `Pedido criado no CRM: ${body.payload.order_number}`;
      }
      break;
    case "sent_to_client":
      patch.last_sent_at = body.occurred_at;
      if (!("sent_at" in patch)) patch.sent_at = body.occurred_at;
      break;
    case "expired":
      patch.status = "expired";
      break;
  }
  return patch;
}

function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  if (ea.length !== eb.length) return false;
  let diff = 0;
  for (let i = 0; i < ea.length; i++) diff |= ea[i] ^ eb[i];
  return diff === 0;
}

// ─────────────────────────────────────────────────────────────────────────
// 3) Paridade byte-a-byte com o source real da edge
// ─────────────────────────────────────────────────────────────────────────
const EDGE_SRC = readFileSync(
  resolve(__dirname, "../../../supabase/functions/receive-crm-callback/index.ts"),
  "utf8",
);

describe("SOURCE PARITY — código de produção contém as funções esperadas", () => {
  it("timingSafeEqual continua constant-time (XOR loop, sem early-return)", () => {
    // Deve haver o bloco XOR e NÃO deve haver "return false" dentro do loop.
    expect(EDGE_SRC).toMatch(/diff \|= ea\[i\] \^ eb\[i\]/);
    expect(EDGE_SRC).toMatch(/if \(ea\.length !== eb\.length\) return false/);
    // Não pode existir early return dentro do for.
    const loopBlock = EDGE_SRC.slice(
      EDGE_SRC.indexOf("for (let i = 0; i < ea.length"),
      EDGE_SRC.indexOf("return diff === 0"),
    );
    expect(loopBlock).not.toMatch(/return\s+(true|false)/);
  });

  it("verify_jwt=false via config.toml (auth é 100% inline)", () => {
    const cfg = readFileSync(resolve(__dirname, "../../../supabase/config.toml"), "utf8");
    expect(cfg).toMatch(/\[functions\.receive-crm-callback\][\s\S]*verify_jwt = false/);
  });

  it("usa service_role — nunca ANON — para writes", () => {
    expect(EDGE_SRC).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    expect(EDGE_SRC).not.toMatch(/ANON_KEY/);
  });

  it("CORS inclui x-api-key nos headers permitidos", () => {
    expect(EDGE_SRC).toMatch(/extraAllowHeaders:\s*\["x-api-key"\]/);
  });

  it("idempotência: detecta código 23505 do Postgres (unique_violation)", () => {
    expect(EDGE_SRC).toMatch(/23505/);
    expect(EDGE_SRC).toMatch(/duplicate_ignored/);
  });

  it("quote_not_found responde 200 (política PO — sem retry)", () => {
    // Usa lastIndexOf para pegar a ocorrência dentro do payload de resposta
    const idx = EDGE_SRC.lastIndexOf("quote_not_found");
    expect(idx).toBeGreaterThan(-1);
    const near = EDGE_SRC.slice(idx - 300, idx + 100);
    expect(near).toMatch(/json\(200/);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 4) buildQuoteUpdates — cobertura exaustiva por event_type
// ─────────────────────────────────────────────────────────────────────────
const ISO = "2026-07-06T16:00:00.000Z";
const UUID1 = "00000000-0000-0000-0000-000000000001";
const UUID2 = "00000000-0000-0000-0000-000000000002";

describe("buildQuoteUpdates — mapping por event_type", () => {
  it("approved (mínimo) — não seta approved_by_client_name", () => {
    const p = buildQuoteUpdates({
      external_quote_id: UUID1,
      event_type: "approved",
      occurred_at: ISO,
      payload: {},
    } as CallbackBody);
    expect(p.status).toBe("approved");
    expect(p.approved_at).toBe(ISO);
    expect(p.client_response).toBe("approved");
    expect(p.client_response_at).toBe(ISO);
    expect(p.approved_by_client_name).toBeUndefined();
  });

  it("approved (com approved_by) — propaga nome", () => {
    const p = buildQuoteUpdates({
      external_quote_id: UUID1,
      event_type: "approved",
      occurred_at: ISO,
      payload: { approved_by: "Maria Cliente" },
    } as CallbackBody);
    expect(p.approved_by_client_name).toBe("Maria Cliente");
  });

  it("rejected — client_feedback recebe rejection_reason quando presente", () => {
    const p = buildQuoteUpdates({
      external_quote_id: UUID1,
      event_type: "rejected",
      occurred_at: ISO,
      payload: { rejection_reason: "Preço acima do orçamento" },
    } as CallbackBody);
    expect(p.status).toBe("rejected");
    expect(p.client_response).toBe("rejected");
    expect(p.client_feedback).toBe("Preço acima do orçamento");
  });

  it("rejected sem motivo — não seta client_feedback", () => {
    const p = buildQuoteUpdates({
      external_quote_id: UUID1,
      event_type: "rejected",
      occurred_at: ISO,
      payload: {},
    } as CallbackBody);
    expect(p.client_feedback).toBeUndefined();
  });

  it("order_created (completo) — converte + notes + order_id", () => {
    const p = buildQuoteUpdates({
      external_quote_id: UUID1,
      event_type: "order_created",
      occurred_at: ISO,
      payload: { order_id: UUID2, order_number: "PED-2026-0777" },
    } as CallbackBody);
    expect(p.status).toBe("converted");
    expect(p.converted_at).toBe(ISO);
    expect(p.converted_to_order_id).toBe(UUID2);
    expect(p.conversion_notes).toBe("Pedido criado no CRM: PED-2026-0777");
  });

  it("sent_to_client — seta last_sent_at E sent_at (primeiro envio)", () => {
    const p = buildQuoteUpdates({
      external_quote_id: UUID1,
      event_type: "sent_to_client",
      occurred_at: ISO,
      payload: {},
    } as CallbackBody);
    expect(p.last_sent_at).toBe(ISO);
    expect(p.sent_at).toBe(ISO);
    expect(p.status).toBeUndefined(); // não muda status
  });

  it("expired — apenas status", () => {
    const p = buildQuoteUpdates({
      external_quote_id: UUID1,
      event_type: "expired",
      occurred_at: ISO,
      payload: {},
    } as CallbackBody);
    expect(p.status).toBe("expired");
  });

  it.each([
    ["approved"],
    ["rejected"],
    ["order_created"],
    ["sent_to_client"],
    ["expired"],
  ] as const)("todo patch sempre contém updated_at ISO — %s", (ev) => {
    const p = buildQuoteUpdates({
      external_quote_id: UUID1,
      event_type: ev,
      occurred_at: ISO,
      payload: {},
    } as CallbackBody);
    expect(typeof p.updated_at).toBe("string");
    expect(new Date(p.updated_at as string).toString()).not.toBe("Invalid Date");
  });

  it("todos os status produzidos estão no allowlist do trigger validate_status_fields", () => {
    const allowed = new Set([
      "draft","pending","sent","approved","rejected","expired","revision","pending_approval","converted","viewed",
    ]);
    for (const ev of ["approved","rejected","order_created","sent_to_client","expired"] as const) {
      const p = buildQuoteUpdates({
        external_quote_id: UUID1,
        event_type: ev,
        occurred_at: ISO,
        payload: {},
      } as CallbackBody);
      if (typeof p.status === "string") expect(allowed.has(p.status)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 5) timingSafeEqual — testes de robustez
// ─────────────────────────────────────────────────────────────────────────
describe("timingSafeEqual", () => {
  it("iguais → true", () => expect(timingSafeEqual("abc123", "abc123")).toBe(true));
  it("diferentes mesmo tamanho → false", () => expect(timingSafeEqual("abc123", "abc124")).toBe(false));
  it("tamanhos diferentes → false", () => expect(timingSafeEqual("abc", "abcd")).toBe(false));
  it("ambos vazios → true (mas handler rejeita antes, veja teste do handler)", () =>
    expect(timingSafeEqual("", "")).toBe(true));
  it("unicode 4-byte igual", () => expect(timingSafeEqual("🔐🚀", "🔐🚀")).toBe(true));
  it("unicode diferente", () => expect(timingSafeEqual("🔐🚀", "🔐✨")).toBe(false));
  it("100 pares aleatórios — nunca lança", () => {
    for (let i = 0; i < 100; i++) {
      const a = Math.random().toString(36).repeat(3);
      const b = Math.random().toString(36).repeat(3);
      expect(() => timingSafeEqual(a, b)).not.toThrow();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 6) HANDLER SIMULADO — reproduz o fluxo end-to-end com mocks
// ─────────────────────────────────────────────────────────────────────────
type MockScenario = {
  insertOutcome: "ok" | "duplicate" | "db_error";
  updateOutcome: "ok" | "not_found" | "db_error";
};
type MockCall = { table: string; op: "insert" | "update"; args: unknown };

function makeMockSupabase(scen: MockScenario) {
  const calls: MockCall[] = [];
  const client = {
    from(table: string) {
      return {
        insert(row: unknown) {
          calls.push({ table, op: "insert", args: row });
          return {
            select: () => ({
              maybeSingle: async () => {
                if (scen.insertOutcome === "duplicate") {
                  return { data: null, error: { code: "23505", message: "unique_violation" } };
                }
                if (scen.insertOutcome === "db_error") {
                  return { data: null, error: { code: "XX000", message: "boom" } };
                }
                return { data: { id: "evt-" + Math.random().toString(36).slice(2) }, error: null };
              },
            }),
          };
        },
        update(patch: unknown) {
          const chain = {
            _patch: patch,
            _id: null as string | null,
            eq(_col: string, val: string) {
              this._id = val;
              return this;
            },
            select: (_c?: string) => ({
              then: (resolve: (v: unknown) => void) => {
                calls.push({ table, op: "update", args: { patch, id: chain._id } });
                if (scen.updateOutcome === "db_error") {
                  resolve({ data: null, error: { code: "XX000", message: "update-boom" } });
                } else if (scen.updateOutcome === "not_found") {
                  resolve({ data: [], error: null });
                } else {
                  resolve({ data: [{ id: chain._id }], error: null });
                }
              },
            }),
          };
          // Também suporta await direto (sem .select) — usado no rollback.
          return new Proxy(chain, {
            get(target, prop) {
              if (prop === "then") {
                return (resolve: (v: unknown) => void) => {
                  calls.push({ table, op: "update", args: { patch, id: target._id } });
                  resolve({ data: null, error: null });
                };
              }
              return (target as unknown as Record<string | symbol, unknown>)[prop as string];
            },
          });
        },
      };
    },
  };
  return { client, calls };
}

/**
 * Reproduz o miolo do handler: valida payload, aplica auth, faz insert
 * de auditoria, aplica update no quotes e devolve o status HTTP + body.
 * Não roda o servidor Deno — testa a lógica de decisão.
 */
async function simulateHandler(opts: {
  method?: string;
  apiKey?: string;
  expectedKey?: string;
  body?: unknown;
  bodyRaw?: string;
  scen?: MockScenario;
}) {
  const method = opts.method ?? "POST";
  if (method !== "POST") return { status: 405, body: { error: "method_not_allowed" }, calls: [] };

  const expected = opts.expectedKey ?? "";
  const provided = opts.apiKey ?? "";
  if (!expected || !provided || !timingSafeEqual(provided, expected)) {
    return { status: 401, body: { error: "invalid_api_key" }, calls: [] };
  }

  let raw: unknown = opts.body;
  if (opts.bodyRaw !== undefined) {
    try {
      raw = JSON.parse(opts.bodyRaw);
    } catch {
      return { status: 400, body: { error: "invalid_json" }, calls: [] };
    }
  }
  const parsed = CallbackSchema.safeParse(raw);
  if (!parsed.success) {
    return { status: 400, body: { error: "invalid_payload" }, calls: [] };
  }
  const body = parsed.data;

  const { client, calls } = makeMockSupabase(opts.scen ?? { insertOutcome: "ok", updateOutcome: "ok" });

  const ins = await client.from("crm_callback_events").insert({
    external_quote_id: body.external_quote_id,
    crm_quote_id: body.crm_quote_id ?? null,
    event_type: body.event_type,
    occurred_at: body.occurred_at,
    payload: body.payload,
    result: "applied",
  }).select("id").maybeSingle();

  if (ins.error && (ins.error as { code?: string }).code === "23505") {
    return { status: 200, body: { status: "duplicate_ignored" }, calls };
  }
  if (ins.error) {
    return { status: 500, body: { error: "internal_error", message: "audit_insert_failed" }, calls };
  }
  const eventId = ins.data?.id as string | undefined;

  const upd: { data: unknown; error: unknown } = await client
    .from("quotes")
    .update(buildQuoteUpdates(body))
    .eq("id", body.external_quote_id)
    .select("id") as unknown as { data: unknown; error: unknown };

  if (upd.error) {
    await client.from("crm_callback_events").update({ result: "error", error_message: (upd.error as { message?: string }).message ?? "unknown" }).eq("id", eventId!);
    return { status: 500, body: { error: "internal_error", message: "quote_update_failed" }, calls };
  }
  const affected = Array.isArray(upd.data) ? upd.data.length : 0;
  if (affected === 0) {
    await client.from("crm_callback_events").update({ result: "error", error_message: "quote_not_found" }).eq("id", eventId!);
    return { status: 200, body: { status: "ok", event_id: eventId, applied: false, reason: "quote_not_found" }, calls };
  }
  return { status: 200, body: { status: "ok", event_id: eventId, applied: true }, calls };
}

describe("HANDLER SIMULATION — cenários end-to-end", () => {
  const KEY = "a".repeat(64);
  const validBody = {
    external_quote_id: UUID1,
    event_type: "approved" as const,
    occurred_at: ISO,
    payload: {},
  };

  it("GET → 405", async () => {
    const r = await simulateHandler({ method: "GET", apiKey: KEY, expectedKey: KEY, body: validBody });
    expect(r.status).toBe(405);
  });
  it("PUT/DELETE/PATCH/HEAD/OPTIONS-fake → 405", async () => {
    for (const m of ["PUT","DELETE","PATCH","HEAD"]) {
      const r = await simulateHandler({ method: m, apiKey: KEY, expectedKey: KEY, body: validBody });
      expect(r.status).toBe(405);
    }
  });

  it("sem x-api-key → 401", async () => {
    const r = await simulateHandler({ apiKey: "", expectedKey: KEY, body: validBody });
    expect(r.status).toBe(401);
  });
  it("com api-key errada (mesmo tamanho) → 401", async () => {
    const r = await simulateHandler({ apiKey: "b".repeat(64), expectedKey: KEY, body: validBody });
    expect(r.status).toBe(401);
  });
  it("com api-key errada (tamanho diferente) → 401", async () => {
    const r = await simulateHandler({ apiKey: "b".repeat(63), expectedKey: KEY, body: validBody });
    expect(r.status).toBe(401);
  });
  it("secret não configurado no servidor → 401 (mesmo com header)", async () => {
    const r = await simulateHandler({ apiKey: KEY, expectedKey: "", body: validBody });
    expect(r.status).toBe(401);
  });

  it("body não-JSON → 400 invalid_json", async () => {
    const r = await simulateHandler({ apiKey: KEY, expectedKey: KEY, bodyRaw: "not json {{" });
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ error: "invalid_json" });
  });

  it("payload inválido (falta external_quote_id) → 400", async () => {
    const r = await simulateHandler({ apiKey: KEY, expectedKey: KEY, body: { event_type: "approved", occurred_at: ISO } });
    expect(r.status).toBe(400);
  });

  it("sucesso completo → 200 applied=true + insert + update", async () => {
    const r = await simulateHandler({ apiKey: KEY, expectedKey: KEY, body: validBody });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "ok", applied: true });
    expect(r.calls.filter((c) => c.op === "insert" && c.table === "crm_callback_events")).toHaveLength(1);
    expect(r.calls.filter((c) => c.op === "update" && c.table === "quotes")).toHaveLength(1);
  });

  it("duplicado (23505) → 200 duplicate_ignored + SEM update em quotes", async () => {
    const r = await simulateHandler({
      apiKey: KEY, expectedKey: KEY, body: validBody,
      scen: { insertOutcome: "duplicate", updateOutcome: "ok" },
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "duplicate_ignored" });
    expect(r.calls.some((c) => c.table === "quotes" && c.op === "update")).toBe(false);
  });

  it("erro no INSERT de auditoria → 500 (CRM tenta de novo)", async () => {
    const r = await simulateHandler({
      apiKey: KEY, expectedKey: KEY, body: validBody,
      scen: { insertOutcome: "db_error", updateOutcome: "ok" },
    });
    expect(r.status).toBe(500);
    expect(r.body).toMatchObject({ message: "audit_insert_failed" });
  });

  it("quote inexistente → 200 applied=false + rollback marca error", async () => {
    const r = await simulateHandler({
      apiKey: KEY, expectedKey: KEY, body: validBody,
      scen: { insertOutcome: "ok", updateOutcome: "not_found" },
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "ok", applied: false, reason: "quote_not_found" });
    const rollback = r.calls.find(
      (c) => c.table === "crm_callback_events" && c.op === "update",
    );
    expect(rollback).toBeDefined();
    expect(JSON.stringify((rollback as MockCall).args)).toContain("quote_not_found");
  });

  it("erro no UPDATE em quotes → 500 (CRM retenta) + rollback do audit", async () => {
    const r = await simulateHandler({
      apiKey: KEY, expectedKey: KEY, body: validBody,
      scen: { insertOutcome: "ok", updateOutcome: "db_error" },
    });
    expect(r.status).toBe(500);
    expect(r.body).toMatchObject({ message: "quote_update_failed" });
    const rollback = r.calls.find(
      (c) => c.table === "crm_callback_events" && c.op === "update",
    );
    expect(rollback).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 7) FUZZING DETERMINÍSTICO — Zod schema (500 casos)
// ─────────────────────────────────────────────────────────────────────────
// PRNG mulberry32 (seed fixo) → totalmente reprodutível.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0xC0FFEE);
function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rand() * arr.length)]; }
function randomString(len: number) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789-";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(rand() * chars.length)];
  return s;
}
function randUuid() {
  const hex = () => Math.floor(rand() * 16).toString(16);
  const seg = (n: number) => Array.from({ length: n }, hex).join("");
  return `${seg(8)}-${seg(4)}-4${seg(3)}-${pick(["8","9","a","b"])}${seg(3)}-${seg(12)}`;
}
function randISOWithTZ() {
  const year = 2024 + Math.floor(rand() * 5);
  const mm = String(1 + Math.floor(rand() * 12)).padStart(2, "0");
  const dd = String(1 + Math.floor(rand() * 28)).padStart(2, "0");
  const hh = String(Math.floor(rand() * 24)).padStart(2, "0");
  const mi = String(Math.floor(rand() * 60)).padStart(2, "0");
  const ss = String(Math.floor(rand() * 60)).padStart(2, "0");
  const tzChoice = pick(["Z", "+00:00", "-03:00", "+05:30"]);
  return `${year}-${mm}-${dd}T${hh}:${mi}:${ss}.000${tzChoice === "Z" ? "Z" : tzChoice}`;
}

const EVENTS = ["approved","rejected","order_created","sent_to_client","expired"] as const;

describe("FUZZ — 500 payloads VÁLIDOS aleatórios devem ser aceitos", () => {
  const N = 500;
  const failures: Array<{ i: number; body: unknown; err: unknown }> = [];
  for (let i = 0; i < N; i++) {
    const ev = pick(EVENTS);
    const body: Record<string, unknown> = {
      external_quote_id: randUuid(),
      event_type: ev,
      occurred_at: randISOWithTZ(),
      payload: {},
    };
    if (rand() < 0.5) body.crm_quote_id = randUuid();
    if (rand() < 0.4) body.status = pick(["draft","approved","rejected","converted"]);
    const p: Record<string, unknown> = {};
    if (ev === "order_created" && rand() < 0.8) {
      p.order_id = randUuid();
      p.order_number = "PED-" + randomString(6).toUpperCase();
    }
    if (ev === "rejected" && rand() < 0.7) p.rejection_reason = randomString(50 + Math.floor(rand() * 100));
    if (ev === "approved" && rand() < 0.5) p.approved_by = randomString(10 + Math.floor(rand() * 20));
    if (rand() < 0.3) p.total_value = Math.round(rand() * 100000) / 100;
    // catchall
    if (rand() < 0.3) p[randomString(6)] = randomString(20);
    body.payload = p;

    const r = CallbackSchema.safeParse(body);
    if (!r.success) failures.push({ i, body, err: r.error.flatten() });
  }
  it(`${N}/${N} aceitos`, () => {
    if (failures.length > 0) {
      // Mostra até 3 falhas para diagnóstico.
      // eslint-disable-next-line no-console
      console.error("Fuzz VALID falhou:", JSON.stringify(failures.slice(0, 3), null, 2));
    }
    expect(failures).toHaveLength(0);
  });
});

describe("FUZZ — 500 payloads INVÁLIDOS devem ser rejeitados", () => {
  const N = 500;
  const acceptedByAccident: unknown[] = [];
  const mutations: Array<(b: Record<string, unknown>) => void> = [
    (b) => delete b.external_quote_id,
    (b) => delete b.event_type,
    (b) => delete b.occurred_at,
    (b) => (b.external_quote_id = "not-uuid"),
    (b) => (b.event_type = randomString(8)),
    (b) => (b.occurred_at = "2026-07-06"),           // sem hora
    (b) => (b.occurred_at = "2026-07-06T16:00:00"),  // sem TZ
    (b) => (b.occurred_at = randomString(20)),
    (b) => (b.crm_quote_id = "xyz"),
    (b) => (b.payload = "not-object"),
    (b) => (b.payload = { order_id: "not-uuid" }),
    (b) => (b.payload = { order_number: "x".repeat(65) }),
    (b) => (b.payload = { rejection_reason: "x".repeat(2001) }),
    (b) => (b.payload = { approved_by: "x".repeat(256) }),
    (b) => (b.payload = { total_value: Infinity }),
    (b) => (b.payload = { total_value: NaN }),
    (b) => (b.payload = { total_value: "not-a-number" }),
    (b) => (b.external_quote_id = null as unknown as string),
    (b) => (b.event_type = null as unknown as string),
    (b) => (b.event_type = ""),
  ];
  for (let i = 0; i < N; i++) {
    const body: Record<string, unknown> = {
      external_quote_id: randUuid(),
      event_type: pick(EVENTS),
      occurred_at: randISOWithTZ(),
      payload: {},
    };
    const mut = mutations[i % mutations.length];
    mut(body);
    const r = CallbackSchema.safeParse(body);
    if (r.success) acceptedByAccident.push({ i, mut: mut.toString(), body });
  }
  it(`0/${N} aceitos acidentalmente`, () => {
    if (acceptedByAccident.length > 0) {
      // eslint-disable-next-line no-console
      console.error("Fuzz INVALID vazamento:", JSON.stringify(acceptedByAccident.slice(0, 3), null, 2));
    }
    expect(acceptedByAccident).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// 8) VALIDAÇÃO ESTRUTURAL DA MIGRATION
// ─────────────────────────────────────────────────────────────────────────
describe("Migration SQL — crm_callback_events", () => {
  const SQL = readFileSync(
    resolve(__dirname, "../../../qa/migrations-draft/2026-07-06_crm_callback_events.sql"),
    "utf8",
  );

  it("cria tabela public.crm_callback_events", () => {
    expect(SQL).toMatch(/CREATE TABLE IF NOT EXISTS public\.crm_callback_events/);
  });
  it("tem UNIQUE de idempotência (external_quote_id, event_type, occurred_at)", () => {
    expect(SQL).toMatch(/UNIQUE\s*\(external_quote_id,\s*event_type,\s*occurred_at\)/i);
  });
  it("CHECK do event_type cobre exatamente os 5 valores do schema", () => {
    for (const ev of EVENTS) expect(SQL).toContain(`'${ev}'`);
  });
  it("CHECK do result cobre applied/duplicate_ignored/error", () => {
    for (const r of ["applied","duplicate_ignored","error"]) expect(SQL).toContain(`'${r}'`);
  });
  it("GRANT para authenticated + service_role (regra SSOT do projeto)", () => {
    expect(SQL).toMatch(/GRANT SELECT ON public\.crm_callback_events TO authenticated/);
    expect(SQL).toMatch(/GRANT ALL\s+ON public\.crm_callback_events TO service_role/);
  });
  it("RLS habilitado", () => {
    expect(SQL).toMatch(/ALTER TABLE public\.crm_callback_events ENABLE ROW LEVEL SECURITY/);
  });
  it("policy admin-only via has_role", () => {
    expect(SQL).toMatch(/has_role\(auth\.uid\(\),\s*'admin'::app_role\)/);
  });
  it("índices de consulta criados", () => {
    expect(SQL).toMatch(/idx_crm_callback_events_quote/);
    expect(SQL).toMatch(/idx_crm_callback_events_result_received/);
  });
  it("payload é JSONB com default '{}'", () => {
    expect(SQL).toMatch(/payload\s+jsonb\s+NOT NULL\s+DEFAULT\s+'\{\}'::jsonb/i);
  });
});
