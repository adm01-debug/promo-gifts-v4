# 🚩 FLAG — Faxina arquivando tabelas com `.from()` vivo (falsos-positivos) + código morto a limpar

**Data:** 2026-06-21 · **Origem:** auditoria cruzada `archive.*` × `.from('...')` no frontend
(disparada após o bug do `admin_settings`).

## 1. Causa sistêmica (corrigir o gate da Faxina)
O loop de faxina arquivou tabelas que **têm referência `.from('<tabela>')` viva em `src/`**,
sem regenerar `types.ts`. Resultado: o contrato (`types.ts`) afirma `public`, a tabela está
em `archive` → **404 silencioso em runtime**. Hoje (21/06) houve um vai-e-vem
archive→restore→re-archive (ver migrations `2026062110*`–`2026062123*`).

**Já restaurados em lote (opção B):** 18 tabelas — ver
`20260621235500_faxina_restore_18_frontend_referenced_tables_APLICADO.sql`.

**Ação recomendada (trava que faltou):** antes de arquivar QUALQUER tabela, o scan deve
verificar (a) `grep -RE "\.from\(['\"]<nome>['\"]" src/` **e** (b) presença em
`src/integrations/supabase/types.ts`. Se houver match, **não arquivar** (ou marcar como
exceção). Idealmente, adicionar essas 18 ao allowlist do scan para não voltarem.

## 2. `companies` — decidir (restaurar OU remover código morto)
- Continua em `archive`; referenciada em `src/lib/pdf/whitelabel-comparison.ts:19` `.from('companies')`.
- **Fora de `types.ts`** → a chamada provavelmente está com cast (`as any`) / é código morto.
- **Decisão necessária:** se o PDF white-label é feature viva → restaurar `companies`
  (mesmo padrão das 18). Se foi aposentado → remover o código em `whitelabel-comparison.ts`.

## 3. Clusters restaurados como correção de contrato — confirmar vivo × aposentado
As 18 foram restauradas para corrigir o contrato (tabela órfã em `public` é inócua). Mas,
se alguma destas *features* foi aposentada de propósito, o certo é **remover o código do
frontend + re-arquivar a tabela** (e pôr no allowlist do scan). Confirmar com o produto:

| Cluster | Tabelas | Onde |
|---|---|---|
| Mockup | `generated_mockups`, `mockup_drafts`, `mockup_prompt_configs`, `art_file_attachments`, `component_media` | `MockupHistoryPage`, `useMockupDraft`, `ArtFileUpload`, admin `MockupPromptManager` |
| Magic-Up | `magic_up_generations`, `magic_up_brand_kits`, `magic_up_campaigns` | `useMagicUpState`, `useMagicUpGeneration` |
| Collections trash | `collection_items_trash` | `CollectionsTrashView` (usa cast `as never` — sinal de feature meio-desativada) |
| Visual Search | `visual_search_feedback` | `VisualSearchPage` (tool) |
| Dashboards admin | `ai_usage_events`, `file_scan_logs`, `hardening_health_snapshots`, `product_sync_logs`, `product_price_freshness_overrides` | painéis admin |
| Personalização/grupos | `product_group_members`, `product_component_locations` | personalization-manager, quotes |
| Cart templates | `cart_templates` | `useCartTemplates` |

> **Não é regressão:** `notifications` e `device_login_notifications` já foram restauradas
> na `20260621230000` (realtime de `usePushNotifications`) — nenhuma ação.

## 4. Observação de grants (dívida menor)
Os 6 re-grants usaram template genérico (`authenticated` CRUD + `anon` SELECT). Auditado:
anon → 0 linhas em todas (RLS). Para alinhar à postura do projeto (ex.: `REVOKE anon` em
tabelas admin como na `230000`), pode-se endurecer `product_sync_logs` /
`product_price_freshness_overrides` revogando `anon` — opcional, sem impacto funcional.
