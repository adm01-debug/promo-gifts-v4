# Schema vivo — snapshot de auditoria (doufsxqlfjyuvxuezpln)

**Data:** 2026-05-23 · Gerado pela auditoria de paridade repo×Supabase.

## Estado

Reflete o banco vivo **pós-alinhamento** (waves `align_wave_3_5_*`, `wave_3_2_*`,
`etapa3d_consolidar_drifts_*`, `etapa10_a_order_items_calc_subtotal`,
`fix_has_drift_semantics`) e **pós-hardening** (migration `20260523135203`).

- **390** relações no schema `public` (278 tabelas base + 112 views).
- **4790** colunas.
- **RLS:** 278/278 tabelas (100%), 682 policies.
- **Edge functions:** 81/81 do repo deployadas (+ `bulk-random-passwords`, agora versionada).

## Por que este arquivo existe

O `audit/internal-schema.tsv` canônico estava num estado **pré-alinhamento**
(listava `favorites`/`mcp_keys`/`order_items.total_price`, quando a live já evoluiu
para `user_favorites`/`mcp_api_keys`/`order_items.subtotal`). Este snapshot registra
o estado real atualizado.

**Importante — não regenerar o `internal-schema.tsv` à mão:** sua 4ª coluna
(cobertura-frontend) é derivada do pipeline `scripts/audit-db-frontend-coverage.mjs`,
que cruza o schema com o uso em `src/`. Para regenerá-lo fielmente, rode esse pipeline.

## Fonte de verdade do drift

Não é o TSV estático. É o framework vivo do próprio repo:
`fn_run_schema_drift_check()` + `get_public_schema_signatures()`, registrando em
`schema_drift_log` e tolerando exceções via `schema_drift_allowlist` (15 entradas),
acionado pelo cron `schema-drift-check` (diário, 02:00). No último run completo
bem-sucedido (22/05 15:24) o resultado foi `has_drift=false` com 389=389 relações.
