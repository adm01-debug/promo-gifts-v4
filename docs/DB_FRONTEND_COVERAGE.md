# DB ↔ Frontend Coverage Report

_Gerado em 2026-05-16T00:23:27.052Z por `scripts/audit-db-frontend-coverage.mjs`._

> **Como ler:** para cada coluna, classificamos como `READ`, `WRITE`, `READ+WRITE`, `ORPHAN` ou `SYSTEM`. `ORPHAN` = não encontramos referência no código (`src/`, `supabase/functions/`, `api/`). Pode ser falso-positivo se for usada apenas por triggers/RPCs.

## Sumário executivo

| Banco | Tabelas analisadas | Tabelas excluídas | Colunas | Órfãs | Cobertura média |
|---|---:|---:|---:|---:|---:|
| BD Interno (app) | 129 | 10 | 1383 | 157 | 84% |
| BD Externo (produtos SSOT) | 5 | 0 | 94 | 47 | 34% |
| BD CRM (Bitrix mirror) | 5 | 0 | 137 | 92 | 17% |

## Top 20 tabelas com mais colunas órfãs

| Banco | Tabela | Módulo | Órfãs | Total | Cob. | Rows |
|---|---|---|---:|---:|---:|---:|
| BD CRM (Bitrix mirror) | `companies` | CRM | 39 | 58 | 28% | — |
| BD CRM (Bitrix mirror) | `contacts` | CRM | 23 | 37 | 30% | — |
| BD CRM (Bitrix mirror) | `company_addresses` | CRM | 16 | 21 | 11% | — |
| BD Externo (produtos SSOT) | `products` | Catálogo / Produtos | 15 | 49 | 67% | — |
| BD Interno (app) | `v_full_scope_grants` | Outros | 13 | 18 | 28% | 0 |
| BD Externo (produtos SSOT) | `stock_movements` | Estoque | 13 | 16 | 13% | — |
| BD Interno (app) | `quote_approval_tokens` | Orçamentos | 11 | 20 | 35% | 0 |
| BD Externo (produtos SSOT) | `tecnicas_gravacao` | Outros | 9 | 13 | 25% | — |
| BD CRM (Bitrix mirror) | `contact_phones` | Outros | 9 | 12 | 0% | — |
| BD Interno (app) | `webhook_delivery_metrics` | Webhooks & Conexões | 6 | 15 | 57% | 0 |
| BD Interno (app) | `comparison_reactions` | Outros | 5 | 8 | 17% | 0 |
| BD Interno (app) | `conversation_event_history` | Outros | 5 | 10 | 38% | 0 |
| BD Interno (app) | `order_item_personalizations` | Pedidos | 5 | 11 | 38% | 0 |
| BD Interno (app) | `order_items` | Pedidos | 5 | 18 | 69% | 0 |
| BD Interno (app) | `ownership_repair_logs` | Outros | 5 | 13 | 55% | 0 |
| BD Interno (app) | `step_up_challenges` | MCP & Step-Up | 5 | 14 | 58% | 0 |
| BD Externo (produtos SSOT) | `print_areas` | Outros | 5 | 8 | 29% | — |
| BD Externo (produtos SSOT) | `product_colors_view` | Catálogo / Produtos | 5 | 8 | 38% | — |
| BD CRM (Bitrix mirror) | `contact_emails` | Outros | 5 | 9 | 17% | — |
| BD Interno (app) | `app_vitals` | Infra & Observabilidade | 4 | 9 | 43% | 0 |

## BD Interno (app)

### Auditoria

<details><summary><code>admin_audit_log</code> — 100% cobertura, 0/16 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `action` | text | READ+WRITE |
| `resource_type` | text | READ+WRITE |
| `resource_id` | text | READ+WRITE |
| `details` | jsonb | READ+WRITE |
| `ip_address` | text | READ+WRITE |
| `user_agent` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `request_id` | text | READ+WRITE |
| `started_at` | timestamp with time zone | READ+WRITE |
| `finished_at` | timestamp with time zone | READ+WRITE |
| `duration_ms` | integer | READ+WRITE |
| `status` | text | READ+WRITE |
| `payload_summary` | jsonb | READ+WRITE |
| `source` | text | READ+WRITE |

</details>

<details><summary><code>audit_logs</code> — 100% cobertura, 0/6 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `event_type` | text | READ+WRITE |
| `endpoint` | text | READ+WRITE |
| `identifier` | text | READ+WRITE |
| `metadata` | jsonb | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>conversation_audit_logs</code> — 50% cobertura, 4/9 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `session_id` | text | ORPHAN |
| `user_id` | uuid | READ |
| `started_at` | timestamp with time zone | READ |
| `ended_at` | timestamp with time zone | ORPHAN |
| `total_tokens_estimated` | integer | ORPHAN |
| `metadata` | jsonb | READ |
| `status` | text | READ |
| `client_info` | jsonb | ORPHAN |

</details>

<details><summary><code>rls_denial_log</code> — 100% cobertura, 0/16 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ |
| `user_email` | text | READ |
| `user_role` | text | READ |
| `table_name` | text | READ |
| `operation` | text | READ |
| `endpoint` | text | READ |
| `query_summary` | text | READ |
| `target_id` | uuid | READ |
| `target_seller_id` | uuid | READ |
| `policy_hint` | text | READ |
| `error_code` | text | READ |
| `error_message` | text | READ |
| `user_agent` | text | READ |
| `ip_address` | inet | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

### Carrinhos de Vendedor

<details><summary><code>seller_cart_items</code> — 100% cobertura, 0/14 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `cart_id` | uuid | READ+WRITE |
| `product_id` | text | READ+WRITE |
| `product_name` | text | READ+WRITE |
| `product_sku` | text | READ+WRITE |
| `product_image_url` | text | READ+WRITE |
| `product_price` | numeric | READ+WRITE |
| `quantity` | integer | READ+WRITE |
| `color_name` | text | READ+WRITE |
| `color_hex` | text | READ+WRITE |
| `notes` | text | READ+WRITE |
| `sort_order` | integer | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>seller_carts</code> — 100% cobertura, 0/10 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `seller_id` | uuid | READ+WRITE |
| `company_id` | text | READ+WRITE |
| `company_name` | text | READ+WRITE |
| `company_location` | text | READ+WRITE |
| `company_logo_url` | text | READ+WRITE |
| `notes` | text | READ+WRITE |
| `status` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>seller_discount_limits</code> — 100% cobertura, 0/7 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `max_discount_percent` | numeric | READ+WRITE |
| `set_by` | uuid | READ+WRITE |
| `notes` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

### Catálogo / Produtos

<details><summary><code>category_icons</code> — 100% cobertura, 0/7 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `category_name` | text | READ |
| `icon` | text | READ |
| `description` | text | READ |
| `is_active` | boolean | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>product_component_locations</code> — 100% cobertura, 0/11 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `component_id` | uuid | READ+WRITE |
| `location_code` | text | READ+WRITE |
| `location_name` | text | READ+WRITE |
| `description` | text | READ |
| `max_width_cm` | numeric | READ+WRITE |
| `max_height_cm` | numeric | READ+WRITE |
| `is_active` | boolean | READ+WRITE |
| `sort_order` | integer | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>product_components</code> — 100% cobertura, 0/9 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `product_id` | text | READ+WRITE |
| `component_code` | text | READ+WRITE |
| `component_name` | text | READ+WRITE |
| `is_personalizable` | boolean | READ+WRITE |
| `is_active` | boolean | READ+WRITE |
| `sort_order` | integer | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>product_group_members</code> — 100% cobertura, 0/6 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `product_group_id` | uuid | READ |
| `product_id` | text | READ+WRITE |
| `use_group_rules` | boolean | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>product_groups</code> — 100% cobertura, 0/7 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `group_code` | text | READ |
| `group_name` | text | READ |
| `description` | text | READ |
| `is_active` | boolean | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>product_price_freshness_overrides</code> — 100% cobertura, 0/6 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `product_id` | text | READ+WRITE |
| `threshold_days` | integer | READ+WRITE |
| `updated_by` | uuid | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>product_sync_logs</code> — 80% cobertura, 2/12 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `source` | text | READ+WRITE |
| `status` | text | READ+WRITE |
| `records_processed` | integer | READ |
| `records_inserted` | integer | ORPHAN |
| `records_updated` | integer | ORPHAN |
| `records_failed` | integer | READ |
| `duration_ms` | integer | READ |
| `payload` | jsonb | READ+WRITE |
| `error_message` | text | READ+WRITE |
| `triggered_by` | uuid | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>product_views</code> — 100% cobertura, 0/7 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `product_id` | text | READ+WRITE |
| `product_sku` | text | READ+WRITE |
| `product_name` | text | READ+WRITE |
| `seller_id` | uuid | READ+WRITE |
| `view_type` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

### Coleções

