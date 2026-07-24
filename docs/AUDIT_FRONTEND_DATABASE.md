# Auditoria Técnica: Front-end ↔ Banco de Dados

> ⚠️ **SUPERSEDED (2026-05-31).** Este documento é histórico. O `project_id` abaixo
> (`nmojwpihnslkssljowjh`) está **desatualizado** — o projeto oficial atual é
> **`doufsxqlfjyuvxuezpln`** (ver `supabase/config.toml`). A nota de “falha de privilégio”
> do MCP também não se aplica mais (o acesso SQL funciona). Para a auditoria vigente, com
> dados do banco _live_ (299 tabelas, 295 FKs, 767 RLS policies), ver
> **`docs/AUDITORIA_DB_FRONTEND_2026-05-31.md`**.

**Projeto:** Promo_Gifts  
**Supabase project_id:** `nmojwpihnslkssljowjh`  
**Data da auditoria:** 2026-04-29  
**Ferramenta:** Claude Code (claude-sonnet-4-6)

> **Nota de escopo:** As ferramentas MCP Supabase de plataforma (`list_tables`, `get_advisors`, `execute_sql`, `list_migrations`) falharam com erro de privilégio (`Your account does not have the necessary privileges`). Toda a análise de banco foi realizada sobre os **arquivos de migration locais** (356 arquivos em `supabase/migrations/`). Os resultados refletem o estado declarativo das migrations; divergências pontuais do banco live não podem ser descartadas sem acesso direto.

---

## §1. Inventário do Acoplamento

### 1.1 Tabelas acessadas via `supabase.from()`

**Total: 68 tabelas únicas** (combinando aspas simples e duplas nos chamadores)

| # | Tabela | # | Tabela |
|---|--------|---|--------|
| 1 | `access_blocked_log` | 35 | `mcp_api_keys` |
| 2 | `access_security_settings` | 36 | `mockup_prompt_configs` |
| 3 | `admin_audit_log` | 37 | `mockup_prompt_history` |
| 4 | `art_file_attachments` | 38 | `notifications` |
| 5 | `audit_log` | 39 | `optimization_queue` |
| 6 | `bot_detection_log` | 40 | `order_items` |
| 7 | `cart_templates` | 41 | `orders` |
| 8 | `category_icons` | 42 | `outbound_webhooks` |
| 9 | `city_whitelist` | 43 | `permissions` |
| 10 | `collection_items` | 44 | `personalization_simulations` |
| 11 | `collection_items_trash` | 45 | `personalization_techniques` |
| 12 | `collections` | 46 | `product_components` |
| 13 | `component_media` | 47 | `product_group_members` |
| 14 | `custom_kits` | 48 | `product_groups` |
| 15 | `expert_conversations` | 49 | `product_views` |
| 16 | `external_connections` | 50 | `products` |
| 17 | `favorite_items` | 51 | `profiles` |
| 18 | `favorite_items_trash` | 52 | `query_telemetry` |
| 19 | `favorite_lists` | 53 | `quote_approval_tokens` |
| 20 | `generated_mockups` | 54 | `quote_comments` |
| 21 | `inbound_webhook_endpoints` | 55 | `quote_history` |
| 22 | `ip_access_control` | 56 | `quote_item_personalizations` |
| 23 | `ip_whitelist` | 57 | `quote_items` |
| 24 | `kit_collaborators` | 58 | `quote_templates` |
| 25 | `kit_comments` | 59 | `quotes` |
| 26 | `kit_templates` | 60 | `request_rate_limits` |
| 27 | `kit_variants` | 61 | `role_permissions` |
| 28 | `login_attempts` | 62 | `roles` |
| 29 | `magic_up_brand_kits` | 63 | `sales_goals` |
| 30 | `magic_up_campaigns` | 64 | `search_analytics` |
| 31 | `magic_up_generations` | 65 | `secret_rotation_log` |
| 32 | `magic_up_generations` | 66 | `seller_cart_items` |
| 33 | `magic_up_prompt_configs` | 67 | `user_passkeys` |
| 34 | `magic_up_prompt_history` | 68 | `video_variant_links` |
|   |                           | 69 | `voice_command_logs` |
|   |                           | 70 | `webhook_deliveries` |
|   |                           | 71 | `workspace_notifications` |

### 1.2 Edge Functions invocadas

**Total: 86 funções deployadas, 28 invocadas do front-end**

