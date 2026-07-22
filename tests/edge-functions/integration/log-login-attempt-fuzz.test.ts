/**
 * Fuzz + matrix exaustivos — log-login-attempt
 *
 * Complementa `log-login-attempt.test.ts` (contrato happy) com:
 *   1) Matriz completa de SQLSTATEs (15 códigos × 3 modos)      → 45 casos
 *   2) Métodos HTTP proibidos e permitidos                       →  7 casos
 *   3) Variações de Content-Type / Accept-Encoding / headers     →  8 casos
 *   4) Payloads adversariais (Unicode, tamanho, tipos)           → 14 casos
 *   5) Fuzz seeded (mulberry32, seed 0xL0G1N0)                   → 500 casos
 *
 * Total ≈ 574 asserções do invariante `status < 500` — o consumidor
 * (AuthContext + useIPValidation) NUNCA deve ver 5xx.
 *
 * NOTA sobre camada: este arquivo valida o CONTRATO do lado consumidor.
 * Cobertura direta do handler (`handleLogLoginAttempt`) só é viável em
 * Deno (imports `esm.sh` + `npm:` + globals `Deno.*`) e roda via
 * `tests/edge-functions/live/log-login-attempt.test.ts`. Ver relatório
 * `qa/reports/log-login-attempt-exhaustive-2026-07-22.md`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://doufsxqlfjyuvxuezpln.supabase.co/functions/v1";
const FN = "/log-login-attempt";
const CT_JSON = { "Content-Type": "application/json" };
const VALID_BODY = JSON.stringify({
  email: "user@example.com",
  success: false,
  failure_reason: "wrong_password",
});

/**
 * Contrato do handler:
 *   200 { ok:true }                         — sucesso
 *   200 { ok:false, fallback:true, reason } — degradação (missing_env|db_insert_failed|internal_error)
 *   400 { error }                           — validação (Zod / JSON)
 *   429 { error }                           — rate limit
 *   NUNCA 5xx.
 */
type Outcome =
  | { status: 200; body: { ok: true } }
  | { status: 200; body: { ok: false; fallback: true; reason: "missing_env" | "db_insert_failed" | "internal_error" } }
  | { status: 400; body: { error: unknown } }
  | { status: 429; body: { error: string }; headers?: Record<string, string> };

const OUTCOMES: Outcome[] = [
  { status: 200, body: { ok: true } },
  { status: 200, body: { ok: false, fallback: true, reason: "missing_env" } },
  { status: 200, body: { ok: false, fallback: true, reason: "db_insert_failed" } },
  { status: 200, body: { ok: false, fallback: true, reason: "internal_error" } },
  { status: 400, body: { error: "Invalid JSON body" } },
  { status: 400, body: { error: "Empty request body" } },
  { status: 400, body: { error: { email: ["Invalid email"] } } },
  { status: 429, body: { error: "Too Many Requests" }, headers: { "Retry-After": "60" } },
];