<details><summary><code>collection_item_reactions</code> — 33% cobertura, 4/8 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `collection_id` | uuid | READ |
| `item_id` | uuid | ORPHAN |
| `anon_id` | text | ORPHAN |
| `emoji` | text | ORPHAN |
| `ip_hash` | text | ORPHAN |
| `user_agent` | text | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>collection_items</code> — 100% cobertura, 0/11 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `collection_id` | uuid | READ+WRITE |
| `product_id` | text | READ+WRITE |
| `color_name` | text | READ+WRITE |
| `color_hex` | text | READ+WRITE |
| `thumbnail_url` | text | READ+WRITE |
| `sort_order` | integer | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `notes` | text | READ+WRITE |
| `price_at_save` | numeric | READ+WRITE |
| `added_at` | timestamp with time zone | READ |

</details>

<details><summary><code>collection_items_trash</code> — 91% cobertura, 1/13 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `original_id` | uuid | ORPHAN |
| `collection_id` | uuid | READ+WRITE |
| `user_id` | uuid | READ+WRITE |
| `product_id` | text | READ+WRITE |
| `color_name` | text | READ+WRITE |
| `color_hex` | text | READ+WRITE |
| `thumbnail_url` | text | READ+WRITE |
| `notes` | text | READ+WRITE |
| `price_at_save` | numeric | READ+WRITE |
| `sort_order` | integer | READ+WRITE |
| `deleted_at` | timestamp with time zone | SYSTEM |
| `expires_at` | timestamp with time zone | READ |

</details>

<details><summary><code>collections</code> — 92% cobertura, 1/15 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `name` | text | READ+WRITE |
| `description` | text | READ+WRITE |
| `is_featured` | boolean | READ+WRITE |
| `icon_color` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |
| `icon` | text | READ+WRITE |
| `client_id` | text | READ+WRITE |
| `client_name` | text | READ+WRITE |
| `share_token` | text | READ+WRITE |
| `share_expires_at` | timestamp with time zone | READ+WRITE |
| `is_public` | boolean | READ+WRITE |
| `is_deleted` | boolean | ORPHAN |

</details>

### Estoque

<details><summary><code>optimization_queue</code> — 100% cobertura, 0/14 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `title` | text | READ |
| `description` | text | READ |
| `category` | text | READ |
| `priority` | integer | READ |
| `status` | text | READ+WRITE |
| `result` | jsonb | READ |
| `error` | text | READ+WRITE |
| `guardrail_status` | text | READ |
| `started_at` | timestamp with time zone | READ |
| `finished_at` | timestamp with time zone | READ |
| `created_by` | uuid | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>optimization_queue_runs</code> — 50% cobertura, 3/8 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `queue_id` | uuid | ORPHAN |
| `status` | text | READ |
| `notes` | text | READ |
| `guardrail_status` | text | ORPHAN |
| `duration_ms` | integer | READ |
| `executed_by` | uuid | ORPHAN |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

### Favoritos

<details><summary><code>favorite_item_reactions</code> — 33% cobertura, 4/8 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `item_id` | uuid | ORPHAN |
| `list_id` | uuid | READ |
| `anon_id` | text | ORPHAN |
| `emoji` | text | ORPHAN |
| `ip_hash` | text | ORPHAN |
| `user_agent` | text | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>favorite_items</code> — 100% cobertura, 0/11 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `list_id` | uuid | READ+WRITE |
| `user_id` | uuid | READ+WRITE |
| `product_id` | text | READ+WRITE |
| `variant_id` | text | READ+WRITE |
| `variant_info` | jsonb | READ+WRITE |
| `note` | text | READ+WRITE |
| `price_at_save` | numeric | READ+WRITE |
| `position` | integer | READ+WRITE |
| `added_at` | timestamp with time zone | READ |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>favorite_items_trash</code> — 89% cobertura, 1/11 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `original_id` | uuid | ORPHAN |
| `list_id` | uuid | READ+WRITE |
| `user_id` | uuid | READ+WRITE |
| `product_id` | text | READ+WRITE |
| `variant_id` | text | READ+WRITE |
| `variant_info` | jsonb | READ+WRITE |
| `note` | text | READ+WRITE |
| `price_at_save` | numeric | READ+WRITE |
| `deleted_at` | timestamp with time zone | SYSTEM |
| `expires_at` | timestamp with time zone | READ+WRITE |

</details>

<details><summary><code>favorite_lists</code> — 100% cobertura, 0/15 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `name` | text | READ+WRITE |
| `description` | text | READ+WRITE |
| `color` | text | READ+WRITE |
| `icon` | text | READ+WRITE |
| `is_default` | boolean | READ |
| `is_archived` | boolean | READ |
| `client_id` | text | READ+WRITE |
| `client_name` | text | READ+WRITE |
| `shared_token` | text | READ+WRITE |
| `shared_expires_at` | timestamp with time zone | READ+WRITE |
| `position` | integer | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>favorites</code> — 40% cobertura, 3/7 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ |
| `product_id` | text | READ |
| `variant_info` | jsonb | ORPHAN |
| `added_at` | timestamp with time zone | ORPHAN |
| `updated_at` | timestamp with time zone | SYSTEM |
| `is_deleted` | boolean | ORPHAN |

</details>

### IA & Flow

<details><summary><code>ai_insights_cache</code> — 100% cobertura, 0/11 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `function_name` | text | READ+WRITE |
| `cache_key` | text | READ+WRITE |
| `payload` | jsonb | READ+WRITE |
| `model` | text | READ+WRITE |
| `tokens_input` | integer | READ+WRITE |
| `tokens_output` | integer | READ+WRITE |
| `duration_ms` | integer | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `expires_at` | timestamp with time zone | READ+WRITE |

</details>

<details><summary><code>ai_usage_events</code> — 100% cobertura, 0/6 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `function_name` | text | READ+WRITE |
| `event_type` | text | READ+WRITE |
| `metadata` | jsonb | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>ai_usage_logs</code> — 100% cobertura, 0/13 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `function_name` | text | READ+WRITE |
| `model` | text | READ+WRITE |
| `input_tokens` | integer | READ+WRITE |
| `output_tokens` | integer | READ+WRITE |
| `total_tokens` | integer | READ+WRITE |
| `estimated_cost_usd` | numeric | READ+WRITE |
| `duration_ms` | integer | READ+WRITE |
| `status` | text | READ+WRITE |
| `error_message` | text | READ+WRITE |
| `metadata` | jsonb | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>ai_usage_quotas</code> — 100% cobertura, 0/6 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `role` | USER-DEFINED | READ |
| `monthly_limit` | integer | READ+WRITE |
| `is_unlimited` | boolean | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>expert_conversations</code> — 100% cobertura, 0/6 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `seller_id` | uuid | READ+WRITE |
| `client_id` | text | READ+WRITE |
| `title` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>expert_messages</code> — 100% cobertura, 0/5 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `conversation_id` | uuid | READ+WRITE |
| `role` | text | READ+WRITE |
| `content` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

### Infra & Observabilidade

<details><summary><code>app_vitals</code> — 43% cobertura, 4/9 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `metric_name` | text | ORPHAN |
| `metric_value` | numeric | ORPHAN |
| `rating` | text | ORPHAN |
| `request_id` | text | READ |
| `page_url` | text | ORPHAN |
| `user_agent` | text | READ |
| `user_id` | uuid | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>hardening_health_snapshots</code> — 100% cobertura, 0/7 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `snapshot_at` | timestamp with time zone | READ |
| `score` | integer | READ |
| `max_score` | integer | READ |
| `failures` | ARRAY | READ |
| `details` | jsonb | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>query_telemetry</code> — 100% cobertura, 0/18 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `operation` | text | READ+WRITE |
| `table_name` | text | READ+WRITE |
| `rpc_name` | text | READ+WRITE |
| `duration_ms` | integer | READ+WRITE |
| `record_count` | integer | READ+WRITE |
| `query_limit` | integer | READ+WRITE |
| `query_offset` | integer | READ+WRITE |
| `count_mode` | text | READ+WRITE |
| `severity` | text | READ+WRITE |
| `error_message` | text | READ+WRITE |
| `user_id` | uuid | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `error_kind` | text | READ+WRITE |
| `retry_count` | integer | READ+WRITE |
| `cache_hit` | boolean | READ+WRITE |
| `is_cold_start` | boolean | READ+WRITE |
| `is_503` | boolean | READ+WRITE |

</details>

<details><summary><code>request_rate_limits</code> — 100% cobertura, 0/8 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `identifier` | text | READ |
| `endpoint` | text | READ |
| `request_count` | integer | READ |
| `window_start` | timestamp with time zone | READ |
| `blocked_until` | timestamp with time zone | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>scheduled_reports</code> — 100% cobertura, 0/12 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `report_type` | text | READ+WRITE |
| `frequency` | text | READ+WRITE |
| `email_to` | text | READ+WRITE |
| `report_name` | text | READ+WRITE |
| `filters` | jsonb | READ+WRITE |
| `is_active` | boolean | READ+WRITE |
| `last_sent_at` | timestamp with time zone | READ+WRITE |
| `next_run_at` | timestamp with time zone | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>secret_rotation_log</code> — 100% cobertura, 0/8 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `secret_name` | text | READ+WRITE |
| `rotated_by` | uuid | READ+WRITE |
| `rotated_at` | timestamp with time zone | READ |
| `previous_suffix` | text | READ+WRITE |
| `new_suffix` | text | READ+WRITE |
| `notes` | text | READ+WRITE |
| `action_type` | text | READ+WRITE |

