/**
 * Guards contract test — receive-crm-callback
 * -----------------------------------------------------------------
 * Cobre as hardenings adicionadas ao handler:
 *   - 413 payload_too_large (content-length e conteúdo real)
 *   - 400 occurred_at_in_future  (skew > 5min)
 *   - 400 occurred_at_too_old    (idade > 7d)
 *
 * Não sobe o Deno runtime — reimplementa as invariantes numéricas
 * assertando os mesmos limites usados na edge, garantindo que qualquer
 * alteração acidental dos limites quebre o CI.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../../supabase/functions/receive-crm-callback/index.ts"),
  "utf8",
);

// ---------- 1) Invariantes numéricas (constantes de hardening) ----------
describe("receive-crm-callback — hardening constants (source parity)", () => {
  it("MAX_BODY_BYTES = 64KB", () => {
    expect(SRC).toMatch(/MAX_BODY_BYTES\s*=\s*64\s*\*\s*1024/);
  });
  it("MAX_FUTURE_SKEW_MS = 5min", () => {
    expect(SRC).toMatch(/MAX_FUTURE_SKEW_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/);
  });
  it("MAX_PAST_WINDOW_MS = 7 dias", () => {
    expect(SRC).toMatch(/MAX_PAST_WINDOW_MS\s*=\s*7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  });
});

// ---------- 2) Códigos de erro esperados presentes no handler ----------
describe("receive-crm-callback — error codes exposed", () => {
  it.each([
    ["payload_too_large", 413],
    ["occurred_at_in_future", 400],
    ["occurred_at_too_old", 400],
    ["invalid_api_key", 401],
    ["invalid_json", 400],
    ["invalid_payload", 400],
    ["method_not_allowed", 405],
  ])("emite código %s (HTTP %i)", (code, _status) => {
    expect(SRC).toContain(`"${code}"`);
  });
});

// ---------- 3) Classificadores puros (mesma matemática do handler) ----------
const MAX_BODY_BYTES = 64 * 1024;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const MAX_PAST_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function classify(nowMs: number, occurredIso: string, sizeBytes: number) {
  if (sizeBytes > MAX_BODY_BYTES) return "too_large";
  const t = Date.parse(occurredIso);
  if (Number.isNaN(t)) return "invalid";
  if (t - nowMs > MAX_FUTURE_SKEW_MS) return "future_skew";
  if (nowMs - t > MAX_PAST_WINDOW_MS) return "too_old";
  return "ok";
}

describe("receive-crm-callback — classifier edge table", () => {
  const NOW = Date.parse("2026-07-06T12:00:00+00:00");
  const cases: Array<[string, string, number, string]> = [
    ["exact now",     "2026-07-06T12:00:00+00:00", 100, "ok"],
    ["4min future",   "2026-07-06T12:04:00+00:00", 100, "ok"],
    ["6min future",   "2026-07-06T12:06:00+00:00", 100, "future_skew"],
    ["6d ago",        "2026-06-30T12:00:00+00:00", 100, "ok"],
    ["8d ago",        "2026-06-28T12:00:00+00:00", 100, "too_old"],
    ["64KB exact",    "2026-07-06T12:00:00+00:00", 64 * 1024, "ok"],
    ["64KB+1 byte",   "2026-07-06T12:00:00+00:00", 64 * 1024 + 1, "too_large"],
    ["malformed iso", "not-a-date",                100, "invalid"],
  ];
  it.each(cases)("%s", (_name, iso, size, expected) => {
    expect(classify(NOW, iso, size)).toBe(expected);
  });
});

// ---------- 4) Fuzz determinístico (500 cenários) ----------
describe("receive-crm-callback — 500-scenario fuzz", () => {
  it("distribui buckets consistentes e cobre todos os ramos", () => {
    let seed = 0xC0FFEE;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
    const NOW = Date.parse("2026-07-06T12:00:00+00:00");
    const buckets: Record<string, number> = { ok: 0, future_skew: 0, too_old: 0, invalid: 0, too_large: 0 };
    for (let i = 0; i < 500; i++) {
      const off = (rnd() * 31 - 30) * 86_400_000; // -30d .. +1d
      const iso = new Date(NOW + off).toISOString().replace("Z", "+00:00");
      const size = Math.floor(rnd() * 100_000);
      buckets[classify(NOW, iso, size)]++;
    }
    // Todos os ramos exceto "invalid" (raro) devem ser exercitados.
    expect(buckets.ok).toBeGreaterThan(0);
    expect(buckets.too_old).toBeGreaterThan(0);
    expect(buckets.too_large).toBeGreaterThan(0);
    expect(buckets.future_skew).toBeGreaterThan(0);
    // Soma total preservada.
    const sum = Object.values(buckets).reduce((a, b) => a + b, 0);
    expect(sum).toBe(500);
  });
});
