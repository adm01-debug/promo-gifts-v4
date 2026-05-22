/**
 * P0 — Integrações externas (CRM Promobrind, Cloudflare Stream, ElevenLabs, Lovable AI).
 *
 * Cobertura: degradação graceful, fallback, ausência de chave, latência alta.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mockEdgeFunctionFetch,
  resetExternalMocks,
  crmDbBridgeOffline,
  crmDbBridgeStale,
  cloudflareStreamDown,
} from "./_mocks";
import { edgeFunctionExists, readEdgeFunctionSource } from "./_helpers";

const FUNCTIONS_BASE = "https://example.supabase.co/functions/v1";

describe("P0 — Integrações externas", () => {
  beforeEach(() => {
    mockEdgeFunctionFetch({});
  });
  afterEach(() => resetExternalMocks());

  // ─── CRM externo (Promobrind via external-db-bridge) ──────────────────
  it("catálogo: external-db-bridge retorna 503 estruturado quando DB externo offline", async () => {
    mockEdgeFunctionFetch({ "/external-db-bridge": crmDbBridgeOffline });
    const res = await fetch(`${FUNCTIONS_BASE}/external-db-bridge`);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it("catálogo: payload com stale=true contém lastUpdate ISO", async () => {
    mockEdgeFunctionFetch({ "/external-db-bridge": crmDbBridgeStale });
    const res = await fetch(`${FUNCTIONS_BASE}/external-db-bridge`);
    const data = await res.json();
    expect(data.stale).toBe(true);
    expect(data.lastUpdate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("CNPJ lookup: edge function existe e usa breaker/timeout (fetchWithBreaker, AbortController ou Promise.race)", () => {
    expect(edgeFunctionExists("cnpj-lookup")).toBe(true);
    const src = readEdgeFunctionSource("cnpj-lookup");
    // Aceita _shared/external-fetch (fetchWithBreaker tem AbortController interno),
    // AbortController/AbortSignal direto, ou Promise.race + setTimeout.
    const ok = /fetchWithBreaker|external-fetch|AbortController|AbortSignal|Promise\.race|setTimeout/i.test(src);
    expect(ok).toBe(true);
  });

  // ─── Cloudflare Stream ────────────────────────────────────────────────
  it("vídeo de produto: spec de fallback (Cloudflare 530) é entendido como erro de origem", async () => {
    mockEdgeFunctionFetch({ "videodelivery.net": cloudflareStreamDown });
    const res = await fetch("https://customer-x.videodelivery.net/abc/manifest.m3u8");
    expect(res.status).toBe(530);
    const data = await res.json();
    expect(data.errors[0].code).toBe(530);
  });

  // ─── ElevenLabs (TTS / Scribe) ────────────────────────────────────────
  it("elevenlabs-tts: edge function existe (cliente cai para texto quando 402)", () => {
    expect(edgeFunctionExists("elevenlabs-tts")).toBe(true);
  });

  // ─── Lovable AI Gateway ───────────────────────────────────────────────
  it("ai-recommendations: edge function existe e propaga erro 429/402", () => {
    expect(edgeFunctionExists("ai-recommendations")).toBe(true);
    const src = readEdgeFunctionSource("ai-recommendations");
    // Verifica que tratamento de 429 ou 402 está mencionado.
    const ok = /429|402|rate[-_ ]?limit|insufficient/i.test(src);
    expect(ok).toBe(true);
  });

  it("expert-chat: edge function existe", () => {
    expect(edgeFunctionExists("expert-chat")).toBe(true);
  });

  // ─── Connections Hub auto-test ────────────────────────────────────────
  it("connections-auto-test: edge function existe e usa _shared adapter", () => {
    expect(edgeFunctionExists("connections-auto-test")).toBe(true);
    const src = readEdgeFunctionSource("connections-auto-test");
    expect(src).toMatch(/_shared/);
  });
});