</details>

<details><summary><code>workspace_notifications</code> — 100% cobertura, 0/10 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `title` | text | READ+WRITE |
| `message` | text | READ+WRITE |
| `type` | text | READ+WRITE |
| `category` | text | READ+WRITE |
| `is_read` | boolean | READ+WRITE |
| `action_url` | text | READ+WRITE |
| `metadata` | jsonb | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

### Integrações

<details><summary><code>external_connections</code> — 100% cobertura, 0/15 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `type` | text | READ+WRITE |
| `name` | text | READ |
| `config` | jsonb | READ |
| `secret_refs` | ARRAY | READ |
| `status` | text | READ+WRITE |
| `last_test_at` | timestamp with time zone | READ+WRITE |
| `last_test_ok` | boolean | READ+WRITE |
| `last_test_message` | text | READ+WRITE |
| `created_by` | uuid | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |
| `last_latency_ms` | integer | READ+WRITE |
| `env_key` | text | READ |
| `auto_test_enabled` | boolean | READ+WRITE |

</details>

<details><summary><code>external_connections_sync_log</code> — 100% cobertura, 0/13 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `ran_at` | timestamp with time zone | READ |
| `triggered_by_user_id` | uuid | READ |
| `triggered_by_secret_name` | text | READ |
| `trigger_op` | text | READ |
| `processed` | integer | READ |
| `created_count` | integer | READ |
| `updated_count` | integer | READ |
| `status` | text | READ |
| `error_message` | text | READ |
| `duration_ms` | integer | READ |
| `details` | jsonb | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>integration_credentials</code> — 100% cobertura, 0/9 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `secret_name` | text | READ+WRITE |
| `secret_value` | text | READ+WRITE |
| `masked_suffix` | text | READ |
| `length` | integer | READ+WRITE |
| `notes` | text | READ+WRITE |
| `updated_by` | uuid | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

### Kits & Carrinhos

<details><summary><code>cart_templates</code> — 100% cobertura, 0/7 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `name` | text | READ+WRITE |
| `description` | text | READ+WRITE |
| `items` | jsonb | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>kit_collaborators</code> — 80% cobertura, 1/8 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `kit_id` | uuid | READ+WRITE |
| `user_id` | uuid | READ+WRITE |
| `permission` | text | READ+WRITE |
| `invited_by` | uuid | ORPHAN |
| `invited_email` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>kit_comments</code> — 100% cobertura, 0/9 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `kit_id` | uuid | READ+WRITE |
| `author_id` | uuid | READ+WRITE |
| `parent_id` | uuid | READ+WRITE |
| `item_anchor` | text | READ+WRITE |
| `body` | text | READ+WRITE |
| `resolved` | boolean | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>kit_share_tokens</code> — 63% cobertura, 3/11 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `kit_id` | uuid | ORPHAN |
| `seller_id` | uuid | READ |
| `token` | text | ORPHAN |
| `client_name` | text | READ |
| `client_email` | text | READ |
| `status` | text | READ |
| `expires_at` | timestamp with time zone | READ |
| `viewed_at` | timestamp with time zone | ORPHAN |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>kit_templates</code> — 100% cobertura, 0/18 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `name` | text | READ+WRITE |
| `description` | text | READ |
| `category` | text | READ |
| `color` | text | READ |
| `icon` | text | READ |
| `tag` | text | READ |
| `cover_image_url` | text | READ |
| `box_data` | jsonb | READ |
| `items_data` | jsonb | READ |
| `personalization_data` | jsonb | READ |
| `total_price` | numeric | READ |
| `volume_usage_percent` | numeric | READ |
| `usage_count` | integer | READ |
| `is_active` | boolean | READ+WRITE |
| `created_by` | uuid | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>kit_variants</code> — 100% cobertura, 0/11 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `kit_master_id` | uuid | READ |
| `label` | text | READ |
| `sort_order` | integer | READ |
| `box_data` | jsonb | READ |
| `items_data` | jsonb | READ |
| `personalization_data` | jsonb | READ |
| `kit_quantity` | integer | READ |
| `total_price` | numeric | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

### MCP & Step-Up

<details><summary><code>mcp_access_violations</code> — 78% cobertura, 2/11 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ |
| `reason` | text | ORPHAN |
| `source` | text | READ |
| `operation` | text | READ |
| `target_key_id` | uuid | ORPHAN |
| `ip_address` | text | READ |
| `user_agent` | text | READ |
| `request_id` | text | READ |
| `details` | jsonb | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>mcp_api_keys</code> — 100% cobertura, 0/13 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `name` | text | READ+WRITE |
| `key_hash` | text | READ+WRITE |
| `key_prefix` | text | READ+WRITE |
| `scopes` | ARRAY | READ+WRITE |
| `description` | text | READ+WRITE |
| `created_by` | uuid | READ+WRITE |
| `last_used_at` | timestamp with time zone | READ |
| `expires_at` | timestamp with time zone | READ+WRITE |
| `revoked_at` | timestamp with time zone | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |
| `rotated_from` | uuid | READ+WRITE |

</details>

<details><summary><code>mcp_full_grantors</code> — 25% cobertura, 3/4 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `user_id` | uuid | READ |
| `granted_by` | uuid | ORPHAN |
| `reason` | text | ORPHAN |
| `granted_at` | timestamp with time zone | ORPHAN |

</details>

<details><summary><code>mcp_key_auto_revocations</code> — 100% cobertura, 0/7 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `key_id` | uuid | READ |
| `created_by` | uuid | READ |
| `revoked_at` | timestamp with time zone | READ |
| `source` | text | READ |
| `reason` | text | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>mcp_keys</code> — 57% cobertura, 3/9 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ |
| `key_name` | text | ORPHAN |
| `key_hash` | text | ORPHAN |
| `scopes` | ARRAY | READ |
| `expires_at` | timestamp with time zone | READ |
| `last_used_at` | timestamp with time zone | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `is_revoked` | boolean | ORPHAN |

</details>

<details><summary><code>step_up_audit_log</code> — 89% cobertura, 1/11 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `action` | USER-DEFINED | READ+WRITE |
| `target_ref` | text | READ+WRITE |
| `event_type` | text | READ+WRITE |
| `challenge_id` | uuid | READ+WRITE |
| `token_id` | uuid | ORPHAN |
| `ip_address` | inet | READ+WRITE |
| `user_agent` | text | READ+WRITE |
| `metadata` | jsonb | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>step_up_challenges</code> — 58% cobertura, 5/14 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ |
| `action` | USER-DEFINED | READ |
| `target_ref` | text | READ |
| `otp_hash` | text | ORPHAN |
| `attempts` | smallint | READ |
| `max_attempts` | smallint | ORPHAN |
| `password_verified` | boolean | ORPHAN |
| `otp_verified` | boolean | ORPHAN |
| `consumed` | boolean | ORPHAN |
| `created_at` | timestamp with time zone | SYSTEM |
| `expires_at` | timestamp with time zone | READ |
| `ip_address` | inet | READ |
| `user_agent` | text | READ |

</details>

<details><summary><code>step_up_tokens</code> — 50% cobertura, 4/10 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ |
| `action` | USER-DEFINED | READ |
| `target_ref` | text | READ |
| `token_hash` | text | ORPHAN |
| `challenge_id` | uuid | ORPHAN |
| `consumed` | boolean | ORPHAN |
| `created_at` | timestamp with time zone | SYSTEM |
| `expires_at` | timestamp with time zone | READ |
| `consumed_at` | timestamp with time zone | ORPHAN |

</details>

### Magic Up

<details><summary><code>magic_up_brand_kits</code> — 100% cobertura, 0/15 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `client_id` | text | READ |
| `client_name` | text | READ |
| `logo_urls` | jsonb | READ |
| `primary_color` | text | READ |
| `secondary_color` | text | READ |
| `tone_of_voice` | text | READ |
| `visual_style` | text | READ |
| `required_words` | ARRAY | READ |
| `forbidden_words` | ARRAY | READ |
| `notes` | text | READ |
| `metadata` | jsonb | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>magic_up_campaigns</code> — 100% cobertura, 0/15 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `client_id` | text | READ |
| `client_name` | text | READ |
| `title` | text | READ |
| `objective` | text | READ |
| `channel` | text | READ |
| `audience` | text | READ |
| `tone` | text | READ |
| `cta` | text | READ |
| `occasion` | text | READ |
| `status` | text | READ |
| `metadata` | jsonb | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>magic_up_comments</code> — 40% cobertura, 3/7 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ |
| `generation_id` | uuid | ORPHAN |
| `author_name` | text | ORPHAN |
| `comment` | text | ORPHAN |
| `is_public` | boolean | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>magic_up_generations</code> — 100% cobertura, 0/22 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `product_name` | text | READ |
| `scene_title` | text | READ |
| `scene_category` | text | READ |
| `client_name` | text | READ |
| `generated_image_url` | text | READ |
| `is_favorite` | boolean | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `campaign_id` | uuid | READ |
| `product_id` | text | READ |
| `product_sku` | text | READ |
| `prompt_text` | text | READ |
| `model` | text | READ |
| `channel` | text | READ |
| `aspect_ratio` | text | READ |
| `quality_score` | integer | READ+WRITE |
| `status` | text | READ+WRITE |
| `tags` | ARRAY | READ |
| `metadata` | jsonb | READ+WRITE |
| `copy_pack` | jsonb | READ |
| `export_presets` | jsonb | READ |