| Edge Function | Arquivo(s) chamador:linha |
|---|---|
| `external-db-bridge` | `useTecnicasList.ts:88,201,228`, `usePrintAreas.ts:28,74,139,164,191`, `useColorSystem.ts:44,62,183`, `useExternalSimulator.ts:97`, `useTechniquePricingOptions.ts:55,195`, `useTechniquePricing.ts:52`, `useProdutoRamoAtividade.ts:20`, `useExternalCategoriesQuery.ts:38`, `stock/stockFetcher.ts:95`, `useProductSupplierSources.ts:32`, `useCategoriesTree.ts:73`, `useProductsByCategory.ts:68,134`, `PublicFavoriteListPage.tsx:79`, `DiscontinuedItemsAlert.tsx:27` |
| `connection-tester` | `useConnectionTester.ts:64,121`, `useConsecutiveFailures.ts:33`, `useConnectionTestHistory.ts:47`, `useConnectionTestDetails.ts:54` |
| `sync-quote-bitrix` | `QuoteActionHandlers.ts:117`, `QuoteBitrixSync.ts:91` |
| `generate-mockup` | `mockupGenerationService.ts:174,210` |
| `step-up-verify` | `useStepUpAuth.ts:62,81,103,131` |
| `secrets-manager` | `useSecretsManager.ts:87` |
| `log-login-attempt` | `AuthContext.tsx:310`, `useIPValidation.ts:139` |
| `external-db-inspect` | `AdminExternalDbPage.tsx:77`, `useExternalDbInspect.ts:33` |
| `categories-api` | `useProductsByCategory.ts:68,134` |
| `generate-ad-image` | `useMagicUpGeneration.ts:80` |
| `commemorative-dates` | `useCommemorativeDates.ts:60` |
| `detect-new-device` | `useDeviceDetection.ts:94` |
| `dropbox-list` | `useDropboxFiles.ts:29,44` |
| `external-db-bridge` | `PublicFavoriteListPage.tsx:79` |
| `get-visitor-info` | `Auth.tsx:44` |
| `kit-identity-suggest` | `useKitIdentitySuggestion.ts:31` |
| `kit-ai-builder` | `KitAIPromptDialog.tsx:40` |
| `validate-access` | `useIPValidation.ts:64` |
| `analyze-logo-colors` | `useLogoColorAnalysis.ts:44` |
| `generate-product-seo` | `useProductSeoAI.ts:45` |
| `elevenlabs-scribe-token` | `voice/scribeTokenCache.ts:43` |
| `quote-sync` | `useQuotes.ts:268,289` |
| `ownership-audit` | `OwnershipAuditAdminPage.tsx:79` |
| `mcp-keys-update` | `DevChallengeExamplesPage.tsx:152` |
| `send-transactional-email` | `useTransactionalEmail.ts:21` |
| `send-digest` | *(agendado, sem invoke direto do front)* |
| `send-scheduled-reports` | *(agendado)* |

### 1.3 RPCs (`supabase.rpc()`)

**Total: 35 RPCs únicos chamados do front-end**

| RPC | Arquivo chamador |
|---|---|
| `submit_quote_response` | `QuoteApprovalPage.tsx:52` |
| `get_app_health_summary` | `useAppHealth.ts:65` |
| `lookup_request_id` | `useAppHealth.ts:98` |
| `enqueue_optimization` | `useOptimizationQueue.ts:77` |
| `reset_optimization_queue` | `useOptimizationQueue.ts:104` |
| `claim_next_optimization` | `useOptimizationQueue.ts:115` |
| `check_telemetry_regression` | `useOptimizationQueue.ts:130`, `useRegressionGuardrail.ts:50` |
| `complete_optimization` | `useOptimizationQueue.ts:143` |
| `get_platform_failure_metrics` | `usePlatformFailureMetrics.ts:36` |
| `get_top_favorited_products` | `FavoritesEmptyStateSmart.tsx:24` |
| `ensure_default_favorite_list` | `useFavoriteLists.ts:59` |
| `check_ai_quota` | `useAiUsage.ts:47` |
| `get_collections_weekly_count` | `CollectionsHeatmap.tsx:18` |
| `get_top_collected_products` | `CollectionsEmptyStateSmart.tsx:24` |
| `get_favorites_weekly_count` | `FavoritesHeatmap.tsx:19` |
| `get_industry_top_products` | `useIndustryCategoryTrends.ts:110`, `useIndustryTrends.ts:88`, `ClientLookalikes.tsx:76` |
| `get_client_top_products` | `useClientAffinity.ts:95`, `useClientCategoryAffinity.ts:101` |
| `get_industry_benchmark_stats` | `useClientVsIndustry.ts:121` |
| `get_quote_token_by_value` | `useQuoteApprovalToken.ts:12` |
| `check_hardening_status` | `HardeningHealthCard.tsx:33` |
| `can_grant_mcp_full` | `useCanGrantMcpFull.ts:22` |
| `sync_external_connections_from_credentials` | `LastSyncRunPanel.tsx:64` |
| `get_connections_auto_test_interval` | `AutoTestIntervalCard.tsx:30` |
| `set_connections_auto_test_interval` | `AutoTestIntervalCard.tsx:50` |
| `get_auto_test_job_status` | `AutoTestJobStatusCard.tsx:47` |
| `get_connection_failure_window_minutes` | `FailureWindowCard.tsx:29` |
| `set_connection_failure_window_minutes` | `FailureWindowCard.tsx:49` |
| `execute_role_migration_batch` | `useRoleMigration.ts:81` |
| `get_user_recent_comparisons` | `RecentComparisonsSidebar.tsx:35` |
| `get_top_compared_products` | `CompareEmptyStateSmart.tsx:27` |
| `get_bundle_suggestions` | `BundleSuggestions.tsx:64` |
| `search_records_rerank` | `useGlobalSearch.ts:499` |
| `record_dev_route_telemetry` | `dev-route-telemetry.ts:59` |
| `log_rls_denial` | `rls-denial-logger.ts:49` |
| `record_platform_failure` | `bridge-telemetry-client.ts:60` |

