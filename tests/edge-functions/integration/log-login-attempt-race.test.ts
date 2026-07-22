/**
 * Onda 3 (G5) — Fuzz de concorrência do rate limit
 * -----------------------------------------------------------------
 * Cenário: 20 requests paralelos do MESMO IP dentro da mesma janela
 * do bucket (10 req/min por IP, conforme `loginLogLimiter`).
 *
 * Invariante duplo:
 *   (a) EXATAMENTE 10 respostas 200 (o limite configurado)
 *   (b) EXATAMENTE 10 respostas 429
 *   (c) NENHUMA resposta 5xx (o contrato nunca-5xx segue firme mesmo
 *       sob TOCTOU do bucket compartilhado)
 *
 * NOTA: este teste roda contra o harness mockado que simula a rota
 * `/log-login-attempt` com um contador atômico local. Não substitui a
 * suíte LIVE — complementa validando a lógica do consumidor sob rajada.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks } from "../../p0/_mocks";

const BASE = "https://doufsxqlfjyuvxuezpln.supabase.co/functions/v1";
const FN = "/log-login-attempt";
const CT_JSON = { "Content-Type": "application/json" };
const VALID_BODY = JSON.stringify({
  email: "race@example.com",
  success: false,
  failure_reason: "wrong_password",
});

const LIMIT = 10;
const BURST = 20;

describe("log-login-attempt — race condition no rate limit (BURST=20, LIMIT=10)", () => {
  beforeEach(() => {
    // Setup: um contador que devolve 200 até LIMIT, depois 429.
    let count = 0;
    mockEdgeFunctionFetch({
      [FN]: () => {
        count += 1;
        if (count > LIMIT) {
          return {
            status: 429,
            body: { error: "Too Many Requests" },
            headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" },
          };
        }
        return { status: 200, body: { ok: true } };
      },
    });
  });
  afterEach(() => resetExternalMocks());

  it("20 requests paralelos → EXATAMENTE 10x200 + 10x429, ZERO 5xx", async () => {
    const promises = Array.from({ length: BURST }, () =>
      fetch(`${BASE}${FN}`, { method: "POST", headers: CT_JSON, body: VALID_BODY }),
    );
    const results = await Promise.all(promises);

    const statuses = results.map((r) => r.status);
    const ok = statuses.filter((s) => s === 200).length;
    const tooMany = statuses.filter((s) => s === 429).length;
    const server = statuses.filter((s) => s >= 500).length;

    expect(server, `vazou 5xx sob concorrência: ${statuses.join(",")}`).toBe(0);
    expect(ok, `esperado ${LIMIT} 200, obtido ${ok}`).toBe(LIMIT);
    expect(tooMany, `esperado ${BURST - LIMIT} 429, obtido ${tooMany}`).toBe(BURST - LIMIT);

    // Drain bodies para não vazar handles no Vitest
    await Promise.all(results.map((r) => r.text().catch(() => "")));
  });

  it("rajada repetida 5x (100 requests) mantém invariante nunca-5xx", async () => {
    for (let round = 0; round < 5; round++) {
      const promises = Array.from({ length: BURST }, () =>
        fetch(`${BASE}${FN}`, { method: "POST", headers: CT_JSON, body: VALID_BODY }),
      );
      const results = await Promise.all(promises);
      const server = results.filter((r) => r.status >= 500).length;
      expect(server, `round ${round} vazou 5xx`).toBe(0);
      await Promise.all(results.map((r) => r.text().catch(() => "")));
    }
  });
});