</details>

<details><summary><code>magic_up_public_shares</code> — 56% cobertura, 4/12 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ |
| `generation_id` | uuid | ORPHAN |
| `campaign_id` | uuid | ORPHAN |
| `share_token` | text | READ |
| `expires_at` | timestamp with time zone | READ |
| `allow_download` | boolean | ORPHAN |
| `allow_comments` | boolean | ORPHAN |
| `status` | text | READ |
| `metadata` | jsonb | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>magic_up_reactions</code> — 40% cobertura, 3/7 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ |
| `generation_id` | uuid | ORPHAN |
| `reaction_type` | text | ORPHAN |
| `ip_hash` | text | ORPHAN |
| `user_agent` | text | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

### Mockups

<details><summary><code>mockup_drafts</code> — 100% cobertura, 0/13 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ |
| `draft_key` | text | READ |
| `product_id` | text | READ+WRITE |
| `product_name` | text | READ |
| `technique_id` | text | READ+WRITE |
| `technique_name` | text | READ |
| `client_id` | text | READ+WRITE |
| `client_name` | text | READ |
| `personalization_areas` | jsonb | READ |
| `logo_data` | text | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>mockup_prompt_configs</code> — 100% cobertura, 0/10 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `config_key` | text | READ+WRITE |
| `label` | text | READ |
| `prompt_text` | text | READ+WRITE |
| `ai_model` | text | READ+WRITE |
| `technique_id` | uuid | READ |
| `is_active` | boolean | READ |
| `version` | integer | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>mockup_prompt_history</code> — 67% cobertura, 3/10 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `config_id` | uuid | READ+WRITE |
| `config_key` | text | READ+WRITE |
| `old_prompt` | text | ORPHAN |
| `new_prompt` | text | ORPHAN |
| `ai_model` | text | READ+WRITE |
| `version` | integer | READ+WRITE |
| `changed_by` | uuid | READ+WRITE |
| `change_notes` | text | READ+WRITE |
| `changed_at` | timestamp with time zone | ORPHAN |

</details>

<details><summary><code>mockup_templates</code> — 91% cobertura, 1/14 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ |
| `name` | text | READ |
| `description` | text | READ |
| `product_id` | text | READ |
| `product_name` | text | READ |
| `technique_id` | text | READ |
| `technique_name` | text | READ |
| `personalization_areas` | jsonb | READ |
| `thumbnail_url` | text | ORPHAN |
| `usage_count` | integer | READ |
| `is_favorite` | boolean | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

### Orçamentos

<details><summary><code>quote_approval_tokens</code> — 35% cobertura, 11/20 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `quote_id` | text | READ |
| `token` | text | ORPHAN |
| `seller_id` | uuid | READ |
| `client_name` | text | READ |
| `client_email` | text | READ |
| `status` | text | READ |
| `expires_at` | timestamp with time zone | READ |
| `viewed_at` | timestamp with time zone | ORPHAN |
| `responded_at` | timestamp with time zone | ORPHAN |
| `response` | text | ORPHAN |
| `response_notes` | text | ORPHAN |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |
| `signer_name` | text | ORPHAN |
| `signer_document` | text | ORPHAN |
| `signer_ip` | text | ORPHAN |
| `signer_user_agent` | text | ORPHAN |
| `signature_hash` | text | ORPHAN |
| `signed_at` | timestamp with time zone | ORPHAN |

</details>

<details><summary><code>quote_comments</code> — 100% cobertura, 0/8 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `quote_id` | text | READ+WRITE |
| `user_id` | uuid | READ+WRITE |
| `parent_id` | uuid | READ+WRITE |
| `content` | text | READ+WRITE |
| `is_edited` | boolean | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>quote_drafts</code> — 33% cobertura, 2/4 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ |
| `data` | jsonb | ORPHAN |
| `last_saved_at` | timestamp with time zone | ORPHAN |

</details>

<details><summary><code>quote_history</code> — 100% cobertura, 0/10 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `quote_id` | uuid | READ+WRITE |
| `user_id` | uuid | READ+WRITE |
| `action` | text | READ+WRITE |
| `description` | text | READ+WRITE |
| `field_changed` | text | READ+WRITE |
| `old_value` | text | READ+WRITE |
| `new_value` | text | READ+WRITE |
| `metadata` | jsonb | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>quote_item_personalizations</code> — 100% cobertura, 0/16 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `quote_item_id` | uuid | READ |
| `technique_id` | text | READ |
| `technique_name` | text | READ |
| `colors_count` | integer | READ |
| `positions_count` | integer | READ |
| `area_cm2` | numeric | READ |
| `width_cm` | numeric | READ |
| `height_cm` | numeric | READ |
| `personalized_quantity` | integer | READ |
| `setup_cost` | numeric | READ |
| `unit_cost` | numeric | READ |
| `total_cost` | numeric | READ |
| `notes` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>quote_items</code> — 78% cobertura, 4/21 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `quote_id` | uuid | READ+WRITE |
| `product_id` | text | READ |
| `product_name` | text | READ |
| `product_sku` | text | READ |
| `product_image_url` | text | READ |
| `quantity` | integer | READ |
| `unit_price` | numeric | READ |
| `subtotal` | numeric | READ+WRITE |
| `color_name` | text | READ |
| `color_hex` | text | READ |
| `notes` | text | READ+WRITE |
| `sort_order` | integer | READ |
| `display_order` | integer | ORPHAN |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |
| `kit_group_id` | text | READ |
| `kit_name` | text | READ |
| `size_code` | text | ORPHAN |
| `gender` | text | ORPHAN |
| `price_confirmed_at` | timestamp with time zone | ORPHAN |

</details>

<details><summary><code>quote_templates</code> — 100% cobertura, 0/16 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `seller_id` | uuid | READ |
| `name` | text | READ |
| `description` | text | READ |
| `is_default` | boolean | READ |
| `template_data` | jsonb | READ |
| `items_data` | jsonb | READ |
| `discount_percent` | numeric | READ |
| `discount_amount` | numeric | READ |
| `notes` | text | READ |
| `internal_notes` | text | READ |
| `payment_terms` | text | READ |
| `delivery_time` | text | READ |
| `validity_days` | integer | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>quotes</code> — 94% cobertura, 2/38 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `quote_number` | text | READ+WRITE |
| `client_id` | text | READ+WRITE |
| `client_name` | text | READ+WRITE |
| `client_email` | text | READ |
| `client_phone` | text | READ |
| `client_company` | text | READ |
| `client_cnpj` | text | ORPHAN |
| `seller_id` | uuid | READ+WRITE |
| `status` | text | READ+WRITE |
| `subtotal` | numeric | READ+WRITE |
| `discount_percent` | numeric | READ |
| `discount_amount` | numeric | READ |
| `total` | numeric | READ+WRITE |
| `notes` | text | READ+WRITE |
| `payment_terms` | text | READ |
| `delivery_time` | text | READ |
| `shipping_type` | text | READ |
| `shipping_cost` | numeric | READ |
| `internal_notes` | text | READ+WRITE |
| `valid_until` | timestamp with time zone | READ |
| `bitrix_deal_id` | text | READ+WRITE |
| `bitrix_quote_id` | text | READ+WRITE |
| `synced_to_bitrix` | boolean | READ+WRITE |
| `synced_at` | timestamp with time zone | READ+WRITE |
| `client_response` | text | READ |
| `client_response_at` | timestamp with time zone | READ |
| `client_response_notes` | text | ORPHAN |
| `sent_at` | timestamp with time zone | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |
| `version` | integer | READ+WRITE |
| `parent_quote_id` | uuid | READ+WRITE |
| `is_latest_version` | boolean | READ+WRITE |
| `organization_id` | uuid | READ |
| `negotiation_markup_percent` | numeric | READ+WRITE |
| `real_subtotal` | numeric | READ |
| `real_discount_percent` | numeric | READ+WRITE |

</details>

### Outros