### 1.4 Subscriptions Realtime

6 arquivos com subscriptions `postgres_changes`:

| Tabela | Filtro | Arquivo |
|---|---|---|
| `kit_comments` | `kit_id=eq.${kitId}` | `useKitCollaboration.ts:107` |
| `notifications` | `user_id=eq.${user.id}` | `usePushNotifications.tsx:103` |
| `device_login_notifications` | `user_id=eq.${user.id}` | `usePushNotifications.tsx:127` |
| `login_attempts` | `user_id=eq.${user.id}` | `usePushNotifications.tsx:148` |
| `custom_kits` | `user_id=eq.${user.id}` | `useCustomKitsRealtime.ts:21` |
| `discount_approval_requests` | *(sem filtro de usuário)* | `DiscountApprovalHeaderBadge.tsx:39` |
| `integration_credentials` | *(sem filtro — apenas admin)* | `CredentialsChangedBanner.tsx:40` |
| `product_views` | INSERT genérico (só dispara UI refresh) | `RealtimeBadge.tsx:19` |
| `search_analytics` | INSERT genérico (só dispara UI refresh) | `RealtimeBadge.tsx:22` |

> **Nota:** `integration_credentials` e `discount_approval_requests` não têm filtro `filter:` na subscription. Supabase Realtime aplica RLS sobre os eventos, mas é boa prática adicionar filtro explícito para evitar carga desnecessária no canal e para documentar a intenção.

### 1.5 Buckets de Storage

**Total: 7 buckets acessados**

| Bucket | Operações | Arquivo(s) |
|---|---|---|
| `art-files` | `getPublicUrl` | `QuoteBitrixSync.ts:84`, `QuoteActionHandlers.ts:110` |
| `supplier-logos` | `upload`, `getPublicUrl` | `useSuppliersManager.ts:327,329`, `useNewSupplierForm.ts:171,173` |
| `personalization-images` | `upload`, `getPublicUrl`, `remove` | `useProductImageGallery.ts:173,175,182`, `ImageUploadButton.tsx:119` |
| `avatars` | `upload`, `getPublicUrl` | `useUserManagement.ts:148,150` |
| `product-videos` | `upload`, `getPublicUrl` | `useProductVideoGallery.ts:152,154,161,163,318,320` |
| `mockup-art-files` | `remove` | `ArtFileUpload.tsx:124,153` |

> A migration `20260427211500` define limite de 5 MB e tipos MIME restritos nos buckets existentes. Migration `20260427213920` força `public = false` em todos os buckets. Configuração de storage está alinhada.

---

## §2. Consistência de Tipos

### 2.1 Tabelas usadas no front-end AUSENTES do `types.ts`

Estas tabelas são acessadas diretamente via `supabase.from()` mas **não** possuem entrada na seção `Tables` de `src/integrations/supabase/types.ts`. Queries sobre elas não têm checagem de tipo em compile time — qualquer coluna errada falha silenciosamente em runtime.

