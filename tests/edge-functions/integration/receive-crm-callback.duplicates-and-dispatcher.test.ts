/**
 * DUPLICATES + DISPATCHER-BACKOFF — heavy simulation
 * ==========================================================
 * Cobre:
 *   (A) Duplicidade: 500 tentativas variadas de POST duplicado ao
 *       endpoint `receive-crm-callback` → asserta `duplicate_ignored`
 *       SEM efeitos colaterais (nenhum UPDATE em quotes, nenhum
 *       rollback no audit).
 *   (B) Dispatcher contract (lado CRM): modela o retry loop que o
 *       CRM Promo Champions DEVE implementar contra o V4, validando
 *       401 → dead-letter imediato (não retenta), 429 → backoff com
 *       Retry-After, 500 → exponential-backoff até `exhausted`.
 *
 * Nota: o dispatcher real vive no repo do CRM; este arquivo é o
 * contrato executável. Se um dia trouxermos o dispatcher para cá,
 * ele DEVE passar nestes testes sem alteração.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Espelho mínimo do schema + handler já validado por parity tests.
// ─────────────────────────────────────────────────────────────
const CallbackSchema = z.object({
  external_quote_id: z.string().uuid(),
  crm_quote_id: z.string().uuid().optional(),
  event_type: z.enum(["approved","rejected","order_created","sent_to_client","expired"]),
  status: z.string().optional(),
  occurred_at: z.string().datetime({ offset: true }),
  payload: z.object({
    order_id: z.string().uuid().optional(),
    order_number: z.string().max(64).optional(),
    rejection_reason: z.string().max(2000).optional(),
    approved_by: z.string().max(255).optional(),
    total_value: z.number().finite().optional(),
  }).catchall(z.any()).default({}),
});
type CallbackBody = z.infer<typeof CallbackSchema>;

// In-memory DB que replica a UNIQUE (external_quote_id, event_type, occurred_at).
class FakeDB {
  audit: Array<Record<string, unknown>> = [];
  quotes = new Map<string, { status: string; updates: number }>();
  updateCalls = 0;
  auditUpdateCalls = 0;

  seedQuote(id: string) { this.quotes.set(id, { status: "pending", updates: 0 }); }

  insertAudit(row: {
    external_quote_id: string; event_type: string; occurred_at: string;
    payload: unknown; crm_quote_id?: string | null;
  }) {
    const dup = this.audit.find((r) =>
      r.external_quote_id === row.external_quote_id &&
      r.event_type === row.event_type &&
      r.occurred_at === row.occurred_at,
    );
    if (dup) return { data: null, error: { code: "23505", message: "unique_violation" } };
    const id = "evt-" + (this.audit.length + 1);
    const stored = { id, result: "applied", ...row };
    this.audit.push(stored);
    return { data: { id }, error: null };
  }
  updateAudit(id: string, patch: Record<string, unknown>) {
    this.auditUpdateCalls++;
    const row = this.audit.find((r) => r.id === id);
    if (row) Object.assign(row, patch);
    return { error: null };
  }
  updateQuote(id: string, _patch: Record<string, unknown>) {
    this.updateCalls++;
    const q = this.quotes.get(id);
    if (!q) return { data: [], error: null };
    q.status = String(_patch.status ?? q.status);
    q.updates++;
    return { data: [{ id }], error: null };
  }
}

async function invokeHandler(db: FakeDB, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
  const parsed = CallbackSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { error: "invalid_payload" } };
  const b: CallbackBody = parsed.data;
  const ins = db.insertAudit({
    external_quote_id: b.external_quote_id,
    event_type: b.event_type,
    occurred_at: b.occurred_at,
    payload: b.payload,
    crm_quote_id: b.crm_quote_id ?? null,
  });
  if (ins.error && ins.error.code === "23505") {
    return { status: 200, body: { status: "duplicate_ignored" } };
  }
  const upd = db.updateQuote(b.external_quote_id, { status: b.event_type });
  const affected = upd.data?.length ?? 0;
  if (affected === 0) {
    db.updateAudit(ins.data!.id, { result: "error", error_message: "quote_not_found" });
    return { status: 200, body: { status: "ok", applied: false, reason: "quote_not_found" } };
  }
  return { status: 200, body: { status: "ok", event_id: ins.data!.id, applied: true } };
}

// ─────────────────────────────────────────────────────────────
// (A) DUPLICATES — 500 cenários de replay
// ─────────────────────────────────────────────────────────────
describe("A) Duplicates — replay não pode gerar efeito colateral", () => {
  const UUIDs = Array.from({ length: 25 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`);
  const EVENTS = ["approved","rejected","order_created","sent_to_client","expired"] as const;
  const ISOs = [
    "2026-07-06T10:00:00.000Z",
    "2026-07-06T10:00:00.000-03:00",
    "2026-07-06T13:00:00.000Z",
    "2026-07-07T09:15:30.500Z",
    "2026-07-08T00:00:00.000+00:00",
  ];

  it("500 duplicatas retornam 200/duplicate_ignored, ZERO update em quotes, ZERO rollback em audit", async () => {
    const db = new FakeDB();
    for (const u of UUIDs) db.seedQuote(u);

    // Fase 1: preencher com 125 eventos "originais" (25 quotes × 5 events).
    let originals = 0;
    for (const u of UUIDs) {
      for (const ev of EVENTS) {
        const iso = ISOs[0];
        const r = await invokeHandler(db, { external_quote_id: u, event_type: ev, occurred_at: iso, payload: {} });
        expect(r.status).toBe(200);
        expect(r.body).toMatchObject({ status: "ok", applied: true });
        originals++;
      }
    }
    expect(db.audit).toHaveLength(originals);
    const updatesAfterOriginals = db.updateCalls;
    const auditUpdatesAfterOriginals = db.auditUpdateCalls;

    // Fase 2: replay 500× dos MESMOS eventos, embaralhando ordem e adicionando
    // "ruído" no payload (que a idempotência ignora, pois só olha PK lógica).
    let duplicates = 0;
    for (let i = 0; i < 500; i++) {
      const u = UUIDs[i % UUIDs.length];
      const ev = EVENTS[i % EVENTS.length];
      const iso = ISOs[0]; // mesmo occurred_at → deve casar
      const payload: Record<string, unknown> = { replay_attempt: i };
      if (ev === "order_created") payload.order_id = "00000000-0000-0000-0000-000000000ABC".slice(0, 36);
      const r = await invokeHandler(db, { external_quote_id: u, event_type: ev, occurred_at: iso, payload });
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ status: "duplicate_ignored" });
      duplicates++;
    }

    expect(duplicates).toBe(500);
    // Invariantes-chave:
    expect(db.audit).toHaveLength(originals);                    // NÃO cresce
    expect(db.updateCalls).toBe(updatesAfterOriginals);           // ZERO UPDATE novo em quotes
    expect(db.auditUpdateCalls).toBe(auditUpdatesAfterOriginals); // ZERO rollback

    // Todas as quotes preservam a última status legítima.
    for (const q of db.quotes.values()) {
      expect(q.updates).toBe(EVENTS.length); // 5 updates originais, nada a mais
    }
  });

  it("mesma quote+event com occurred_at DIFERENTE NÃO é duplicata (é revisão)", async () => {
    const db = new FakeDB();
    db.seedQuote(UUIDs[0]);
    const r1 = await invokeHandler(db, { external_quote_id: UUIDs[0], event_type: "approved", occurred_at: ISOs[0], payload: {} });
    const r2 = await invokeHandler(db, { external_quote_id: UUIDs[0], event_type: "approved", occurred_at: ISOs[2], payload: {} });
    expect(r1.body).toMatchObject({ applied: true });
    expect(r2.body).toMatchObject({ applied: true });
    expect(db.audit).toHaveLength(2);
    expect(db.updateCalls).toBe(2);
  });

  it("ISO em fuso diferente com MESMO instante é aceito como distinto (documenta comportamento)", async () => {
    // 10:00Z != 10:00-03:00 em string — a UNIQUE compara timestamptz normalizado,
    // então NO BANCO REAL seria detectado como duplicata. Aqui o FakeDB compara
    // strings, então esperamos 2 rows. Isso NÃO é bug do handler — a proteção
    // final é o PostgreSQL com timestamptz. Documentamos para consciência.
    const db = new FakeDB();
    db.seedQuote(UUIDs[0]);
    const r1 = await invokeHandler(db, { external_quote_id: UUIDs[0], event_type: "approved", occurred_at: ISOs[0], payload: {} });
    const r2 = await invokeHandler(db, { external_quote_id: UUIDs[0], event_type: "approved", occurred_at: ISOs[1], payload: {} });
    expect(r1.body).toMatchObject({ applied: true });
    expect(r2.body).toMatchObject({ applied: true });
    // ⚠ Em produção, timestamptz normaliza para UTC → seria duplicata.
    // Este teste apenas garante que o handler NÃO explode; a normalização
    // é responsabilidade do PostgreSQL.
  });
});

// ─────────────────────────────────────────────────────────────
// (B) DISPATCHER — contrato de retry/backoff (lado CRM)
// ─────────────────────────────────────────────────────────────
type V4Response = { status: number; headers?: Record<string, string> };
type DispatchOutcome = {
  finalStatus: "delivered" | "dead_letter" | "exhausted";
  attempts: number;
  waits: number[];
  reason?: string;
};

/**
 * Contract dispatcher — o CRM Promo Champions DEVE seguir este comportamento
 * ao chamar `receive-crm-callback`. Semântica derivada da política acordada
 * com o PO:
 *   - 2xx  → delivered
 *   - 401  → dead-letter imediato (secret desalinhada, retentar é inútil)
 *   - 4xx (exceto 401/429) → dead-letter imediato (payload malformado)
 *   - 429  → respeita Retry-After (ou 30s default), conta como tentativa
 *   - 5xx  → exponential backoff (1s, 2s, 4s, 8s, 16s) até maxAttempts
 *   - após maxAttempts em 5xx/429 → exhausted (vai para DLQ)
 */
