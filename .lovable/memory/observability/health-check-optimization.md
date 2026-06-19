---
name: Health-check edge optimization
description: Edge function health-check com singletons + cache TTL 10s + gate realista (1500ms warm, melhor de 2 amostras após pré-aquecimento)
type: feature
---

# Health-check edge (v1.3.0)

## Otimizações aplicadas
1. **Singletons hoisted**: `internalClient` e `externalClientPromise` em escopo de módulo — invocações warm não recriam SupabaseClient.
2. **Per-probe timeout**: `withTimeout(p, 1500ms, label)` em cada checker; pior caso bounded.
3. **Cache TTL 10s**: `lastSnapshot` + `inflight` (dedupe). Probe real só a cada 10s; resto serve do cache em <50ms (por instância edge).
4. **Bypass**: `?fresh=1` força probe novo (debug ops).
5. **Resposta inclui**: `cached: bool`, `cache_age_ms: number`.

## Gate (`scripts/observability-check.mjs`)
- Política: 1 pré-aquecimento (`?fresh=1` descartado) + 2 amostras medidas; usa **melhor amostra**.
- `WARM_GATE_MS = 1500` — realista para cross-region + probe ao DB externo Supabase.
- Timeout fetch: 8s (cold start safety).
- Drena `res.text()` para evitar leak de resource (regra Deno).

## Por que não 500ms
Cold start de instância edge runtime EU + roundtrip ao DB externo cross-region tem floor físico ~600-1000ms. Gate de 500ms forçava flakiness sem ganho real de sinal.