| Tabela | Existe em migrations? | Local de acesso no front |
|---|---|---|
| `access_blocked_log` | ✅ `20260220001443_*.sql` | `src/hooks/useGeoBlocking.ts` |
| `access_security_settings` | ✅ `20260220001443_*.sql` | `src/hooks/useAccessSecurity.ts` |
| `audit_log` | ✅ `20260109202835_*.sql` | `src/hooks/useAuditLog.ts` |
| `city_whitelist` | ✅ `20260220001443_*.sql` | `src/hooks/useGeoBlocking.ts` |
| `ip_whitelist` | ✅ `20260220001443_*.sql` | `src/hooks/useAllowedIPs.ts` |
| `notifications` | ✅ `20251220140213_*.sql` | `src/components/security/useSecurityData.ts:73` |
| `personalization_simulations` | ✅ `20251214212212_*.sql` | `src/hooks/` |
| `personalization_techniques` | ✅ `20251214194907_*.sql` | `src/hooks/usePersonalizacao.ts` |
| `products` | ✅ `20250102000000_gifts_production.sql` | `PublicComparisonPage.tsx:86`, `PublicCollectionPage.tsx:101`, `mockupGenerationService.ts:109` |
| `roles` | ✅ `20251231023800_*.sql` | `src/pages/RolesPage.tsx:39` |
| `sales_goals` | ✅ `20251220181321_*.sql` | `src/hooks/useSalesGoals.ts` |
| `user_passkeys` | ✅ `20251231124614_*.sql` | `src/hooks/useWebAuthn.ts` |

**12 tabelas com gap de tipos** — todas existem no banco mas o types.ts está desatualizado (gerado antes dessas tabelas serem adicionadas).

### 2.2 Tabelas em `types.ts` NÃO usadas diretamente no front-end

52 tabelas declaradas em types.ts mas sem chamadas `supabase.from()` correspondentes no código React/TS. Estas são majoritariamente:
- Tabelas de infraestrutura operacional (acessadas via edge functions ou service_role)
- Tabelas de auditoria/telemetria (escritas pelo backend, lidas por painéis admin via RPC)
- Tabelas de estados de fluxo internos

Amostra representativa:

| Grupo | Tabelas |
|---|---|
| AI/Insights | `ai_insights_cache`, `ai_usage_events`, `ai_usage_logs`, `ai_usage_quotas` |
| Organizações | `organization_members`, `organizations` |
| MFA/Segurança | `step_up_challenges`, `step_up_tokens`, `step_up_audit_log` |
| Role Migration | `role_migration_batches`, `role_migration_items` |
| Webhooks | `inbound_webhook_events`, `webhook_delivery_metrics` |
| Mockup | `mockup_drafts`, `mockup_templates` |
| Financeiro | `price_history`, `seller_carts`, `seller_discount_limits` |
| Ownership | `ownership_audit_reports`, `ownership_repair_logs` |

> Estas tabelas **não** representam dead-code no banco — são acessadas internamente. A ausência de chamadas diretas do front é esperada e correta para dado sensível.

### 2.3 Divergências de colunas identificadas

Sem acesso direto ao banco live, não é possível fazer uma comparação coluna-a-coluna automatizada. As divergências abaixo foram identificadas cruzando as migrations mais recentes com o types.ts:

| Tabela | Coluna | Em types.ts | Nas migrations | Risco |
|---|---|---|---|---|
| `quotes` | `products` | `Json` | JSONB legado — campo substituído por `quote_items` | Tipo correto, mas uso pode ser dual-mode |
| `profiles` | `role_id` | Ausente | Adicionado em `20251231023800` | Queries em `profiles` sem `role_id` podem falhar |
| `products` | *(toda tabela)* | Ausente em Tables | Definida em `20250102000000` | Sem type safety para nenhuma coluna |
| `notifications` | *(toda tabela)* | Ausente em Tables | Definida em `20251220140213` | Sem type safety |

---

## §3. Segurança / RLS

> **Metodologia:** Análise das migrations por ordem cronológica para determinar o estado final das policies. Supabase aplica permissive policies com lógica OR — uma policy `USING (true)` invalida qualquer policy mais restritiva na mesma tabela para o mesmo comando.

### 🔴 CRÍTICO — C1: Policies "Allow all" nunca removidas em tabelas core

**Arquivo:** `supabase/migrations/20250102000000_gifts_production.sql:87-90`

```sql
CREATE POLICY "Allow all" ON public.categories FOR ALL USING (true);
CREATE POLICY "Allow all" ON public.suppliers FOR ALL USING (true);
CREATE POLICY "Allow all" ON public.products FOR ALL USING (true);
CREATE POLICY "Allow all" ON public.quotes FOR ALL USING (true);
```

Migrations posteriores (`20250103_02_rls_organizations.sql`, `20250103_rls_no_gamification.sql`, `20251214194907_*.sql`) adicionam policies mais restritivas para estas tabelas, **mas nunca executam `DROP POLICY "Allow all"`**. Em PostgreSQL com `PERMISSIVE` (padrão), múltiplas policies são avaliadas com OR — a policy `USING (true)` vence.