function dispatch(responses: V4Response[], opts: { maxAttempts?: number; baseMs?: number } = {}): DispatchOutcome {
  const max = opts.maxAttempts ?? 5;
  const base = opts.baseMs ?? 1000;
  const waits: number[] = [];
  for (let attempt = 1; attempt <= max; attempt++) {
    const r = responses[attempt - 1] ?? { status: 500 }; // se acabar, considera 500 (timeout)
    if (r.status >= 200 && r.status < 300) {
      return { finalStatus: "delivered", attempts: attempt, waits };
    }
    if (r.status === 401) {
      return { finalStatus: "dead_letter", attempts: attempt, waits, reason: "invalid_api_key" };
    }
    if (r.status >= 400 && r.status < 500 && r.status !== 429) {
      return { finalStatus: "dead_letter", attempts: attempt, waits, reason: `client_error_${r.status}` };
    }
    // 429 ou 5xx → agenda backoff (exceto se for a última tentativa)
    if (attempt < max) {
      if (r.status === 429) {
        const retryAfter = Number(r.headers?.["retry-after"] ?? "30");
        waits.push(retryAfter * 1000);
      } else {
        waits.push(base * 2 ** (attempt - 1)); // 1s, 2s, 4s, 8s, 16s...
      }
    }
  }
  const last = responses[Math.min(max, responses.length) - 1];
  return { finalStatus: "exhausted", attempts: max, waits, reason: last?.status === 429 ? "rate_limited" : "server_error" };
}