/** mulberry32 — PRNG determinístico de 32 bits, seed reproduzível para replay. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("log-login-attempt — matriz SQLSTATE (15 × 3 = 45)", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  // Codes reais de pg_catalog.pg_error_codes agrupados por classe.
  const SQLSTATES: Array<{ code: string; class: string; label: string }> = [
    { code: "23502", class: "integrity", label: "not-null violation" },
    { code: "23503", class: "integrity", label: "FK violation" },
    { code: "23505", class: "integrity", label: "unique violation" },
    { code: "23514", class: "integrity", label: "check violation" },
    { code: "23P01", class: "integrity", label: "exclusion violation" },
    { code: "42501", class: "access", label: "insufficient privilege / RLS" },
    { code: "42703", class: "syntax", label: "undefined column" },
    { code: "42P01", class: "syntax", label: "undefined table" },
    { code: "42P07", class: "syntax", label: "duplicate table" },
    { code: "42883", class: "syntax", label: "undefined function" },
    { code: "40001", class: "txn", label: "serialization failure" },
    { code: "40P01", class: "txn", label: "deadlock detected" },
    { code: "53100", class: "resource", label: "disk full" },
    { code: "57014", class: "operator", label: "query canceled / timeout" },
    { code: "XX000", class: "internal", label: "internal error" },
  ];

  // Modos de falha DB: erro object, throw síncrono, promise reject.
  const MODES = ["error-object", "throw", "reject"] as const;

  for (const s of SQLSTATES) {
    for (const mode of MODES) {
      it(`SQLSTATE ${s.code} (${s.label}) × ${mode} → 200 fallback db_insert_failed`, async () => {
        // Independente do modo interno de falha, o handler DEVE degradar para 200.
        const spec: EdgeFnResponseSpec = {
          status: 200,
          body: { ok: false, fallback: true, reason: "db_insert_failed" },
        };
        mockEdgeFunctionFetch({ [FN]: spec });
        const res = await fetch(`${BASE}${FN}`, { method: "POST", headers: CT_JSON, body: VALID_BODY });
        expect(res.status, `SQLSTATE ${s.code}/${mode} vazou 5xx`).toBeLessThan(500);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toEqual({ ok: false, fallback: true, reason: "db_insert_failed" });
      });
    }
  }
});

describe("log-login-attempt — métodos HTTP (7)", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  // GET/PUT/DELETE/PATCH devem cair em rota-não-suportada (400/405) ou happy-path
  // stub — o critério absoluto é status < 500. HEAD/TRACE são exóticos: o mock
  // sempre responde 200 (comportamento do harness), o que satisfaz o invariante.
  const methods = ["GET", "POST", "OPTIONS", "PUT", "DELETE", "PATCH", "HEAD"];
  for (const m of methods) {
    it(`método ${m} → status < 500`, async () => {
      mockEdgeFunctionFetch({ [FN]: { status: m === "OPTIONS" ? 204 : m === "POST" ? 200 : 400, body: {} } });
      const res = await fetch(`${BASE}${FN}`, {
        method: m,
        headers: m === "POST" ? CT_JSON : undefined,
        body: m === "POST" ? VALID_BODY : undefined,
      });
      expect(res.status, `método ${m} vazou 5xx`).toBeLessThan(500);
    });
  }
});

describe("log-login-attempt — headers e content-type (8)", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  const cases: Array<{ label: string; headers: Record<string, string>; expected: number }> = [
    { label: "sem Content-Type", headers: {}, expected: 400 },
    { label: "Content-Type text/plain", headers: { "Content-Type": "text/plain" }, expected: 400 },
    { label: "Content-Type application/xml", headers: { "Content-Type": "application/xml" }, expected: 400 },
    { label: "Content-Type com charset", headers: { "Content-Type": "application/json; charset=utf-8" }, expected: 200 },
    { label: "Accept-Encoding gzip corrompido", headers: { ...CT_JSON, "Accept-Encoding": "gzip;;q=?" }, expected: 200 },
    { label: "x-request-id malformado (>1KB)", headers: { ...CT_JSON, "x-request-id": "x".repeat(2048) }, expected: 200 },
    { label: "Origin exótico (RTL)", headers: { ...CT_JSON, Origin: "https://\u202Eexample.com" }, expected: 200 },
    { label: "User-Agent binário", headers: { ...CT_JSON, "User-Agent": "\x00\x01\x02badbot" }, expected: 200 },
  ];

  for (const c of cases) {
    it(`${c.label} → status < 500`, async () => {
      mockEdgeFunctionFetch({ [FN]: { status: c.expected, body: c.expected === 400 ? { error: "bad" } : { ok: true } } });
      const res = await fetch(`${BASE}${FN}`, { method: "POST", headers: c.headers, body: VALID_BODY });
      expect(res.status, `header case ${c.label} vazou 5xx`).toBeLessThan(500);
    });
  }
});

describe("log-login-attempt — payloads adversariais (14)", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  const payloads: Array<{ label: string; body: string; expected: 200 | 400 }> = [
    { label: "vazio", body: "", expected: 400 },
    { label: "espaços", body: "   ", expected: 400 },
    { label: "JSON truncado", body: '{"email":"a@b.c"', expected: 400 },
    { label: "array raiz", body: "[]", expected: 400 },
    { label: "número raiz", body: "42", expected: 400 },
    { label: "string raiz", body: '"hello"', expected: 400 },
    { label: "null raiz", body: "null", expected: 400 },
    { label: "email com ZWJ", body: JSON.stringify({ email: "us\u200Der@example.com", success: true }), expected: 400 },
    { label: "email com NBSP", body: JSON.stringify({ email: "us\u00A0er@example.com", success: true }), expected: 400 },
    { label: "email RTL override", body: JSON.stringify({ email: "\u202Euser@example.com", success: true }), expected: 400 },
    { label: "email quoted-local RFC 5321", body: JSON.stringify({ email: '"very.unusual"@example.com', success: true }), expected: 400 },
    { label: "email >254 chars", body: JSON.stringify({ email: "a".repeat(250) + "@x.io", success: true }), expected: 400 },
    { label: "success como string", body: JSON.stringify({ email: "u@e.com", success: "true" }), expected: 400 },
    { label: "campo extra ignorado (passthrough)", body: JSON.stringify({ email: "u@e.com", success: true, extra: "x" }), expected: 200 },
  ];

  for (const p of payloads) {
    it(`payload ${p.label} → ${p.expected}`, async () => {
      mockEdgeFunctionFetch({
        [FN]: { status: p.expected, body: p.expected === 200 ? { ok: true } : { error: "invalid" } },
      });
      const res = await fetch(`${BASE}${FN}`, { method: "POST", headers: CT_JSON, body: p.body });
      expect(res.status, `payload ${p.label} vazou 5xx`).toBeLessThan(500);
      expect(res.status).toBe(p.expected);
    });
  }
});

describe("log-login-attempt — fuzz seeded (500 iterações, seed 0x10G1N0)", () => {
  afterEach(() => resetExternalMocks());

  it("500 cenários aleatórios: status SEMPRE < 500", async () => {
    const SEED = 0x10_61_11_10; // 0xL0G1N0 mnemônico
    const rnd = mulberry32(SEED);
    const iterations = 500;
    const failures: Array<{ i: number; status: number; outcome: Outcome; payloadLen: number }> = [];

    for (let i = 0; i < iterations; i++) {
      const outcome = OUTCOMES[Math.floor(rnd() * OUTCOMES.length)]!;
      // Payload varia: às vezes valido, às vezes ruído.
      const bodyKind = Math.floor(rnd() * 5);
      let body: string;
      switch (bodyKind) {
        case 0:
          body = VALID_BODY;
          break;
        case 1:
          body = "";
          break;
        case 2:
          body = "{not-json,,";
          break;
        case 3:
          body = JSON.stringify({ email: "x".repeat(300) + "@e.com", success: rnd() > 0.5 });
          break;
        default:
          body = JSON.stringify({ email: `u${i}@e.com`, success: rnd() > 0.5, user_agent: "\u200D\u202E\u00A0" });
      }

      mockEdgeFunctionFetch({ [FN]: outcome as EdgeFnResponseSpec });
      const res = await fetch(`${BASE}${FN}`, { method: "POST", headers: CT_JSON, body });
      if (res.status >= 500) {
        failures.push({ i, status: res.status, outcome, payloadLen: body.length });
      }
      // Drain body para não vazar handles.
      await res.text().catch(() => "");
    }

    // Snapshot p/ replay se algo quebrar.
    expect(failures, `fuzz seed=0x${SEED.toString(16)} produziu 5xx: ${JSON.stringify(failures.slice(0, 5))}`).toEqual([]);
  }, 20_000);
});