**Impacto:**
- Qualquer usuário, **incluindo anônimos sem autenticação**, pode fazer SELECT, INSERT, UPDATE e DELETE nessas 4 tabelas.
- `quotes` contém PII de clientes: `client_name`, `client_email`, `client_phone`, `client_company`.
- `suppliers` contém CNPJ, dados financeiros e de contato de fornecedores.
- `products` contém precificação e dados comerciais sensíveis.

**Verificação sugerida:**
```sql
SELECT policyname, cmd, qual FROM pg_policies
WHERE tablename IN ('products', 'categories', 'suppliers', 'quotes')
  AND schemaname = 'public'
ORDER BY tablename, policyname;
```

---

### 🔴 CRÍTICO — C2: `audit_trail` totalmente público (SELECT anon)

**Arquivo:** `supabase/migrations/20251228_audit_trail.sql:18`

```sql
CREATE POLICY "Users can view audit_trail"
  ON audit_trail FOR SELECT
  USING (true);
```

Sem restrição de role (`TO authenticated`). Qualquer usuário anônimo pode ler o log de auditoria. A tabela tem RLS ativo mas sem nenhuma column de dados além de `id`/`created_at`/`updated_at` na migration original — risco depende de se a tabela foi populada com campos sensíveis via ALTER TABLE posterior.

---

### 🔴 CRÍTICO — C3: `order_items` — política SELECT aberta para qualquer autenticado

**Arquivo:** `supabase/migrations/20260305220938_*.sql:86`

```sql
CREATE POLICY "Authenticated users can read order items"
ON public.order_items FOR SELECT TO authenticated USING (true);
```

Qualquer usuário autenticado (independentemente de role) pode ler todos os `order_items` de todos os pedidos de todos os clientes. Isso viola o princípio de menor privilégio — vendedores não devem ver pedidos de outros vendedores.

---

### 🟡 ATENÇÃO — A1: `product_groups` e `product_group_members` — SELECT aberto para qualquer autenticado

**Arquivo:** `supabase/migrations/20260305220938_*.sql:41,54`

```sql
CREATE POLICY "Authenticated users can read groups" ON public.product_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read members" ON public.product_group_members FOR SELECT TO authenticated USING (true);
```

Aceitável se dados não são sensíveis (agrupamentos de catálogo), mas merecem revisão caso existam grupos privados ou de pricing.

---

### 🟡 ATENÇÃO — A2: `product_components` — SELECT aberto para qualquer autenticado

**Arquivo:** `supabase/migrations/20260305220938_*.sql:70`

```sql
CREATE POLICY "Authenticated users can read components" ON public.product_components FOR SELECT TO authenticated USING (true);
```

Mesma classificação que A1.

---

### 🟡 ATENÇÃO — A3: `integration_credentials` — subscription Realtime sem filtro

**Arquivo:** `src/components/admin/connections/CredentialsChangedBanner.tsx:40`

```ts
{ event: "*", schema: "public", table: "integration_credentials" }
```

A subscription recebe TODOS os eventos de credentials sem filtro. A RLS bloqueia acesso a não-admins, mas o canal sem filtro aumenta a superfície de tráfego e expõe o payload completo (incluindo `secret_value`, `masked_suffix`) a qualquer admin logado via canal Realtime. Credenciais armazenadas em texto semi-claro na tabela são um risco latente.

---

### 🟡 ATENÇÃO — A4: `discount_approval_requests` — subscription sem filtro por usuário

**Arquivo:** `src/components/admin/DiscountApprovalHeaderBadge.tsx:39`

Subscription sem `filter:` captura eventos de aprovações de discount de todos os usuários. Verificar se RLS da tabela restringe adequadamente o payload por organização.

---

### 🟡 ATENÇÃO — A5: `product_price_freshness_overrides` — SELECT aberto para qualquer autenticado

**Arquivo:** `supabase/migrations/20260424110636_*.sql:23`

```sql
CREATE POLICY "Authenticated can read freshness overrides"
  ON public.product_price_freshness_overrides FOR SELECT TO authenticated USING (true);
```

Expõe configuração de janela de validade de preços para qualquer usuário autenticado. Dependendo da confidencialidade da estratégia de pricing, pode ser impróprio.

---

### ✅ BOM — Tabelas com RLS bem configurado

| Tabela | Política | Observação |
|---|---|---|
| `integration_credentials` | Admin-only | Correto |
| `sales_goals` | `user_id = auth.uid()` | Correto |
| `mcp_api_keys` | RLS habilitado | Verificar policies em detalhes |
| `login_attempts` | INSERT: `service_role` only | Correto após `20260323164400` |
| `organizations`, `organization_members` | `get_user_org_ids()` | Corretamente escopado |
| `custom_kits`, `kit_comments` | `user_id` scoped | Correto |
| `magic_up_*` | RLS habilitado | Correto |
| `step_up_tokens` | RLS habilitado | Correto |
| `query_telemetry` | RLS habilitado via `20260314133410` | Verificar policies |