<details><summary><code>access_security_settings</code> — 83% cobertura, 1/9 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `ip_whitelist_enabled` | boolean | READ |
| `city_whitelist_enabled` | boolean | READ |
| `block_unknown_locations` | boolean | READ |
| `max_failed_attempts` | integer | READ |
| `lockout_duration_minutes` | integer | READ |
| `strict_access_mode` | boolean | ORPHAN |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>admin_settings</code> — 100% cobertura, 0/6 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `key` | text | READ+WRITE |
| `value` | jsonb | READ+WRITE |
| `updated_by` | uuid | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>art_file_attachments</code> — 100% cobertura, 0/13 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `mockup_id` | uuid | READ+WRITE |
| `quote_id` | uuid | READ+WRITE |
| `file_url` | text | READ+WRITE |
| `file_path` | text | READ+WRITE |
| `original_name` | text | READ+WRITE |
| `mime_type` | text | READ+WRITE |
| `file_size_bytes` | bigint | READ+WRITE |
| `file_extension` | text | READ+WRITE |
| `notes` | text | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>comparison_reactions</code> — 17% cobertura, 5/8 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `comparison_id` | uuid | ORPHAN |
| `item_index` | integer | ORPHAN |
| `emoji` | text | ORPHAN |
| `anon_id` | text | ORPHAN |
| `ip_hash` | text | ORPHAN |
| `user_agent` | text | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>component_media</code> — 71% cobertura, 2/10 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `component_id` | text | ORPHAN |
| `product_id` | text | READ |
| `media_type` | text | READ |
| `url` | text | READ |
| `title` | text | READ |
| `sort_order` | integer | READ |
| `is_cover` | boolean | ORPHAN |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>conversation_delivery_status</code> — 33% cobertura, 2/5 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `event_id` | uuid | ORPHAN |
| `status` | text | READ |
| `error_details` | text | ORPHAN |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>conversation_event_history</code> — 38% cobertura, 5/10 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `conversation_id` | uuid | ORPHAN |
| `role` | text | READ |
| `event_type` | USER-DEFINED | READ |
| `content` | text | ORPHAN |
| `media_url` | text | ORPHAN |
| `media_metadata` | jsonb | ORPHAN |
| `tokens_estimated` | integer | ORPHAN |
| `created_at` | timestamp with time zone | SYSTEM |
| `request_id` | uuid | READ |

</details>

<details><summary><code>custom_kits</code> — 100% cobertura, 0/23 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `name` | text | READ+WRITE |
| `status` | text | READ |
| `box_data` | jsonb | READ |
| `items_data` | jsonb | READ |
| `personalization_data` | jsonb | READ |
| `kit_quantity` | integer | READ |
| `box_price` | numeric | READ |
| `items_price` | numeric | READ |
| `personalization_price` | numeric | READ |
| `total_price` | numeric | READ |
| `volume_usage_percent` | numeric | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |
| `kit_type` | text | READ |
| `color` | text | READ |
| `tag` | text | READ |
| `icon` | text | READ |
| `description` | text | READ |
| `is_favorite` | boolean | READ+WRITE |
| `last_used_at` | timestamp with time zone | READ+WRITE |
| `is_pinned` | boolean | READ+WRITE |

</details>

<details><summary><code>e2e_cleanup_audit</code> — 100% cobertura, 0/16 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `email` | text | READ |
| `user_id` | uuid | READ |
| `dry_run` | boolean | READ |
| `status` | text | READ |
| `reason` | text | READ |
| `ip` | text | READ |
| `user_agent` | text | READ |
| `total_deleted` | integer | READ |
| `deleted_by_table` | jsonb | READ |
| `errors` | jsonb | READ |
| `duration_ms` | integer | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `seller_scope` | text | READ |
| `seller_id` | uuid | READ |
| `name_filter_prefix` | text | READ |

</details>

<details><summary><code>e2e_cleanup_rate_limit</code> — 0% cobertura, 3/4 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `key` | text | ORPHAN |
| `count` | integer | ORPHAN |
| `window_start` | timestamp with time zone | ORPHAN |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>follow_up_reminders</code> — 80% cobertura, 2/12 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `quote_id` | text | READ |
| `seller_id` | uuid | READ |
| `reminder_type` | text | READ |
| `scheduled_for` | timestamp with time zone | READ |
| `is_sent` | boolean | READ |
| `sent_at` | timestamp with time zone | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `title` | text | READ |
| `notes` | text | READ |
| `is_completed` | boolean | ORPHAN |
| `completed_at` | timestamp with time zone | ORPHAN |

</details>

<details><summary><code>generated_mockups</code> — 100% cobertura, 0/20 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `seller_id` | uuid | READ+WRITE |
| `client_id` | text | READ+WRITE |
| `client_name` | text | READ+WRITE |
| `product_id` | text | READ+WRITE |
| `product_name` | text | READ+WRITE |
| `product_sku` | text | READ+WRITE |
| `technique_id` | text | READ+WRITE |
| `technique_name` | text | READ+WRITE |
| `logo_url` | text | READ+WRITE |
| `mockup_url` | text | READ+WRITE |
| `layout_url` | text | READ+WRITE |
| `position_x` | numeric | READ+WRITE |
| `position_y` | numeric | READ+WRITE |
| `logo_width_cm` | numeric | READ+WRITE |
| `logo_height_cm` | numeric | READ+WRITE |
| `location_name` | text | READ+WRITE |
| `colors_count` | integer | READ+WRITE |
| `annotations` | jsonb | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>ownership_audit_reports</code> — 100% cobertura, 0/11 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `generated_at` | timestamp with time zone | READ |
| `total_tables_scanned` | integer | READ |
| `total_issues_found` | integer | READ |
| `null_owner_count` | integer | READ |
| `missing_user_count` | integer | READ |
| `details` | jsonb | READ |
| `triggered_by` | text | READ |
| `duration_ms` | integer | READ |
| `rls_coverage` | jsonb | READ |
| `rls_gaps_count` | integer | READ |

</details>

<details><summary><code>ownership_repair_logs</code> — 55% cobertura, 5/13 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `report_id` | uuid | READ |
| `table_name` | text | ORPHAN |
| `owner_column` | text | ORPHAN |
| `issue_type` | text | ORPHAN |
| `action` | text | READ |
| `rows_affected` | integer | ORPHAN |
| `dry_run` | boolean | READ |
| `triggered_by` | uuid | READ |
| `triggered_by_label` | text | ORPHAN |
| `notes` | text | READ |
| `error_message` | text | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>recently_viewed_products</code> — 67% cobertura, 1/4 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ |
| `product_id` | text | READ |
| `viewed_at` | timestamp with time zone | ORPHAN |

</details>

<details><summary><code>system_settings</code> — 67% cobertura, 1/4 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `key` | text | ORPHAN |
| `value` | jsonb | READ |
| `updated_at` | timestamp with time zone | SYSTEM |
| `updated_by` | uuid | READ |

</details>

<details><summary><code>v_full_scope_grants</code> — 28% cobertura, 13/18 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `audit_id` | uuid | ORPHAN |
| `granted_at` | timestamp with time zone | ORPHAN |
| `granted_to_user_id` | uuid | ORPHAN |
| `granted_to_name` | text | ORPHAN |
| `granted_to_email` | character varying | ORPHAN |
| `step_up_action` | USER-DEFINED | ORPHAN |
| `operation` | text | READ |
| `key_id` | uuid | ORPHAN |
| `key_prefix` | text | READ |
| `key_expires_at` | timestamp with time zone | ORPHAN |
| `justification` | text | ORPHAN |
| `challenge_id` | uuid | ORPHAN |
| `token_id` | uuid | ORPHAN |
| `ip_address` | inet | READ |
| `user_agent` | text | READ |
| `request_id` | text | READ |
| `verifications_applied` | jsonb | ORPHAN |
| `extra` | jsonb | ORPHAN |

</details>

<details><summary><code>video_variant_links</code> — 100% cobertura, 0/8 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `video_id` | text | READ+WRITE |
| `variant_id` | text | READ+WRITE |
| `variant_name` | text | READ+WRITE |
| `variant_color_hex` | text | READ+WRITE |
| `supplier_code` | text | READ+WRITE |
| `product_id` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>voice_command_logs</code> — 100% cobertura, 0/9 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `transcript` | text | READ+WRITE |
| `action` | text | READ+WRITE |
| `response` | text | READ+WRITE |
| `data` | jsonb | READ+WRITE |
| `duration_ms` | integer | READ |
| `success` | boolean | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

### Pedidos

<details><summary><code>order_item_personalizations</code> — 38% cobertura, 5/11 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `order_item_id` | uuid | ORPHAN |
| `technique_id` | uuid | READ |
| `technique_name` | text | READ |
| `location_id` | uuid | ORPHAN |
| `location_name` | text | READ |
| `image_url` | text | ORPHAN |
| `personalization_text` | text | ORPHAN |
| `price_adjustment` | numeric | ORPHAN |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>order_items</code> — 69% cobertura, 5/18 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `order_id` | uuid | READ |
| `product_id` | text | READ |
| `product_sku` | text | READ |
| `product_name` | text | READ |
| `product_image_url` | text | READ |
| `quantity` | integer | READ |
| `unit_price` | numeric | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `organization_id` | uuid | READ |
| `total_price` | numeric | READ |
| `color_name` | text | READ |
| `color_hex` | text | ORPHAN |
| `notes` | text | READ |
| `size_code` | text | ORPHAN |
| `gender` | text | ORPHAN |
| `kit_group_id` | uuid | ORPHAN |
| `kit_name` | text | ORPHAN |

