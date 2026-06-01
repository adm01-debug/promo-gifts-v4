> 📌 **Este documento é histórico.** A **fonte de verdade** sobre a bridge e o
> REST nativo (arquitetura atual, mapa de arquivos, kill-switch, camada de
> compatibilidade, lacuna de escrita e passos de aposentadoria) é:
> **[`docs/ARQUITETURA_BRIDGE_REST_NATIVE.md`](./ARQUITETURA_BRIDGE_REST_NATIVE.md)**.
> Mantenha este arquivo apenas como registro da migração (métricas, RLS add/removidas).

# REST Native Migration

**Data**: 2026-05-29/30
**Commits**: `d492709`, `c7fc83b`, `db8f9e0`
**Status**: Completo - 100% REST nativo, bridge OFF
**Testes**: 94 cenarios HTTP, 0 falhas

## O que mudou

O frontend (www.promogifts.com.br) migrou de Edge Function bridge para PostgREST direto.

### Antes (bridge)
```
Browser -> Edge Function (88KB Deno, cold starts) -> PostgREST -> Postgres
P50: ~150ms warm, ~1500ms cold
```

### Depois (REST nativo)
```
Browser -> PostgREST direto -> Postgres
P50: ~80ms, zero cold starts
```

## Arquitetura

```
invokeExternalDb()
  |-- isRestNativeEligible()? -> executeRestNativeSelect()
  |     |-- TABLE_ALIASES resolve (suppliers -> v_suppliers_public)
  |     |-- _search -> ilike (idx_products_name_trgm GIN)
  |     +-- PostgREST operators parsed (in.(), lt., gte.)
  +-- tryEdgeFunctionBridge() -> KillSwitchActiveError -> { records:[], count:0 }

invokeBatchBridge()
  +-- KillSwitchActiveError -> decomposeBatchToIndividual()
        +-- Promise.allSettled( invokeExternalDb() x N )
```

## Tabelas whitelisted (23 entries)

| Tabela/View | Rows | Alias |
|---|---|---|
| products | 6.123 | - |
| product_variants | 16.456 | - |
| product_images | 46.122 | - |
| product_videos | 139 | - |
| product_kit_components | 3.424 | - |
| product_materials | 9.645 | - |
| v_suppliers_public | 5 | `suppliers` -> VIEW |
| color_variations | 80 | - |
| color_groups | 18 | - |
| categories | 463 | - |
| material_types | 91 | - |
| v_print_area_techniques_public | 13.238 | `print_area_techniques` -> VIEW |
| tabela_preco_gravacao_oficial | 52 | `tecnica_gravacao` -> real table |
| tabela_preco_gravacao_oficial_faixa | 884 | `customization_price_tiers` -> real table |
| tecnicas_gravacao | 16 | `personalization_techniques` -> real table |
| ramo_atividade | 22 | - |
| system_kill_switches | 6 | - |

## VIEWs de seguranca

| VIEW | Tabela base | Oculta |
|---|---|---|
| `v_suppliers_public` | `suppliers` | `api_credentials`, `default_markup_percent`, `cnpj`, `notes`, `api_base_url` |
| `v_print_area_techniques_public` | `print_area_techniques` | `unit_cost`, `notes` |

Ambas: `security_invoker=false`, `GRANT SELECT` anon+authenticated.

## Kill-switch

```sql
-- Ver estado atual
SELECT switch_name, enabled, rollout_percentage
FROM system_kill_switches
WHERE switch_name = 'edge_external_db_bridge';
-- Estado atual: enabled=false, rollout_percentage=100 -> 100% REST nativo

-- Rollback emergencial (volta 100% bridge)
UPDATE system_kill_switches SET enabled = true
WHERE switch_name = 'edge_external_db_bridge';
```

## RLS policies adicionadas

| Tabela | Policy |
|---|---|
| `color_variations` | `color_variations_public_read` |
| `product_materials` | `product_materials_public_read` |
| `product_kit_components` | `product_kit_components_public_read` |
| `material_types` | `material_types_public_read` |
| `tecnicas_gravacao` | `tecnicas_gravacao_public_read` |
| `tabela_preco_gravacao_oficial_faixa` | `..._public_read` |
| `ramo_atividade` | `ramo_atividade_public_read` |

## Policies removidas (supersedidas)

| Tabela | Policy removida | Motivo |
|---|---|---|
| `tecnicas_gravacao` | `auth_read_tecnicas_gravacao` | Subconjunto de `_public_read` |
| `tabela_preco_gravacao_oficial_faixa` | `..._authenticated_read` | Subconjunto de `_public_read` |
| `ramo_atividade` | `ra_select_authenticated` | Subconjunto de `_public_read` |
| `material_types` | `mt_select` | uid-filtered, supersedido |
| `product_kit_components` | `..._select` | org_member, supersedido |

## Degradacao graciosa

| Caso | Comportamento |
|---|---|
| `customization_price_tables` (alias -> tabela inexistente) | Retorna `[]` silenciosamente |
| Tabela nao no whitelist | `tryExecuteRestNative()` -> null -> bridge -> empty |
| PostgREST down | Bridge OFF -> `{ records: [], count: 0 }` |

## Proximos passos

- [ ] **+7 dias estavel**: deletar Edge Function `external-db-bridge` (88KB de codigo Deno morto)