---

## §4. Padrões de Acesso (Qualidade de Código)

### 4.1 React Query — estatísticas gerais

| Métrica | Valor |
|---|---|
| Arquivos em `src/hooks/` usando `useQuery` | **91** |
| Arquivos em `src/hooks/` usando `useMutation` | **26** |
| Arquivos com `staleTime` configurado | **~30** (~33%) |
| Arquivos `useQuery` com `onError`/`isError` tratado | **24** (~26%) |

**Problema:** ~67% dos hooks `useQuery` usam `staleTime` padrão (0ms), o que causa refetch a cada montagem do componente. Em tabelas acessadas frequentemente (`quotes`, `collections`, `orders`), isso gera carga desnecessária.

### 4.2 `queryKey` — consistência

**Padrão inconsistente:** Parte dos hooks usa constantes nomeadas:
```ts
const QUERY_KEY = 'external-collections';
queryKey: [QUERY_KEY, 'products', collectionId]
```

Outros usam strings inline sem namespace:
```ts
queryKey: ['print-areas', productId]
queryKey: ['technique-stats']
```

Colisões de queryKey são possíveis entre hooks que usam nomes genéricos não namespaceados. Não foram encontradas colisões diretas, mas a ausência de convenção cria risco futuro.

### 4.3 Erros silenciados

Encontrados 6 padrões `.catch(() => {})` — 4 são aceitáveis (log de auditoria best-effort e audio), 2 merecem atenção:

| Arquivo | Linha | Contexto | Risco |
|---|---|---|---|
| `QuoteActionHandlers.ts:97` | `logQuoteHistory(...).catch(() => {})` | Falha silenciosa no log de auditoria de sync Bitrix | 🟡 Médio — auditoria perdida sem aviso |
| `QuoteBitrixSync.ts:68` | `logQuoteHistory(...).catch(() => {})` | Idem | 🟡 Médio |
| `AuthContext.tsx:320` | `supabase.functions.invoke('log-login-attempt').catch(() => {})` | Log de tentativa de login pode ser perdido | 🟡 Médio |
| `AuthContext.tsx:338` | `resetPrewarmSession().catch(() => {})` | Operação de cleanup — aceitável | ✅ Baixo |
| `feedbackSounds.ts:13` | `audioCtx.resume().catch(() => {})` | Audio — aceitável | ✅ Baixo |
| `playTtsAudio.ts:203` | `audio.play().catch(() => {})` | Audio — aceitável | ✅ Baixo |

### 4.4 `select('*')` em tabelas grandes — Top 5 piores

| # | Arquivo | Tabela | Limitação | Problema |
|---|---|---|---|---|
| 1 | `src/hooks/useQuotes.ts:~60` | `quotes` | `.limit(500)` | 500 quotes com PII carregadas na memória do browser; `select('*')` traz todas as colunas incluindo dados sensíveis desnecessários para listagens |
| 2 | `src/pages/admin/AdminSegurancaAcessoPage.tsx:88` | `bot_detection_log` | `.limit(200)` | 200 registros de log de bot sem seleção de colunas |
| 3 | `src/pages/admin/AdminSegurancaAcessoPage.tsx:89` | `request_rate_limits` | `.limit(100)` | Rate limits sem seleção de colunas |
| 4 | `src/hooks/useAccessSecurity.ts` | `access_security_settings` | Sem limit visível | `select('*')` sem limit explícito em tabela de configurações |
| 5 | `src/hooks/useQuoteTemplates.ts` | `quote_templates` | Múltiplos `select("*")` | 4 queries distintas com `select('*')` no mesmo hook |

### 4.5 Falta de tratamento de `error` em `useQuery`

~74% dos hooks com `useQuery` não expõem `isError` nem têm `onError` configurado. Exemplos representativos onde o componente consumidor não mostra estado de erro:

- `src/hooks/useColorSystem.ts` — falha silenciosa nas cores do sistema
- `src/hooks/useSupplierTrust.ts` — sem toast/UI de erro
- `src/hooks/useCategories.ts` — sem UI de erro para categorias

---

## §5. Estado de Integridade do Schema

### 5.1 Histórico de migrations