</details>

<details><summary><code>orders</code> — 86% cobertura, 3/25 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `seller_id` | uuid | READ+WRITE |
| `order_number` | text | READ |
| `status` | text | READ+WRITE |
| `fulfillment_status` | text | READ |
| `client_id` | text | READ |
| `client_name` | text | READ+WRITE |
| `client_email` | text | READ |
| `client_phone` | text | READ |
| `client_company` | text | READ |
| `quote_id` | uuid | READ+WRITE |
| `subtotal` | numeric | READ+WRITE |
| `discount_amount` | numeric | READ |
| `shipping_cost` | numeric | READ |
| `total` | numeric | READ+WRITE |
| `notes` | text | READ |
| `internal_notes` | text | ORPHAN |
| `tracking_number` | text | ORPHAN |
| `shipping_type` | text | ORPHAN |
| `payment_terms` | text | READ |
| `delivery_time` | text | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |
| `organization_id` | uuid | READ |
| `version` | integer | READ |

</details>

### Preços & Descontos

<details><summary><code>discount_approval_requests</code> — 100% cobertura, 0/12 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `quote_id` | uuid | READ+WRITE |
| `seller_id` | uuid | READ+WRITE |
| `requested_discount_percent` | numeric | READ+WRITE |
| `max_allowed_percent` | numeric | READ+WRITE |
| `status` | text | READ+WRITE |
| `admin_id` | uuid | READ+WRITE |
| `admin_notes` | text | READ+WRITE |
| `seller_notes` | text | READ+WRITE |
| `responded_at` | timestamp with time zone | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>price_history</code> — 75% cobertura, 1/5 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `product_id` | text | READ |
| `variant_id` | text | ORPHAN |
| `price` | numeric | READ |
| `recorded_at` | timestamp with time zone | READ |

</details>

### SEO & Busca

<details><summary><code>search_analytics</code> — 75% cobertura, 1/6 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ |
| `search_term` | text | READ+WRITE |
| `results_count` | integer | READ+WRITE |
| `search_context` | text | ORPHAN |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

### Segurança

<details><summary><code>auth_login_attempts</code> — 80% cobertura, 1/7 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `email` | text | READ |
| `ip_address` | text | READ |
| `success` | boolean | READ |
| `failure_reason` | text | ORPHAN |
| `user_agent` | text | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>bot_detection_log</code> — 100% cobertura, 0/9 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `ip_address` | text | READ+WRITE |
| `user_agent` | text | READ+WRITE |
| `endpoint` | text | READ+WRITE |
| `detection_reason` | text | READ+WRITE |
| `request_count` | integer | READ |
| `blocked` | boolean | READ+WRITE |
| `metadata` | jsonb | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>file_scan_logs</code> — 100% cobertura, 0/8 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ |
| `bucket` | character varying | READ |
| `path` | text | READ |
| `hash` | character varying | READ |
| `scan_result` | jsonb | READ+WRITE |
| `status_code` | integer | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>geo_allowed_countries</code> — 100% cobertura, 0/6 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `country_code` | character | READ+WRITE |
| `country_name` | text | READ+WRITE |
| `is_active` | boolean | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `created_by` | uuid | READ+WRITE |

</details>

<details><summary><code>ip_access_control</code> — 100% cobertura, 0/8 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `ip_address` | text | READ+WRITE |
| `list_type` | text | READ+WRITE |
| `reason` | text | READ+WRITE |
| `expires_at` | timestamp with time zone | READ+WRITE |
| `created_by` | uuid | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>login_attempts</code> — 100% cobertura, 0/8 órfãs, rows: 4</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `email` | text | READ+WRITE |
| `user_id` | uuid | READ+WRITE |
| `ip_address` | text | READ+WRITE |
| `user_agent` | text | READ+WRITE |
| `success` | boolean | READ+WRITE |
| `failure_reason` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>public_token_failures</code> — 50% cobertura, 3/8 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `resource_type` | text | ORPHAN |
| `resource_id` | text | READ |
| `attempted_token` | text | ORPHAN |
| `ip_address` | text | READ |
| `user_agent` | text | READ |
| `reason` | text | ORPHAN |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

### Simulador & Filtros

<details><summary><code>saved_filters</code> — 100% cobertura, 0/11 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `name` | text | READ+WRITE |
| `description` | text | READ+WRITE |
| `filters` | jsonb | READ+WRITE |
| `context` | text | READ+WRITE |
| `is_default` | boolean | READ+WRITE |
| `icon` | text | READ+WRITE |
| `color` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>saved_trends_views</code> — 100% cobertura, 0/6 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `name` | text | READ+WRITE |
| `filters` | jsonb | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>simulator_wizard_drafts</code> — 100% cobertura, 0/9 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `title` | text | READ+WRITE |
| `product_data` | jsonb | READ+WRITE |
| `quantity` | integer | READ+WRITE |
| `personalizations` | jsonb | READ+WRITE |
| `wizard_step` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

### Usuários & RBAC

<details><summary><code>organization_members</code> — 80% cobertura, 1/8 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `organization_id` | uuid | READ |
| `user_id` | uuid | READ |
| `role` | USER-DEFINED | READ |
| `invited_by` | uuid | ORPHAN |
| `joined_at` | timestamp with time zone | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>organizations</code> — 100% cobertura, 0/9 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `name` | text | READ |
| `slug` | text | READ |
| `logo_url` | text | READ |
| `description` | text | READ |
| `is_active` | boolean | READ |
| `settings` | jsonb | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>permissions</code> — 100% cobertura, 0/7 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `code` | text | READ |
| `name` | text | READ |
| `description` | text | READ |
| `category` | text | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>profiles</code> — 100% cobertura, 0/13 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `email` | text | READ+WRITE |
| `full_name` | text | READ+WRITE |
| `role` | text | READ+WRITE |
| `avatar_url` | text | READ+WRITE |
| `phone` | text | READ |
| `department` | text | READ |
| `is_active` | boolean | READ+WRITE |
| `last_login_at` | timestamp with time zone | READ+WRITE |
| `preferences` | jsonb | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>role_migration_batches</code> — 100% cobertura, 0/14 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `label` | text | READ |
| `reason` | text | READ |
| `initiated_by` | uuid | READ |
| `dry_run` | boolean | READ |
| `status` | USER-DEFINED | READ |
| `total_items` | integer | READ |
| `success_count` | integer | READ |
| `failed_count` | integer | READ |
| `skipped_count` | integer | READ |
| `started_at` | timestamp with time zone | READ |
| `finished_at` | timestamp with time zone | READ |
| `duration_ms` | integer | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>role_migration_items</code> — 100% cobertura, 0/12 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `batch_id` | uuid | READ |
| `user_id` | uuid | READ |
| `user_email` | text | READ |
| `from_role` | USER-DEFINED | READ |
| `to_role` | USER-DEFINED | READ |
| `operation` | text | READ |
| `status` | USER-DEFINED | READ |
| `error_message` | text | READ |
| `duration_ms` | integer | READ |
| `processed_at` | timestamp with time zone | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>role_permissions</code> — 100% cobertura, 0/4 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `role` | USER-DEFINED | READ |
| `permission_code` | text | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>user_comparisons</code> — 89% cobertura, 1/12 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `client_id` | text | READ+WRITE |
| `client_name` | text | READ+WRITE |
| `name` | text | READ |
| `items` | jsonb | READ+WRITE |
| `share_token` | text | READ |
| `is_public` | boolean | READ+WRITE |
| `share_expires_at` | timestamp with time zone | READ+WRITE |
| `view_count` | integer | ORPHAN |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>user_known_devices</code> — 75% cobertura, 1/6 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `fingerprint` | text | READ+WRITE |
| `device_name` | text | ORPHAN |
| `last_seen_at` | timestamp with time zone | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>user_onboarding</code> — 100% cobertura, 0/9 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `has_completed_tour` | boolean | READ+WRITE |
| `current_step` | integer | READ+WRITE |
| `completed_steps` | jsonb | READ+WRITE |
| `started_at` | timestamp with time zone | READ |
| `completed_at` | timestamp with time zone | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>user_preferences</code> — 50% cobertura, 2/7 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `comparison_weights` | jsonb | READ+WRITE |
| `comparison_column_order` | jsonb | ORPHAN |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |
| `filter_states` | jsonb | ORPHAN |

</details>

<details><summary><code>user_roles</code> — 100% cobertura, 0/3 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `role` | USER-DEFINED | READ+WRITE |

</details>

