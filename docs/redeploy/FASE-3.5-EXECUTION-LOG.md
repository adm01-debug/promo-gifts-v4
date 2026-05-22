# Redeploy 2026-05 — Fase 3.5 — Log de Execução

**Data**: 2026-05-22 15:30–16:09 UTC (~40 min execução efetiva)
**Operador**: Agente Claude via MCP Supabase (Gestão de Produtos) + Lovable MCP + GitHub MCP
**Sponsor**: Abner Silva (`ti@promobrindes.com.br`)
**Bancos envolvidos**:
- **Oficial (SSOT)**: `doufsxqlfjyuvxuezpln` (Gestão de Produtos) — host `2600:1f1e:75b:4b0a:...`
- **Lovable Cloud interno**: `pqpdolkaeqlyzpdpbizo` (`is_managed_by_lovable: true`) — host `2600:1f16:1ce4:1c00:...`

## TL;DR

8 tabelas que tinham schema diff (`schema_drift`) entre os dois bancos foram alinhadas ou colocadas em allowlist documentada. Resultado: **`schema_drift = 0`** e Gate CI verde nas comparações de schema entre tabelas presentes em ambos os bancos.

| Métrica | Antes da Fase 3.5 | Depois | Δ |
|---|---:|---:|---:|
| Schema drift (tabelas com diff entre Oficial e Lovable) | **8** | **0** | **−8 ✅** |
| Tabelas só no Oficial (catálogo SSOT) | 260 | 261 | +1 (`schema_drift_allowlist`) |
| Tabelas só no Lovable | 16 | 3 | −13 (entraram na allowlist) |
| Allowlist entries | 0 | 15 | +15 |

## Descoberta arquitetural crítica

Durante a Fase 3.5 confirmamos via `lovable_get_integrations` o **motivo real do app ficar "preso" no Lovable Cloud mesmo com `src/integrations/supabase/client.ts` apontando para o Oficial**:

```json
"supabase": {
  "supabase_organization_id": "wpczgwxsriezaubncuom",
  "supabase_project_id": "pqpdolkaeqlyzpdpbizo",
  "publishable_key": "...",
  "is_managed_by_lovable": true
}
```

O Lovable Cloud mantém uma **config de infra própria** (`supabase_project_id`) separada do código do repo. No build, ele **injeta essa config no bundle**, ignorando o `client.ts` do GitHub. Por isso o app continua escrevendo no `pqpdolkaeqlyzpdpbizo` mesmo após o ajuste no repo.

Implicação: o desbloqueio definitivo da migração do app para o Oficial **exige sair do Lovable Cloud** (ou desconectar o supabase gerenciado), não basta ajustar o `client.ts`.

## Tarefas executadas

### ✅ Wave 3.5.1 — Quick wins (frontend_telemetry + ip_access_control)

**Status**: DONE
**Migration oficial**: `20260522154700` (registrada em `schema_migrations`)
**Migration Lovable**: aplicada via `lovable_db_query` (doc em `20260522155000`)

| Coluna | Antes | Depois |
|---|---|---|
| `oficial.frontend_telemetry.duration_ms` | `numeric` | `double precision` |
| `oficial.ip_access_control.updated_at` | ausente | `timestamp with time zone DEFAULT now()` + trigger auto-update |
| `lovable.ip_access_control.metadata` | ausente | `jsonb DEFAULT '{}'` |

Pré-checks: 0 views/índices dependentes; 1016/10031 rows em `frontend_telemetry` (cast compatível); 0 rows em `ip_access_control`.

### ✅ Wave 3.5.2 — Integridade FK (favorite_items + favorite_lists)

**Status**: DONE (Lovable-only)
**Doc**: `20260522155000_align_wave_3_5_2_lovable_uuid_casts.sql`

Cast `text → uuid` em 3 colunas FK no Lovable, espelhando o tipo correto do Oficial:
- `favorite_items.product_id`, `favorite_items.variant_id`, `favorite_lists.client_id`

Recriou `idx_favorite_items_unique` substituindo o sentinel `''::text` por `'00000000-0000-0000-0000-000000000000'::uuid` (mesma semântica: trata NULL como "vazio" no constraint único).

Pré-checks: 0 rows em `favorite_items`, 1 row em `favorite_lists` (client_id já UUID-válido).

### ✅ Wave 3.5.3 — Enum compartilhado (ai_usage_quotas.role)

**Status**: DONE
**Migration oficial**: `20260522155300` (registrada em `schema_migrations`)

Achado: enums divergiam.
- **Lovable `app_role`**: `admin, manager, vendedor, supervisor, dev` (5 valores)
- **Oficial `app_role`**: superset com `agente` e `coordenador` adicionais (7 valores)

Ação dupla:
1. **Lovable**: `ALTER TYPE app_role ADD VALUE 'agente'; ALTER TYPE app_role ADD VALUE 'coordenador';`
2. **Oficial**: `ALTER TABLE ai_usage_quotas ALTER COLUMN role TYPE app_role USING role::app_role;`