| Métrica | Valor |
|---|---|
| Total de migrations | **356** |
| Mais antiga | `001_notification_system.sql` |
| Mais recente | `20260428140401_*.sql` |
| Migrations nos últimos 3 dias (26-28 Abr/2026) | **25** |
| Formato antigo (numerado `001-009`) | **9** |
| Formato UUID (Supabase CLI) | **347** |

**Observação:** Ritmo elevado de migrations recentes (múltiplas por dia) indica desenvolvimento ativo. As migrations mais recentes focam em:
- Hardening de RLS (múltiplas iterações)
- Segurança de buckets de Storage (todos tornados privados)
- `file_scan_logs` para antivírus em uploads
- Restauração de GRANT EXECUTE para RPCs usadas em políticas de RLS

### 5.2 Últimas 20 migrations (por data)

| Arquivo | Conteúdo resumido |
|---|---|
| `20260426130639_*.sql` | *(ver arquivo)* |
| `20260426130701_*.sql` | *(ver arquivo)* |
| `20260426131442_*.sql` | *(ver arquivo)* |
| `20260426134439_*.sql` | *(ver arquivo)* |
| `20260426134707_*.sql` | *(ver arquivo)* |
| `20260426135145_*.sql` | *(ver arquivo)* |
| `20260426135521_*.sql` | *(ver arquivo)* |
| `20260426142016_*.sql` | *(ver arquivo)* |
| `20260426142609_*.sql` | *(ver arquivo)* |
| `20260426145642_*.sql` | *(ver arquivo)* |
| `20260426200011_*.sql` | *(ver arquivo)* |
| `20260426200348_*.sql` | *(ver arquivo)* |
| `20260426224900_*.sql` | *(ver arquivo)* |
| `20260427114657_*.sql` | Hardening: `e2e_cleanup_rate_limit` deny all para anon/authenticated |
| `20260427115542_*.sql` | *(ver arquivo)* |
| `20260427121006_*.sql` | Hardening: deny explícito em `e2e_cleanup_rate_limit` |
| `20260427122230_*.sql` | Observability: `webhook_delivery_metrics` + agregador 4xx/5xx |
| `20260427143410_*.sql` | Dashboard saúde: RPCs `get_app_health_summary` etc. |
| `20260427211500_*.sql` | Storage: limites 5MB, MIME types restritos |
| `20260427212820_*.sql` | Bucket `quarantine` criado |
| `20260427213016_*.sql` | `file_scan_logs` para antivírus |
| `20260427213631_*.sql` | Bucket `personalization-images` configurado privado |
| `20260427213832_*.sql` | Quarantine privado, policy de acesso restrito |
| `20260427213920_*.sql` | Força `public = false` em TODOS os buckets |
| `20260428140401_*.sql` | Restaura GRANT EXECUTE para `get_user_org_ids`, `is_supervisor_or_above` |

### 5.3 Alertas de performance (análise via migrations)

Sem acesso ao `get_advisors(type='performance')` do MCP, os alertas abaixo são inferidos da análise do código:

| Tabela | Índice ausente / coluna usada em filtro | Observação |
|---|---|---|
| `quotes` | `organization_id`, `status`, `created_by` | Usado em filtros frequentes; `idx_quotes_org` e `idx_quotes_status` criados em `20250102000000` — OK |
| `login_attempts` | `user_id`, `created_at` | `filter: user_id=eq.X` em Realtime sem índice declarado visível |
| `bot_detection_log` | `created_at` | `ORDER BY created_at DESC LIMIT 200` sem índice declarado |
| `request_rate_limits` | `updated_at` | `ORDER BY updated_at DESC LIMIT 100` sem índice declarado |
| `search_analytics` | `product_id`, `user_id` | Realtime e queries diretas sem índice visível nas migrations |
| `product_views` | `product_id`, `created_at` | Usado em `ProductDetail.tsx` com filtro de 30 dias sem índice declarado |

---

## §6. Achados Priorizados

