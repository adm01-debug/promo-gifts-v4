# REST Native Migration — Conexão Frontend ↔ Backend

**Data**: 2026-05-29/30
**Commits**: `d492709`, `c7fc83b`
**Status**: ✅ Completo — 100% REST nativo, bridge OFF

## O que mudou

O frontend (`www.promogifts.com.br`) migrou de **Edge Function bridge** para **PostgREST direto**.

### Antes (bridge)
```
Browser → Edge Function (88KB Deno, cold starts) → PostgREST → Postgres
P50: ~150ms warm, ~1500ms cold
```

### Depois (REST nativo)
```
Browser → PostgREST direto → Postgres
P50: ~80ms, zero cold starts
```

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/lib/external-db/rest-native.ts` | Whitelist 23 tabelas, 5 aliases, `_search` via ilike |
| `src/lib/external-db/bridge.ts` | `decomposeBatchToIndividual()` fallback |
| `supabase/migrations/20260530*` | VIEWs + RLS policies |

## VIEWs de segurança

| VIEW | Tabela base | Oculta |
|---|---|---|
| `v_suppliers_public` | `suppliers` | `api_credentials`, `default_markup_percent`, `cnpj`, `notes` |
| `v_print_area_techniques_public` | `print_area_techniques` | `unit_cost`, `notes` |

## Kill-switch

```sql
-- Ver estado atual
SELECT switch_name, enabled, rollout_percentage FROM system_kill_switches
WHERE switch_name = 'edge_external_db_bridge';

-- Rollback emergencial (volta 100% bridge)
UPDATE system_kill_switches SET enabled = true
WHERE switch_name = 'edge_external_db_bridge';
```

## RLS policies adicionadas

| Tabela | Policy | Roles |
|---|---|---|
| `color_variations` | `color_variations_public_read` | anon, authenticated |
| `product_materials` | `product_materials_public_read` | anon, authenticated |
| `product_kit_components` | `product_kit_components_public_read` | anon, authenticated |
| `material_types` | `material_types_public_read` | anon, authenticated |
| `tecnicas_gravacao` | `tecnicas_gravacao_public_read` | anon, authenticated |
| `tabela_preco_gravacao_oficial_faixa` | `..._public_read` | anon, authenticated |
| `ramo_atividade` | `ramo_atividade_public_read` | anon, authenticated |
