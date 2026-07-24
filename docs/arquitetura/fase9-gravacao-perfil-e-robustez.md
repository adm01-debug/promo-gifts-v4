# Fase 9 — Gravação por perfil + robustez do cron (execução 2026-06-11)

> Projeto `doufsxqlfjyuvxuezpln`. Precedida de **simulação massiva**: 17 sondagens
> estruturais (SIM-01..17) + **1.848 cenários reais de paridade** (cada
> produto-com-área testado contra o perfil modal da sua categoria).

## O que a simulação revelou (antes de executar)

| Descoberta | Impacto no plano |
|---|---|
| `silver_print_areas` + `supplier_technique_mappings` **dropados** entre sessões | O plano antigo (portar do legado) morreu; fonte = perfis das áreas validadas em produção |
| Calculadora **v12** consome `print_area_techniques` (JOIN `product_id`+`tabela_preco_id`+`location_code`) | Formato-alvo selado; é diretamente o sistema de **preço** |
| Áreas existentes (13k, abril) seguem **perfis por categoria** (LADO-A/B, FRENTE, CIRCULAR…) | A inferência por perfil replica o processo já validado |
| **Paridade 91,8%** (1.697/1.848 exatos) | **Gate PASSA**; resíduo coberto pelo gate de confiança |
| Catálogo cresce ~380 produtos/dia, **0 áreas/dia** | Gap crescente: produto novo não cotável |
| SPOT: universo fechado de 14 técnicas; HOT_STAMPING/ETIQUETA sem tabela ativa | Não-cotáveis por definição; skip correto |

## Item A — Robustez do cron (`process_pending_batches`)

2º passo no cron: promove staging `standardized` **órfão** (sem raw pendente) —
pads via `fn_promote_supplier` E variantes cujo pai já está `promoted` via
`fn_promote_variants_of_parent` direto.

**O passo expôs erros reais presos em silêncio** (e os corrigimos):
- `fn_promote_variants_of_parent` violava `chk_spr_no_processed_with_errors`
  (marcava raw processed sem limpar `process_errors`) → **fix: limpa ao promover**.
- Violava `chk_vss_cost_price_not_zero` com custo 0 do fornecedor (testava só
  `IS NOT NULL`) → **fix: só grava VSS com `cost_price > 0`**.
- 11 padvars de 06-09 `promoted` sem `variant_id` → resetados e reparados pelo
  novo passo (fallback idempotente casou variantes reais por `(product_id,
  supplier_sku)`).

**Validação:** teste de fogo com **900 raws reais** (SUCCESS, drenagem total);
`pad/padvar standardized = 0`, invariante `promoted-sem-vid = 0`.

## Item B — Áreas de gravação por perfil de categoria

`fn_apply_print_profiles(p_limit, p_dry_run)` — fill-only, gate de confiança
(≥3 exemplares + dominância ≥60% do fingerprint modal), copia as áreas do
produto-exemplar modal, auditável (`notes='profile_inference v1 …'`), ACL
restrita. Cron `pipeline-print-profiles` (*/15) cobre produtos novos.

**Resultados (produção):**
- Dry-run validado antes (356/600 aplicáveis) → aplicado em 3 lotes.
- **8.027 áreas / 1.198 produtos**; cobertura **1.848 → 3.046 produtos (+65%)**.
- Qualidade: 0 tabelas inativas, 0 dims inválidas.
- 4.066 sem perfil confiável **ficam de fora por design** (sem evidência, não
  se carimba preço); entram conforme categorias/perfis amadurecem.
- **Teste de fogo de preço:** produto inferido ("BOLSA TÉRMICA 31L") cotado
  pela v12 — custo 190,00 / venda 408,50, `motivo_erro NULL`. ✅

## Rollback

- Item B: `DELETE FROM print_area_techniques WHERE notes LIKE 'profile_inference%';`
  + `cron.unschedule('pipeline-print-profiles')`.
- Item A: reverter `process_pending_batches`/`fn_promote_variants_of_parent`
  para os corpos da Fase 8 (migrations anteriores).

## Migrations
`20260611120000..120300` (fase9_01..04) — corpos completos aplicados via MCP
(MCP-first, ADR 0006); arquivos no repo documentam o aplicado.