<details><summary><code>user_search_history</code> — 33% cobertura, 4/9 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ |
| `query_text` | text | ORPHAN |
| `history_type` | text | ORPHAN |
| `result_count` | integer | ORPHAN |
| `is_pinned` | boolean | ORPHAN |
| `metadata` | jsonb | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>user_token_revocations</code> — 100% cobertura, 0/2 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `user_id` | uuid | READ |
| `revoked_at` | timestamp with time zone | READ |

</details>

### Webhooks & Conexões

<details><summary><code>connection_test_history</code> — 100% cobertura, 0/21 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `connection_id` | uuid | READ+WRITE |
| `tested_at` | timestamp with time zone | READ+WRITE |
| `success` | boolean | READ+WRITE |
| `latency_ms` | integer | READ+WRITE |
| `status_code` | integer | READ+WRITE |
| `error_message` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `triggered_by` | text | READ+WRITE |
| `error_kind` | text | READ+WRITE |
| `request_method` | text | READ |
| `request_url` | text | READ |
| `response_headers` | jsonb | READ |
| `response_body` | text | READ |
| `dns_ms` | integer | READ |
| `tcp_ms` | integer | READ |
| `tls_ms` | integer | READ |
| `ttfb_ms` | integer | READ |
| `download_ms` | integer | READ |
| `triggered_by_user_id` | uuid | READ |
| `attempts` | smallint | READ+WRITE |

</details>

<details><summary><code>inbound_webhook_endpoints</code> — 91% cobertura, 1/14 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `slug` | text | READ+WRITE |
| `name` | text | READ+WRITE |
| `source_system` | text | READ+WRITE |
| `hmac_secret_ref` | text | READ+WRITE |
| `allowed_events` | ARRAY | ORPHAN |
| `active` | boolean | READ+WRITE |
| `description` | text | READ |
| `created_by` | uuid | READ+WRITE |
| `last_received_at` | timestamp with time zone | READ+WRITE |
| `total_received` | integer | READ+WRITE |
| `total_invalid` | integer | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>inbound_webhook_events</code> — 100% cobertura, 0/9 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `endpoint_id` | uuid | READ+WRITE |
| `event_type` | text | READ+WRITE |
| `payload` | jsonb | READ+WRITE |
| `signature_valid` | boolean | READ+WRITE |
| `processed` | boolean | READ+WRITE |
| `error` | text | READ+WRITE |
| `source_ip` | text | READ+WRITE |
| `received_at` | timestamp with time zone | READ |

</details>

<details><summary><code>outbound_webhooks</code> — 100% cobertura, 0/17 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `name` | text | READ+WRITE |
| `url` | text | READ+WRITE |
| `secret_ref` | text | READ+WRITE |
| `events` | ARRAY | READ+WRITE |
| `active` | boolean | READ+WRITE |
| `retry_policy` | jsonb | READ |
| `description` | text | READ |
| `created_by` | uuid | READ+WRITE |
| `last_triggered_at` | timestamp with time zone | READ+WRITE |
| `total_success` | integer | READ+WRITE |
| `total_failure` | integer | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |
| `consecutive_failures` | integer | READ+WRITE |
| `auto_disabled_at` | timestamp with time zone | READ+WRITE |
| `auto_disabled_reason` | text | READ+WRITE |

</details>

<details><summary><code>webhook_deliveries</code> — 100% cobertura, 0/11 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `webhook_id` | uuid | READ+WRITE |
| `event` | text | READ+WRITE |
| `payload` | jsonb | READ+WRITE |
| `payload_hash` | text | READ+WRITE |
| `status_code` | integer | READ+WRITE |
| `response_body_truncated` | text | READ+WRITE |
| `attempt` | integer | READ+WRITE |
| `success` | boolean | READ+WRITE |
| `error_message` | text | READ+WRITE |
| `delivered_at` | timestamp with time zone | READ |

</details>

<details><summary><code>webhook_delivery_metrics</code> — 57% cobertura, 6/15 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `request_id` | text | READ |
| `event_type` | text | READ |
| `source` | text | READ |
| `direction` | text | ORPHAN |
| `endpoint` | text | ORPHAN |
| `http_status` | integer | ORPHAN |
| `duration_ms` | integer | READ |
| `attempt` | integer | READ |
| `success` | boolean | READ |
| `error_class` | text | ORPHAN |
| `error_message` | text | READ |
| `payload_bytes` | integer | ORPHAN |
| `metadata` | jsonb | READ |
| `occurred_at` | timestamp with time zone | ORPHAN |

</details>

### Tabelas excluídas

| Tabela | Motivo | Rows |
|---|---|---:|
| `admin_audit_log_old` | name-pattern | 0 |
| `admin_audit_log_y2025m12` | name-pattern | 0 |
| `admin_audit_log_y2026m01` | name-pattern | 0 |
| `admin_audit_log_y2026m02` | name-pattern | 0 |
| `admin_audit_log_y2026m03` | name-pattern | 0 |
| `admin_audit_log_y2026m04` | name-pattern | 0 |
| `admin_audit_log_y2026m05` | name-pattern | 0 |
| `admin_audit_log_y2026m06` | name-pattern | 0 |
| `webhook_delivery_metrics_y2026m05` | name-pattern | 0 |
| `webhook_delivery_metrics_y2026m06` | name-pattern | 0 |

## BD Externo (produtos SSOT)

### Catálogo / Produtos

<details><summary><code>product_colors_view</code> — 38% cobertura, 5/8 órfãs, rows: — 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `name` | unknown | READ |
| `hex` | unknown | ORPHAN |
| `group` | unknown | ORPHAN |
| `groupSlug` | unknown | ORPHAN |
| `variationSlug` | unknown | ORPHAN |
| `code` | unknown | READ |
| `image` | unknown | ORPHAN |
| `images` | unknown | READ |

</details>

<details><summary><code>products</code> — 67% cobertura, 15/49 órfãs, rows: —</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | unknown | SYSTEM |
| `sku` | unknown | READ+WRITE |
| `name` | unknown | READ+WRITE |
| `description` | unknown | READ |
| `short_description` | unknown | ORPHAN |
| `category_name` | unknown | READ |
| `brand` | unknown | READ |
| `sale_price` | unknown | READ |
| `base_price` | unknown | ORPHAN |
| `cost_price` | unknown | ORPHAN |
| `stock_quantity` | unknown | READ |
| `is_bestseller` | unknown | READ |
| `is_new` | unknown | READ |
| `is_kit` | unknown | READ |
| `supplier_code` | unknown | ORPHAN |
| `supplier_name` | unknown | READ |
| `image_url` | unknown | READ |
| `videos` | unknown | ORPHAN |
| `category_id` | unknown | READ |
| `price` | unknown | READ |
| `og_image_url` | unknown | ORPHAN |
| `images` | unknown | READ |
| `stock` | unknown | READ |
| `created_at` | unknown | SYSTEM |
| `updated_at` | unknown | SYSTEM |
| `colors` | unknown | READ |
| `materials` | unknown | READ |
| `supplier_reference` | unknown | ORPHAN |
| `is_active` | unknown | READ |
| `minQuantity` | unknown | ORPHAN |
| `dimensions` | unknown | ORPHAN |
| `height_cm` | unknown | ORPHAN |
| `width_cm` | unknown | ORPHAN |
| `length_cm` | unknown | ORPHAN |
| `diameter_cm` | unknown | ORPHAN |
| `weight_g` | unknown | ORPHAN |
| `capacity_ml` | unknown | ORPHAN |
| `stock_status` | unknown | READ |
| `subcategory` | unknown | READ |
| `supplier_id` | unknown | READ |
| `variations` | unknown | READ |
| `tags` | unknown | READ |
| `featured` | unknown | READ |
| `new_arrival` | unknown | READ |
| `on_sale` | unknown | READ |
| `kit_items` | unknown | READ |
| `min_quantity` | unknown | READ |
| `external_id` | unknown | READ |
| `metadata` | unknown | READ+WRITE |

</details>

### Estoque

<details><summary><code>stock_movements</code> — 13% cobertura, 13/16 órfãs, rows: — 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | unknown | SYSTEM |
| `productId` | unknown | ORPHAN |
| `variantId` | unknown | ORPHAN |
| `colorName` | unknown | ORPHAN |
| `type` | unknown | READ |
| `quantity` | unknown | READ |
| `previousStock` | unknown | ORPHAN |
| `newStock` | unknown | ORPHAN |
| `reason` | unknown | ORPHAN |
| `reference` | unknown | ORPHAN |
| `referenceType` | unknown | ORPHAN |
| `unitCost` | unknown | ORPHAN |
| `totalCost` | unknown | ORPHAN |
| `createdAt` | unknown | ORPHAN |
| `createdBy` | unknown | ORPHAN |
| `createdByName` | unknown | ORPHAN |

</details>

### Outros