describe("B) Dispatcher — contract de backoff/exhausted contra o V4", () => {
  it("200 na 1ª tentativa → delivered, 0 esperas", () => {
    const r = dispatch([{ status: 200 }]);
    expect(r).toEqual({ finalStatus: "delivered", attempts: 1, waits: [] });
  });

  it("500 x4 + 200 → delivered na 5ª, com backoff 1s→2s→4s→8s", () => {
    const r = dispatch([{ status: 500 }, { status: 500 }, { status: 500 }, { status: 500 }, { status: 200 }]);
    expect(r.finalStatus).toBe("delivered");
    expect(r.attempts).toBe(5);
    expect(r.waits).toEqual([1000, 2000, 4000, 8000]);
  });

  it("401 na 1ª → dead_letter IMEDIATO (secret desalinhada, sem retry)", () => {
    const r = dispatch([{ status: 401 }, { status: 200 }]);
    expect(r.finalStatus).toBe("dead_letter");
    expect(r.attempts).toBe(1);
    expect(r.reason).toBe("invalid_api_key");
    expect(r.waits).toEqual([]);
  });

  it("400 → dead_letter (payload malformado, retry seria loop)", () => {
    const r = dispatch([{ status: 400 }]);
    expect(r.finalStatus).toBe("dead_letter");
    expect(r.reason).toBe("client_error_400");
  });

  it("429 respeita Retry-After (X-Retry-After: 5) → wait 5000ms", () => {
    const r = dispatch([{ status: 429, headers: { "retry-after": "5" } }, { status: 200 }]);
    expect(r.finalStatus).toBe("delivered");
    expect(r.waits).toEqual([5000]);
  });

  it("429 sem Retry-After → default 30s", () => {
    const r = dispatch([{ status: 429 }, { status: 200 }]);
    expect(r.waits).toEqual([30000]);
  });

  it("5xx em TODAS as 5 tentativas → exhausted (vai para DLQ)", () => {
    const r = dispatch(Array(5).fill({ status: 500 }));
    expect(r.finalStatus).toBe("exhausted");
    expect(r.attempts).toBe(5);
    expect(r.reason).toBe("server_error");
    // Backoff completo entre as 4 primeiras — última tentativa não agenda espera.
    expect(r.waits).toEqual([1000, 2000, 4000, 8000]);
  });

  it("429 em TODAS as 5 tentativas → exhausted por rate limit", () => {
    const r = dispatch(Array(5).fill({ status: 429, headers: { "retry-after": "10" } }));
    expect(r.finalStatus).toBe("exhausted");
    expect(r.reason).toBe("rate_limited");
    expect(r.waits).toEqual([10000, 10000, 10000, 10000]);
  });

  it("3 dead-letters SINTÉTICOS: mostra a matriz sucesso/erro/retry", () => {
    // Exatamente o que o usuário pediu: 3 cenários canônicos.
    const scenarios = [
      { name: "SUCCESS  — 200 imediato", responses: [{ status: 200 }] as V4Response[] },
      { name: "ERROR    — 401 sem retry", responses: [{ status: 401 }] as V4Response[] },
      { name: "RETRY    — 500x2 → 200",   responses: [{ status: 500 }, { status: 500 }, { status: 200 }] as V4Response[] },
    ];
    const table = scenarios.map(({ name, responses }) => {
      const r = dispatch(responses);
      return { name, outcome: r.finalStatus, attempts: r.attempts, totalWaitMs: r.waits.reduce((a, b) => a + b, 0), reason: r.reason ?? "-" };
    });
    // eslint-disable-next-line no-console
    console.table(table);
    expect(table[0].outcome).toBe("delivered");
    expect(table[1].outcome).toBe("dead_letter");
    expect(table[2].outcome).toBe("delivered");
    expect(table[2].attempts).toBe(3);
    expect(table[2].totalWaitMs).toBe(3000); // 1s + 2s
  });

  it("fuzz: 200 sequências aleatórias — nunca lança, sempre termina", () => {
    let seed = 0xDEADBEEF;
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    const pool: number[] = [200, 201, 400, 401, 429, 500, 502, 503, 504];
    for (let i = 0; i < 200; i++) {
      const len = 1 + Math.floor(rand() * 10);
      const seq: V4Response[] = Array.from({ length: len }, () => ({ status: pool[Math.floor(rand() * pool.length)] }));
      const r = dispatch(seq);
      expect(["delivered", "dead_letter", "exhausted"]).toContain(r.finalStatus);
      expect(r.attempts).toBeGreaterThanOrEqual(1);
      expect(r.attempts).toBeLessThanOrEqual(5);
    }
  });
});