| Severidade | Título | Arquivo/Local | Impacto | Sugestão |
|---|---|---|---|---|
| 🔴 CRÍTICO | `products`, `categories`, `suppliers`, `quotes` — policy "Allow all" FOR ALL USING (true) nunca removida | `migrations/20250102000000_gifts_production.sql:87-90` | Qualquer usuário anônimo pode ler, inserir, atualizar e deletar dados dessas 4 tabelas; `quotes` contém PII (emails, telefones, nomes de clientes) | Adicionar migration que execute `DROP POLICY "Allow all" ON public.products/categories/suppliers/quotes` **imediatamente** antes da próxima release |
| 🔴 CRÍTICO | `quotes` — `select('*').limit(500)` com PII no browser | `src/hooks/useQuotes.ts:~60` | 500 registros com PII de clientes carregados em memória do browser; sem restrição de colunas | Reescrever query para selecionar apenas colunas necessárias para a listagem; nunca incluir `client_email`/`client_phone` em listagens |
| 🔴 CRÍTICO | `order_items` — SELECT aberto para qualquer usuário autenticado | `migrations/20260305220938_*.sql:86` | Qualquer vendedor pode ler pedidos de outros clientes | Trocar `USING (true)` por `USING (order_id IN (SELECT id FROM orders WHERE ...))` escoped por org/user |
| 🔴 CRÍTICO | `audit_trail` — SELECT sem restrição de role | `migrations/20251228_audit_trail.sql:18` | Usuários anônimos podem ler logs de auditoria | Adicionar `TO authenticated` na policy ou trocar USING (true) por `USING (auth.uid() IS NOT NULL)` |
| 🟡 ATENÇÃO | 12 tabelas usadas no front sem definição em types.ts | `src/integrations/supabase/types.ts` | Sem checagem de tipo em compile time; erros de coluna falham silenciosamente em runtime | Regenerar types.ts com `supabase gen types typescript` |
| 🟡 ATENÇÃO | `integration_credentials` armazena `secret_value` em texto semi-claro e expõe via Realtime | `migrations/20260423145604_*.sql`, `CredentialsChangedBanner.tsx:40` | Admins recebem payload com secrets via canal Realtime | Refatorar para armazenar apenas referência ao Vault; ou filtrar colunas sensíveis no payload Realtime |
| 🟡 ATENÇÃO | `product_components`, `product_groups`, `product_group_members` — SELECT aberto para qualquer autenticado | `migrations/20260305220938_*.sql` | Qualquer usuário autenticado lê toda a estrutura de componentes e grupos de produto | Avaliar se dados são públicos; se não, adicionar filtro de org |
| 🟡 ATENÇÃO | `discount_approval_requests` — Realtime sem filtro de usuário | `src/components/admin/DiscountApprovalHeaderBadge.tsx:39` | Subscription captura eventos de todos os usuários | Adicionar `filter: manager_id=eq.${user.id}` ou equivalente |
| 🟡 ATENÇÃO | ~67% dos hooks `useQuery` sem `staleTime` configurado | `src/hooks/` (61 arquivos) | Refetch a cada montagem; carga desnecessária no banco | Definir `staleTime` adequado por domínio (ex: dados de catálogo: 30min; quotes: 30s-2min) |
| 🟡 ATENÇÃO | 3 `.catch(() => {})` silenciando falhas de log de auditoria | `QuoteActionHandlers.ts:97`, `QuoteBitrixSync.ts:68`, `AuthContext.tsx:320` | Falhas de auditoria não detectadas | Adicionar `console.error` ou enviar para `record_platform_failure` no catch |
| 🔵 INFO | 52 tabelas em types.ts sem uso direto no front | `src/integrations/supabase/types.ts` | Dead code em types — impacto mínimo | Remover tipos não usados do types.ts gerado ou marcar como `@internal` |
| 🔵 INFO | `queryKey` sem convenção de namespace consistente | `src/hooks/` | Risco de colisões futuras de cache entre queries homônimas | Definir constantes `QUERY_KEYS` centralizadas por domínio |
| 🔵 INFO | Ritmo de 25 migrations em 3 dias | `supabase/migrations/` | Risco de migrations com conflitos não testados | Considerar um ambiente de staging com CI rodando migrations em ordem |
| 🔵 INFO | `product_views`, `search_analytics`, `login_attempts`, `bot_detection_log` sem índices explícitos visíveis | `supabase/migrations/` | Queries de leitura podem ser lentas em volume | Executar `EXPLAIN ANALYZE` nas queries mais frequentes; adicionar índices conforme necessidade |

---

## Apêndice: Limitações desta auditoria

1. **MCP Supabase indisponível:** `list_tables`, `execute_sql`, `get_advisors`, `list_migrations` falharam com erro de privilégio. Todo estado do banco foi inferido dos arquivos de migration locais.
2. **Estado live não verificado:** É possível que o banco live tenha sido modificado manualmente (fora de migrations) ou que migrations tenham falhado na aplicação.
3. **Supabase Realtime + RLS:** O comportamento exato do RLS sobre eventos Realtime não foi testado em runtime — presume-se que o Supabase aplique RLS corretamente conforme documentação.
4. **Edge functions internas:** Apenas as edge functions invocadas diretamente do front-end foram auditadas. Funções acionadas por cron ou outras funções não foram avaliadas.

---

*FIM DA AUDITORIA -*  
*Relatório gerado em: 2026-04-29 | Auditor: Claude Code (claude-sonnet-4-6)*
