# Faxina DB — 2026-06-20 · Tier 3c (funções) + análise definitiva de funções

Continuação de `FAXINA_DB_2026-06-20.md` (Tier 1) e `_TIER3.md` (views + funções). Tier 1 e Tier 3 já mergeados.

## 1. Executado neste lote (Tier 3c)
Arquivadas **17 funções** comprovadamente seguras → `public` funções **1159 → 1142**.
Convertores/formatadores puros, funções de trigger `updated_at` **destacadas** (duplicatas sem trigger
anexado) e diagnósticos de dev:
`cm_to_mm, mm_to_cm, g_to_kg, kg_to_g, l_to_ml, ml_to_l, m_to_cm, convert_string_to_unit,
fn_circumference_to_diameter, fn_hex_to_rgb, fn_format_capacity_display, fn_format_dimensions_display,
tg_set_updated_at, trigger_set_updated_at, fn_cor_updated_at, fn_index_usage_report, fn_assert_public_contract`.

Reversível: `scripts/faxina-rollback.sql` (sessão `claude-faxina-2026-06-20`).

## 2. Por que NÃO arquivamos as ~314 funções restantes (decisão de DBA)

Tentamos a abordagem correta — **dados de runtime** — e descobrimos os limites:

| Sinal | Resultado |
|---|---|
| Estático (deps/cron/corpo de função/famílias dinâmicas) | 411 "mortas" |
| + `pg_stat_statements` (12 dias, excluindo metaqueries) | 331 também sem chamadas reais |
| Revisão individual das de menor risco | só **17** seguras de fato |

**Bloqueios que impedem o resto com segurança:**
1. **`track_functions` = `none` e NÃO habilitável** — é parâmetro `superuser` no Supabase gerenciado
   (negado via SQL; não exposto no dashboard). Requer **ticket no suporte Supabase** (Pro) ou a
   **Management API** `PATCH /v1/projects/doufsxqlfjyuvxuezpln/config/database/postgres` `{"track_functions":"pl"}`.
2. **`pg_stat_statements` está no limite (4985/5000)** → faz *eviction* de chamadas de média frequência.
   Logo, "ausente do pgss" **não** prova "morta" (ex.: `record_auth_attempt`, `rate_limit_check`,
   `mark_notification_read`, `block_ip_temp` parecem mortas mas quase certamente foram **despejadas**).
3. **Despacho dinâmico** no código (`.rpc(variável)` em `supabase-client-adapter.ts`; registry
   `classify_*`; SQL dinâmico no pipeline medallion) → análise estática não cobre.

Arquivar funções de pipeline às cegas = risco de **quebra silenciosa** do processamento de produtos.

## 3. Caminho seguro para concluir a limpeza de funções (quando quiser 10/10)

**Passo A — instrumentar (1 escolha):**
- Pedir ao **suporte Supabase** para setar `track_functions = pl` (ideal), **ou**
- Aumentar `pg_stat_statements.max` (ex.: 15000) e rodar `select pg_stat_statements_reset();`
  para uma **janela limpa** (cuidado: zera as estatísticas de observabilidade do time).

**Passo B — coletar ~7–14 dias** cobrindo todos os ciclos de cron (inclusive semanais/mensais).

**Passo C — arquivar em lotes** usando `pg_stat_user_functions.calls = 0` (ou pgss limpo) como gate
DEFINITIVO (pega despacho dinâmico), priorizando duplicatas `*_v2/_v3`, ingestão de fornecedores
desativados e getters de dashboards descontinuados. Sempre com `manifest` + verificação pós-lote.

## 4. Estado acumulado da faxina (produção)
| | Antes | Agora |
|---|---|---|
| Tabelas `public` | 334 | **309** |
| Views `public` | 171 | **58** |
| Funções `public` | 1170 | **1142** |
| Alertas de exposição API | ~150 | **0** |

Total: **166 objetos** arquivados (reversíveis), 0 `DROP`. Tabelas críticas, RPCs vivas, views
`*_public` e funções de auth/rate-limit/telemetria/pipeline **preservadas**.