<details><summary><code>print_areas</code> — 29% cobertura, 5/8 órfãs, rows: — 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | unknown | SYSTEM |
| `component_name` | unknown | READ |
| `location_name` | unknown | READ |
| `width_cm` | unknown | ORPHAN |
| `height_cm` | unknown | ORPHAN |
| `unit` | unknown | ORPHAN |
| `is_primary` | unknown | ORPHAN |
| `allowed_technique_ids` | unknown | ORPHAN |

</details>

<details><summary><code>tecnicas_gravacao</code> — 25% cobertura, 9/13 órfãs, rows: — 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | unknown | SYSTEM |
| `name` | unknown | READ |
| `technique_name` | unknown | READ |
| `code` | unknown | READ |
| `technique_code` | unknown | ORPHAN |
| `setup_cost` | unknown | ORPHAN |
| `setup_price` | unknown | ORPHAN |
| `unit_cost` | unknown | ORPHAN |
| `handling_price` | unknown | ORPHAN |
| `max_colors` | unknown | ORPHAN |
| `min_area_cm2` | unknown | ORPHAN |
| `max_area_cm2` | unknown | ORPHAN |
| `sla_days` | unknown | ORPHAN |

</details>

## BD CRM (Bitrix mirror)

### CRM

<details><summary><code>companies</code> — 28% cobertura, 39/58 órfãs, rows: —</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | unknown | SYSTEM |
| `razao_social` | unknown | READ |
| `nome_fantasia` | unknown | READ |
| `title` | unknown | READ |
| `cnpj` | unknown | READ |
| `ramo_atividade` | unknown | READ |
| `status` | unknown | READ |
| `source` | unknown | READ |
| `is_customer` | unknown | READ |
| `is_supplier` | unknown | READ |
| `is_carrier` | unknown | ORPHAN |
| `is_matriz` | unknown | ORPHAN |
| `logradouro` | unknown | ORPHAN |
| `numero` | unknown | ORPHAN |
| `complemento` | unknown | ORPHAN |
| `bairro` | unknown | ORPHAN |
| `cidade` | unknown | READ |
| `estado` | unknown | READ |
| `cep` | unknown | ORPHAN |
| `pais` | unknown | ORPHAN |
| `endereco` | unknown | ORPHAN |
| `endereco_faturamento` | unknown | ORPHAN |
| `inscricao_estadual` | unknown | ORPHAN |
| `inscricao_municipal` | unknown | ORPHAN |
| `cnae_principal` | unknown | ORPHAN |
| `cnae_descricao` | unknown | ORPHAN |
| `website` | unknown | READ |
| `instagram` | unknown | READ |
| `facebook` | unknown | ORPHAN |
| `linkedin` | unknown | ORPHAN |
| `logo_url` | unknown | READ |
| `grupo_economico` | unknown | ORPHAN |
| `grupo_economico_id` | unknown | ORPHAN |
| `matriz_id` | unknown | ORPHAN |
| `central_id` | unknown | ORPHAN |
| `singular_id` | unknown | ORPHAN |
| `tipo_cooperativa` | unknown | ORPHAN |
| `employee_count` | unknown | ORPHAN |
| `annual_revenue` | unknown | ORPHAN |
| `financial_health` | unknown | ORPHAN |
| `bitrix_company_id` | unknown | ORPHAN |
| `bitrix_created_at` | unknown | ORPHAN |
| `bitrix_updated_at` | unknown | ORPHAN |
| `_deprecated_email` | unknown | ORPHAN |
| `_deprecated_phone` | unknown | ORPHAN |
| `_deprecated_phone_secondary` | unknown | ORPHAN |
| `tags_array` | unknown | ORPHAN |
| `challenges` | unknown | ORPHAN |
| `competitors` | unknown | ORPHAN |
| `search_vector` | unknown | ORPHAN |
| `deleted_at` | unknown | SYSTEM |
| `deleted_by` | unknown | ORPHAN |
| `user_id` | unknown | READ |
| `assigned_by_id` | unknown | ORPHAN |
| `created_by_id` | unknown | ORPHAN |
| `merge_notes` | unknown | ORPHAN |
| `created_at` | unknown | SYSTEM |
| `updated_at` | unknown | SYSTEM |

</details>

<details><summary><code>company_addresses</code> — 11% cobertura, 16/21 órfãs, rows: — 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | unknown | SYSTEM |
| `company_id` | unknown | ORPHAN |
| `tipo` | unknown | ORPHAN |
| `is_primary` | unknown | ORPHAN |
| `logradouro` | unknown | ORPHAN |
| `numero` | unknown | ORPHAN |
| `complemento` | unknown | ORPHAN |
| `bairro` | unknown | ORPHAN |
| `cidade` | unknown | READ |
| `estado` | unknown | READ |
| `cep` | unknown | ORPHAN |
| `pais` | unknown | ORPHAN |
| `google_maps_url` | unknown | ORPHAN |
| `google_place_id` | unknown | ORPHAN |
| `latitude` | unknown | ORPHAN |
| `longitude` | unknown | ORPHAN |
| `horario_funcionamento` | unknown | ORPHAN |
| `instrucoes_entrega` | unknown | ORPHAN |
| `ponto_referencia` | unknown | ORPHAN |
| `created_at` | unknown | SYSTEM |
| `updated_at` | unknown | SYSTEM |

</details>

<details><summary><code>contacts</code> — 30% cobertura, 23/37 órfãs, rows: —</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | unknown | SYSTEM |
| `company_id` | unknown | ORPHAN |
| `first_name` | unknown | READ |
| `last_name` | unknown | READ |
| `full_name` | unknown | READ |
| `nome_tratamento` | unknown | ORPHAN |
| `apelido` | unknown | ORPHAN |
| `cargo` | unknown | READ |
| `departamento` | unknown | READ |
| `role` | unknown | READ |
| `cpf` | unknown | ORPHAN |
| `sexo` | unknown | ORPHAN |
| `birthday` | unknown | ORPHAN |
| `data_nascimento` | unknown | ORPHAN |
| `linkedin` | unknown | ORPHAN |
| `instagram` | unknown | READ |
| `notes` | unknown | READ |
| `source` | unknown | READ |
| `sentiment` | unknown | ORPHAN |
| `relationship_score` | unknown | ORPHAN |
| `relationship_stage` | unknown | ORPHAN |
| `behavior` | unknown | ORPHAN |
| `hobbies` | unknown | ORPHAN |
| `interests_array` | unknown | ORPHAN |
| `tags_array` | unknown | ORPHAN |
| `bitrix_contact_id` | unknown | ORPHAN |
| `deleted_at` | unknown | SYSTEM |
| `deleted_by` | unknown | ORPHAN |
| `user_id` | unknown | READ |
| `assigned_by_id` | unknown | ORPHAN |
| `created_at` | unknown | SYSTEM |
| `updated_at` | unknown | SYSTEM |
| `_deprecated_email` | unknown | ORPHAN |
| `_deprecated_phone` | unknown | ORPHAN |
| `_deprecated_whatsapp` | unknown | ORPHAN |
| `emails` | unknown | ORPHAN |
| `phones` | unknown | ORPHAN |

</details>

### Outros

<details><summary><code>contact_emails</code> — 17% cobertura, 5/9 órfãs, rows: — 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | unknown | SYSTEM |
| `contact_id` | unknown | ORPHAN |
| `email` | unknown | READ |
| `email_normalizado` | unknown | ORPHAN |
| `email_type` | unknown | ORPHAN |
| `is_primary` | unknown | ORPHAN |
| `is_verified` | unknown | ORPHAN |
| `created_at` | unknown | SYSTEM |
| `updated_at` | unknown | SYSTEM |

</details>

<details><summary><code>contact_phones</code> — 0% cobertura, 9/12 órfãs, rows: — 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | unknown | SYSTEM |
| `contact_id` | unknown | ORPHAN |
| `numero` | unknown | ORPHAN |
| `numero_normalizado` | unknown | ORPHAN |
| `numero_e164` | unknown | ORPHAN |
| `phone_type` | unknown | ORPHAN |
| `is_primary` | unknown | ORPHAN |
| `is_whatsapp` | unknown | ORPHAN |
| `is_verified` | unknown | ORPHAN |
| `observacao` | unknown | ORPHAN |
| `created_at` | unknown | SYSTEM |
| `updated_at` | unknown | SYSTEM |

</details>

## Avisos / falsos-positivos esperados

- **Colunas usadas só por triggers ou RPCs** aparecem como `ORPHAN`. Confira `pg_proc`/`information_schema.routines` antes de remover.
- **Edge functions internas (cron, webhooks)** podem escrever sem exposição no front — `WRITE` sem `READ` é normal nesses casos.
- **External DB e CRM** foram inferidos a partir dos tipos TS do repo (`src/types/*.ts`); colunas existentes no BD remoto mas ausentes do tipo NÃO aparecem aqui. Para cobertura 100%, adicione operação `introspect` aos bridges.
- **`rows`** reflete o ambiente onde o script rodou. Em sandbox tipicamente é 0; em produção use `npm run audit:db-frontend` no contexto correto.
