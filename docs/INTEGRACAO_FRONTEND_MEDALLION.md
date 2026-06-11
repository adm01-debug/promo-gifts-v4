# Integração Frontend ↔ Arquitetura Medallion (Bronze → Prata → Ouro)

> **Documento irmão:** `docs/INTEGRACAO_MEDALLION_FRONT.md` (PR #721) cobre o
> hardening do CONTRATO PÚBLICO das views Gold (M1–M6: filtro `is_active`,
> preço de venda em `v_variant_sale_prices_public`/`v_products_min_price`,
> DEFINER em `v_print_area_techniques_public`, P0 `mcp_sessions`, REVOKE de
> escrita em Bronze/Prata). Este documento cobre a outra metade: aliases de
> leitura, ACLs de RPCs admin, realtime, relações fantasma e observabilidade.

_Auditoria exaustiva e integração executadas em 2026-06-11 contra o SSOT
`doufsxqlfjyuvxuezpln` (PR desta data). Metodologia: extração de TODAS as
relações/RPCs referenciadas em `src/` e `supabase/functions/` (via `.from()`,
`untypedFrom()`, `dbInvoke`, `.rpc()`) e diff contra `pg_class`,
`information_schema.role_table_grants`, `information_schema.column_privileges`,
`pg_proc` e `pg_publication_rel` do banco vivo._

## 1. O contrato de camadas

```
🟤 BRONZE  supplier_products_raw (+ _history particionada)   ← ingest (n8n/cron)
              │  fn_standardize_supplier()  (de-para supplier_field_mappings)
⚪ PRATA   produtos_padronizacao + produtos_padronizacao_variantes
              │  fn_promote_supplier() / fn_promote_variants_of_parent()
🟡 OURO    products / product_variants / variant_supplier_sources
              │  views de segurança e agregação
FRONTEND   v_products_public · v_suppliers_public · v_variant_sale_prices_public
           v_product_images_cdn · v_products_min_price · v_print_area_techniques_public
           vw_medallion_coverage · v_pipeline_progress (observabilidade)
```

**Regra de ouro:** o frontend lê SOMENTE a camada Ouro. Bronze e Prata são
território exclusivo do pipeline (cron `process_pending_batches`).
Codificada em `src/integrations/supabase/gold-relations.ts` e garantida pelo
teste `tests/lib/gold-relations.test.ts`.

### Por que views e não as tabelas-base?

| Tabela-base | Situação real dos grants (verificada) | Leitura correta |
|---|---|---|
| `products` | grants **por coluna** para `anon` (p0_seguranca_02) → `select=*` falha | `v_products_public` |
| `suppliers` | sem grant de tabela; grants **por coluna** p/ `authenticated` em 40 colunas (oculta `api_credentials`) | `v_suppliers_public` p/ leitura genérica; colunas explícitas no admin |
| `print_area_techniques` | grants completos (admin lê/edita `unit_cost`) | base no admin (dbInvoke); `v_print_area_techniques_public` no catálogo (rest-native) |
| `product_variants`, `variant_supplier_sources` | legíveis (RLS) | direto (camada Ouro) |

## 2. Gaps encontrados e correções

### 2.1 Frontend → relações inexistentes no banco (erro 404/PGRST205 em runtime)

| Referência no código | Diagnóstico | Correção |
|---|---|---|
| `kit_component_media` (kit-components/api.ts, rest-native whitelist) | nome bridge-era; a tabela real é **`component_media`** (FK `component_id`) | call-sites e whitelists corrigidos |
| `device_login_notifications` (usePushNotifications realtime; edge `detect-new-device` INSERE nela) | tabela nunca existiu no SSOT — escrita E subscription mortas | **migration 183000** cria tabela + RLS select-own + realtime |
| `check_auth_config_status` (RPC em auth-audit.ts) | RPC não existe; código já degrada graciosamente e documenta a pendência | mantido (criar a RPC exige definição de semântica de auditoria — fora de escopo) |
| `webhook_events`, `system_error_logs`, `e2e_cleanup_audit`, `bitrix_deals` | referenciadas apenas em edge functions/testes, não no frontend | sem ação (fora do escopo frontend) |
| `customers`, `contacts`, `companies` | vivem no projeto CRM (via `crm-db-bridge`), não no SSOT | sem ação (caminho correto já é a bridge) |
| `simulation_runs` | só aparece no types.ts gerado (stale) | sem ação de runtime |
| `avatars` | bucket de Storage, não tabela | falso-positivo |
| `tpgo`/`tpgo_faixa` | apenas comentários | falso-positivo |
| `product_categories` | alias legacy documentado → `product_category_assignments` | já tratado |

### 2.2 Relações existentes, mas sem grant (permission denied silencioso)

| Objeto | Quem consome | Correção |
|---|---|---|
| `v_ai_function_routing_effective` (view criada sem NENHUM grant) | UI admin de roteamento de IA | **migration 183300** — GRANT SELECT a `authenticated` (view é `security_invoker=true` sobre tabelas já legíveis) |

### 2.3 RPCs admin com EXECUTE revogado no hardening (42501 na UI)

Todas com checagem de autorização **interna** (admin/dev) — reexposição segura
(**migration 183100**):

| RPC | Consumidor | Observação |
|---|---|---|
| `check_hardening_status()` | HardeningHealthCard | convertida a SECURITY DEFINER (lê `cron.job`/`storage.buckets`, inacessíveis ao invoker) + `search_path=''`; corpo 100% schema-qualificado (verificado) |
| `check_telemetry_regression()` | useRegressionGuardrail / useOptimizationQueue | já DEFINER c/ checagem; só grant |
| `lookup_request_id(text)` | useAppHealth | INVOKER c/ checagem admin/dev; tabelas-alvo legíveis |
| `execute_role_migration_batch(...)` | useRoleMigration | já DEFINER c/ checagem; só grant |

**Decisões deliberadas de NÃO reexpor:**

- `repair_ownership_orphans` — o teste de segurança do frontend
  (`src/utils/security-audit.ts`) **exige** permission denied para
  authenticated; execução real via edge `ownership-repair` (service_role).
- `sync_external_connections_from_credentials` — SECURITY DEFINER **sem
  checagem de chamador**. Ganhou wrapper admin-gated
  `fn_admin_sync_external_connections()` (**migration 183200**); o frontend
  (`LastSyncRunPanel`) passou a chamar o wrapper via
  `rpcAdminSyncExternalConnections()` e a original permanece trancada.

### 2.4 Realtime: subscriptions sem entrega

A publication `supabase_realtime` continha apenas `auth.users, notifications,
order_items, orders, quote_comments, quote_items, quotes,
variant_supplier_sources`. Subscriptions ativas no código que **nunca** recebiam
eventos:

| Tabela assinada | Hooks | Correção (migration 183000) |
|---|---|---|
| `workspace_notifications` | useWorkspaceNotifications, notificationService | adicionada à publication (RLS select-own já existia) |
| `device_login_notifications` | usePushNotifications | tabela criada + publication |
| `login_attempts` | usePushNotifications | adicionada à publication; RLS `can_view_audit_logs` faz eventos chegarem só a admin/dev (deliberado) |

Invariante preservada: as tabelas sensíveis monitoradas por
`check_hardening_status` (`discount_approval_requests`, `kit_variants`,
`kit_comments`) **continuam fora** da publication (`realtime_isolation_ok`).

### 2.5 Consistência de aliases entre os 3 caminhos de leitura

O frontend tem 3 caminhos para o PostgREST (`dbInvoke`/postgrest.ts,
`restNativeInvoke`/rest-native.ts, paginador do `stockFetcher.ts`), cada um com
sua cópia de aliases. Agora os aliases Ouro obrigatórios
(`products`/`suppliers` → views) vêm de **fonte única**
(`gold-relations.ts: GOLD_READ_ALIASES`). Correção de bug latente:
`dbInvokeDelete` resolvia aliases de LEITURA — um delete em `products` iria
para `v_products_public` (sem grant de DML). Deletes agora resolvem apenas
bridge-aliases e miram a tabela-base.

### 2.6 Tooling

- `scripts/audit-db-frontend-coverage.mjs` abortava (`rg` em `api/`
  inexistente). Corrigido com filtro `existsSync` — `npm run audit:db-frontend`
  volta a funcionar.
- Comentário do `COLUMN_MAP` em postgrest.ts referenciava verificação no
  projeto antigo `pqpdolkaeqlyzpdpbizo`; re-verificado e atualizado para o SSOT.

## 3. O que foi adicionado

| Artefato | Papel |
|---|---|
| `src/integrations/supabase/gold-relations.ts` | contratos puros da camada Ouro (10 relações tipadas coluna-a-coluna contra o banco vivo) + `GOLD_READ_ALIASES` |
| `src/integrations/supabase/gold.ts` | `goldFrom()` (builder restrito a relações Ouro) + `rpcAdminSyncExternalConnections()` |
| `src/hooks/admin/useMedallionHealth.ts` | react-query sobre `vw_medallion_coverage` + `v_pipeline_progress` |
| `src/components/system/MedallionPipelineCard.tsx` | card "Pipeline Medalhão" em `/system/status`: progresso por fase + cobertura por fornecedor/camada |
| `tests/lib/gold-relations.test.ts` | invariantes do contrato Ouro (inclui proibição de Bronze/Prata) |
| migrations `20260611183000…183300` | tabela+realtime, ACLs de RPCs admin, wrapper de sync, grant da view de roteamento |

## 4. Como validar

```bash
npm run test -- tests/lib/gold-relations.test.ts tests/lib/external-db-tables.test.ts
npm run lint            # baseline tsc
npm run audit:db-frontend
```

No banco (SQL editor):

```sql
-- realtime completo
select prrelid::regclass from pg_publication_rel
 where prpubid = (select oid from pg_publication where pubname='supabase_realtime');
-- ACLs restauradas
select proname, has_function_privilege('authenticated', oid, 'EXECUTE')
  from pg_proc where pronamespace='public'::regnamespace
  and proname in ('check_hardening_status','check_telemetry_regression',
                  'lookup_request_id','execute_role_migration_batch',
                  'fn_admin_sync_external_connections');
```

## 5. Pendências conhecidas (fora do escopo deste PR)

1. **types.ts**: o gerado está misto (tem `simulation_runs` fantasma; faltam
   `product_images`, `print_area_techniques`, `tecnicas_gravacao`…).
   Regenerar com `supabase gen types typescript --project-id doufsxqlfjyuvxuezpln`
   e migrar `untypedFrom()` → `supabase.from()` progressivamente
   (ver aviso em `src/lib/supabase-untyped.ts`).
2. **`check_auth_config_status`**: criar a RPC com semântica definida pelo time
   de segurança e remover o `@ts-expect-error` em `src/lib/auth/auth-audit.ts`.
3. **Grants largos em views `vw_*`**: várias views de observabilidade têm
   grants de DML para `anon` (inócuos em views agregadas, mas sujos). Sugerido
   um passe de `REVOKE ALL … GRANT SELECT` em lote.