Pré-validado: todos os 5 valores em uso real (`admin, agente, dev, manager, supervisor`) já existiam no enum oficial.

### ✅ Wave 3.5.4 — order_items (caso grave)

**Status**: DONE (Lovable-only)
**Doc**: `20260522155500_align_wave_3_5_4_lovable_order_items.sql`

`order_items` no Lovable estava com schema legado "kit consumidor"; no Oficial, schema B2B sério (orçamento → produção). 9 cols a dropar + 9 cols a adicionar + 1 cast.

| Tipo | Colunas |
|---|---|
| DROP (legacy Lovable) | `color_hex, color_name, gender, kit_group_id, kit_name, notes, organization_id, size_code, total_price` |
| CAST (FK) | `product_id text → uuid` |
| ADD (B2B do Oficial) | `discount_amount, personalization_config, personalization_cost, product_description, production_notes, production_status, quote_item_id, subtotal, updated_at` |
| TRIGGER | `set_updated_at BEFORE UPDATE` |

Pré-validado: 0 rows em Lovable.order_items, 0 dados nas 9 colunas a dropar. Refatoração destrutiva sem perda.

Pós-validação: signature 100% idêntica entre Lovable e Oficial.

### ✅ Wave 3.5.5 — Allowlist auditável

**Status**: DONE
**Migration oficial**: `20260522160000` (registrada em `schema_migrations`)

Nova tabela `public.schema_drift_allowlist` (admin-only via RLS) + atualização da `fn_compute_and_record_drift` para consultar allowlist em todas as 3 comparações (`only_oficial`, `only_lovable`, `schema_diff`).

15 entradas seedadas em 4 categorias:

| Categoria | Qtd | Exemplos |
|---|---:|---|
| `infra_independente` | 1 | `bot_detection_log` (impl. distinta no Lovable Cloud) |
| `cache_denormalizado` | 1 | `products` (cache local com `synced_at`, `external_id`) |
| `particao_log` | 9 | `admin_audit_log_y2025m12..y2026m06`, `webhook_delivery_metrics_y2026m05/06` |
| `infra_lovable` | 4 | `simulation_logs`, `simulation_runs`, `e2e_cleanup_audit`, `v_full_scope_grants` |

## Estado pós-execução (snapshot 16:09 UTC)

| Métrica | Pré-Fase-3.5 | Pós-Fase-3.5 |
|---|---:|---:|
| Tabelas Oficial | 389 | 390 |
| Tabelas Lovable | 145 | 145 |
| Only Oficial (catálogo SSOT) | 260 | 261 |
| Only Lovable (drift-removendo allowlist) | 16 | **3** |
| Schema drift | 8 | **0** ✅ |
| `has_drift` no Gate CI | true | true (apenas pelas 3 legacy abaixo) |
| Allowlist size | 0 | 15 |

## Pendências para próximas fases

### 🟡 Fase 1.1 — DROP legacy Lovable (continua PENDING)

As únicas 3 tabelas em `only_lovable` que ainda fazem o Gate CI mostrar `has_drift=true`:

1. `admin_audit_log_old` — substituída pelas partições mensais
2. `favorites` — substituída por `favorite_lists` + `favorite_items`
3. `mcp_keys` — substituída pelo novo sistema de credenciais

Quando dropadas via Lovable MCP, o Gate CI vira `has_drift=false` (verde total).

### 🔴 PR no app (bloqueio real)

O `src/integrations/supabase/client.ts` no `main` já aponta para o Oficial, mas o Lovable Cloud reescreve a config de infra no build. Para desbloquear a migração definitiva do app:

- **Opção A**: sair do Lovable Cloud (self-deploy via Vercel/Netlify) — mantém o `client.ts` apontando pro Oficial
- **Opção B**: reconectar o Lovable Cloud ao Oficial (mudar `supabase_project_id` na config Lovable) — exige permissão na config interna do Lovable
- **Opção C**: aceitar dois Supabase em paralelo (Lovable interno como cache/runtime, Oficial como SSOT) — requer sync ativo

## Lições aprendidas

1. **`is_managed_by_lovable: true`** é a fonte da verdade sobre quem manda no `client.ts` em runtime — Lovable Cloud, não o repo.
2. Pré-checks de row count + dependências (views/índices/policies) antes de qualquer `ALTER TYPE` são obrigatórios e evitam quase 100% das surpresas.
3. Allowlist auditável (em tabela RLS-protegida) é melhor que regex no código da função: dá history (`added_by`, `added_at`, `reason`), permite enforcement via admin only, e o Gate CI gera contagem precisa.

## Commits relacionados

- Wave 3.5.1: `e5b1e2db` (oficial migration)
- Wave 3.5.2: `27036bdb` (Lovable doc)
- Wave 3.5.3: `6dfaf163` (oficial migration)
- Wave 3.5.4: `e4807983` (Lovable doc)
- Wave 3.5.5: `89d1d3dc` (oficial migration + allowlist seed)
