# DB ↔ Frontend Coverage Report

_Gerado em 2026-05-16T00:22:46.056Z por `scripts/audit-db-frontend-coverage.mjs`._

> **Como ler:** para cada coluna, classificamos como `READ`, `WRITE`, `READ+WRITE`, `ORPHAN` ou `SYSTEM`. `ORPHAN` = não encontramos referência no código (`src/`, `supabase/functions/`, `api/`). Pode ser falso-positivo se for usada apenas por triggers/RPCs.

## Sumário executivo

| Banco | Tabelas analisadas | Tabelas excluídas | Colunas | Órfãs | Cobertura média |
|---|---:|---:|---:|---:|---:|
| BD Interno (app) | 129 | 10 | 1383 | 0 | 100% |
| BD Externo (produtos SSOT) | 5 | 0 | 94 | 2 | 97% |
| BD CRM (Bitrix mirror) | 5 | 0 | 137 | 0 | 100% |

## Top 20 tabelas com mais colunas órfãs

| Banco | Tabela | Módulo | Órfãs | Total | Cob. | Rows |
|---|---|---|---:|---:|---:|---:|
| BD Externo (produtos SSOT) | `stock_movements` | Estoque | 2 | 16 | 87% | — |
| BD Interno (app) | `access_security_settings` | Outros | 0 | 9 | 100% | 0 |
| BD Interno (app) | `admin_audit_log` | Auditoria | 0 | 16 | 100% | 0 |
| BD Interno (app) | `admin_settings` | Outros | 0 | 6 | 100% | 0 |
| BD Interno (app) | `ai_insights_cache` | IA & Flow | 0 | 11 | 100% | 0 |
| BD Interno (app) | `ai_usage_events` | IA & Flow | 0 | 6 | 100% | 0 |
| BD Interno (app) | `ai_usage_logs` | IA & Flow | 0 | 13 | 100% | 0 |
| BD Interno (app) | `ai_usage_quotas` | IA & Flow | 0 | 6 | 100% | 0 |
| BD Interno (app) | `app_vitals` | Infra & Observabilidade | 0 | 9 | 100% | 0 |
| BD Interno (app) | `art_file_attachments` | Outros | 0 | 13 | 100% | 0 |
| BD Interno (app) | `audit_logs` | Auditoria | 0 | 6 | 100% | 0 |
| BD Interno (app) | `auth_login_attempts` | Segurança | 0 | 7 | 100% | 0 |
| BD Interno (app) | `bot_detection_log` | Segurança | 0 | 9 | 100% | 0 |
| BD Interno (app) | `cart_templates` | Kits & Carrinhos | 0 | 7 | 100% | 0 |
| BD Interno (app) | `category_icons` | Catálogo / Produtos | 0 | 7 | 100% | 0 |
| BD Interno (app) | `collection_item_reactions` | Coleções | 0 | 8 | 100% | 0 |
| BD Interno (app) | `collection_items` | Coleções | 0 | 11 | 100% | 0 |
| BD Interno (app) | `collection_items_trash` | Coleções | 0 | 13 | 100% | 0 |
| BD Interno (app) | `collections` | Coleções | 0 | 15 | 100% | 0 |
| BD Interno (app) | `comparison_reactions` | Outros | 0 | 8 | 100% | 0 |

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

<details><summary><code>conversation_audit_logs</code> — 100% cobertura, 0/9 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `session_id` | text | READ |
| `user_id` | uuid | READ+WRITE |
| `started_at` | timestamp with time zone | READ+WRITE |
| `ended_at` | timestamp with time zone | READ |
| `total_tokens_estimated` | integer | READ |
| `metadata` | jsonb | READ+WRITE |
| `status` | text | READ+WRITE |
| `client_info` | jsonb | READ |

</details>

<details><summary><code>rls_denial_log</code> — 100% cobertura, 0/16 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `user_email` | text | READ+WRITE |
| `user_role` | text | READ |
| `table_name` | text | READ+WRITE |
| `operation` | text | READ+WRITE |
| `endpoint` | text | READ+WRITE |
| `query_summary` | text | READ |
| `target_id` | uuid | READ |
| `target_seller_id` | uuid | READ |
| `policy_hint` | text | READ |
| `error_code` | text | READ |
| `error_message` | text | READ+WRITE |
| `user_agent` | text | READ+WRITE |
| `ip_address` | inet | READ+WRITE |
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
| `icon` | text | READ+WRITE |
| `description` | text | READ+WRITE |
| `is_active` | boolean | READ+WRITE |
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
| `description` | text | READ+WRITE |
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
| `description` | text | READ+WRITE |
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

<details><summary><code>product_sync_logs</code> — 100% cobertura, 0/12 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `source` | text | READ+WRITE |
| `status` | text | READ+WRITE |
| `records_processed` | integer | READ |
| `records_inserted` | integer | READ |
| `records_updated` | integer | READ |
| `records_failed` | integer | READ |
| `duration_ms` | integer | READ+WRITE |
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

<details><summary><code>collection_item_reactions</code> — 100% cobertura, 0/8 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `collection_id` | uuid | READ+WRITE |
| `item_id` | uuid | READ |
| `anon_id` | text | READ |
| `emoji` | text | READ |
| `ip_hash` | text | READ |
| `user_agent` | text | READ+WRITE |
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

<details><summary><code>collection_items_trash</code> — 100% cobertura, 0/13 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `original_id` | uuid | READ |
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
| `expires_at` | timestamp with time zone | READ+WRITE |

</details>

<details><summary><code>collections</code> — 100% cobertura, 0/15 órfãs, rows: 0</summary>

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
| `is_deleted` | boolean | READ |

</details>

### Estoque

<details><summary><code>optimization_queue</code> — 100% cobertura, 0/14 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `title` | text | READ+WRITE |
| `description` | text | READ+WRITE |
| `category` | text | READ+WRITE |
| `priority` | integer | READ |
| `status` | text | READ+WRITE |
| `result` | jsonb | READ+WRITE |
| `error` | text | READ+WRITE |
| `guardrail_status` | text | READ |
| `started_at` | timestamp with time zone | READ+WRITE |
| `finished_at` | timestamp with time zone | READ+WRITE |
| `created_by` | uuid | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>optimization_queue_runs</code> — 100% cobertura, 0/8 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `queue_id` | uuid | READ |
| `status` | text | READ+WRITE |
| `notes` | text | READ+WRITE |
| `guardrail_status` | text | READ |
| `duration_ms` | integer | READ+WRITE |
| `executed_by` | uuid | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

### Favoritos

<details><summary><code>favorite_item_reactions</code> — 100% cobertura, 0/8 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `item_id` | uuid | READ |
| `list_id` | uuid | READ+WRITE |
| `anon_id` | text | READ |
| `emoji` | text | READ |
| `ip_hash` | text | READ |
| `user_agent` | text | READ+WRITE |
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

<details><summary><code>favorite_items_trash</code> — 100% cobertura, 0/11 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `original_id` | uuid | READ |
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
| `is_default` | boolean | READ+WRITE |
| `is_archived` | boolean | READ |
| `client_id` | text | READ+WRITE |
| `client_name` | text | READ+WRITE |
| `shared_token` | text | READ+WRITE |
| `shared_expires_at` | timestamp with time zone | READ+WRITE |
| `position` | integer | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>favorites</code> — 100% cobertura, 0/7 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `product_id` | text | READ+WRITE |
| `variant_info` | jsonb | READ+WRITE |
| `added_at` | timestamp with time zone | READ |
| `updated_at` | timestamp with time zone | SYSTEM |
| `is_deleted` | boolean | READ |

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
| `role` | USER-DEFINED | READ+WRITE |
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

<details><summary><code>app_vitals</code> — 100% cobertura, 0/9 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `metric_name` | text | READ |
| `metric_value` | numeric | READ |
| `rating` | text | READ |
| `request_id` | text | READ+WRITE |
| `page_url` | text | READ |
| `user_agent` | text | READ+WRITE |
| `user_id` | uuid | READ+WRITE |
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
| `details` | jsonb | READ+WRITE |
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
| `error_kind` | text | READ |
| `retry_count` | integer | READ |
| `cache_hit` | boolean | READ+WRITE |
| `is_cold_start` | boolean | READ |
| `is_503` | boolean | READ |

</details>

<details><summary><code>request_rate_limits</code> — 100% cobertura, 0/8 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `identifier` | text | READ+WRITE |
| `endpoint` | text | READ+WRITE |
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
| `name` | text | READ+WRITE |
| `config` | jsonb | READ+WRITE |
| `secret_refs` | ARRAY | READ |
| `status` | text | READ+WRITE |
| `last_test_at` | timestamp with time zone | READ+WRITE |
| `last_test_ok` | boolean | READ+WRITE |
| `last_test_message` | text | READ+WRITE |
| `created_by` | uuid | READ+WRITE |
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
| `processed` | integer | READ+WRITE |
| `created_count` | integer | READ |
| `updated_count` | integer | READ |
| `status` | text | READ+WRITE |
| `error_message` | text | READ+WRITE |
| `duration_ms` | integer | READ+WRITE |
| `details` | jsonb | READ+WRITE |
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

<details><summary><code>kit_collaborators</code> — 100% cobertura, 0/8 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `kit_id` | uuid | READ+WRITE |
| `user_id` | uuid | READ+WRITE |
| `permission` | text | READ+WRITE |
| `invited_by` | uuid | READ |
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

<details><summary><code>kit_share_tokens</code> — 100% cobertura, 0/11 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `kit_id` | uuid | READ+WRITE |
| `seller_id` | uuid | READ+WRITE |
| `token` | text | READ+WRITE |
| `client_name` | text | READ+WRITE |
| `client_email` | text | READ |
| `status` | text | READ+WRITE |
| `expires_at` | timestamp with time zone | READ+WRITE |
| `viewed_at` | timestamp with time zone | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>kit_templates</code> — 100% cobertura, 0/18 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `name` | text | READ+WRITE |
| `description` | text | READ+WRITE |
| `category` | text | READ+WRITE |
| `color` | text | READ+WRITE |
| `icon` | text | READ+WRITE |
| `tag` | text | READ |
| `cover_image_url` | text | READ |
| `box_data` | jsonb | READ |
| `items_data` | jsonb | READ |
| `personalization_data` | jsonb | READ |
| `total_price` | numeric | READ |
| `volume_usage_percent` | numeric | READ |
| `usage_count` | integer | READ |
| `is_active` | boolean | READ+WRITE |
| `created_by` | uuid | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>kit_variants</code> — 100% cobertura, 0/11 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `kit_master_id` | uuid | READ |
| `label` | text | READ+WRITE |
| `sort_order` | integer | READ+WRITE |
| `box_data` | jsonb | READ |
| `items_data` | jsonb | READ |
| `personalization_data` | jsonb | READ |
| `kit_quantity` | integer | READ+WRITE |
| `total_price` | numeric | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

### MCP & Step-Up

<details><summary><code>mcp_access_violations</code> — 100% cobertura, 0/11 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `reason` | text | READ+WRITE |
| `source` | text | READ+WRITE |
| `operation` | text | READ+WRITE |
| `target_key_id` | uuid | READ |
| `ip_address` | text | READ+WRITE |
| `user_agent` | text | READ+WRITE |
| `request_id` | text | READ+WRITE |
| `details` | jsonb | READ+WRITE |
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
| `last_used_at` | timestamp with time zone | READ+WRITE |
| `expires_at` | timestamp with time zone | READ+WRITE |
| `revoked_at` | timestamp with time zone | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |
| `rotated_from` | uuid | READ+WRITE |

</details>

<details><summary><code>mcp_full_grantors</code> — 100% cobertura, 0/4 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `user_id` | uuid | READ+WRITE |
| `granted_by` | uuid | READ |
| `reason` | text | READ+WRITE |
| `granted_at` | timestamp with time zone | READ |

</details>

<details><summary><code>mcp_key_auto_revocations</code> — 100% cobertura, 0/7 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `key_id` | uuid | READ+WRITE |
| `created_by` | uuid | READ+WRITE |
| `revoked_at` | timestamp with time zone | READ+WRITE |
| `source` | text | READ+WRITE |
| `reason` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>mcp_keys</code> — 100% cobertura, 0/9 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `key_name` | text | READ |
| `key_hash` | text | READ+WRITE |
| `scopes` | ARRAY | READ+WRITE |
| `expires_at` | timestamp with time zone | READ+WRITE |
| `last_used_at` | timestamp with time zone | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `is_revoked` | boolean | READ |

</details>

<details><summary><code>step_up_audit_log</code> — 100% cobertura, 0/11 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `action` | USER-DEFINED | READ+WRITE |
| `target_ref` | text | READ+WRITE |
| `event_type` | text | READ+WRITE |
| `challenge_id` | uuid | READ+WRITE |
| `token_id` | uuid | READ |
| `ip_address` | inet | READ+WRITE |
| `user_agent` | text | READ+WRITE |
| `metadata` | jsonb | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>step_up_challenges</code> — 100% cobertura, 0/14 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `action` | USER-DEFINED | READ+WRITE |
| `target_ref` | text | READ+WRITE |
| `otp_hash` | text | READ |
| `attempts` | smallint | READ |
| `max_attempts` | smallint | READ |
| `password_verified` | boolean | READ |
| `otp_verified` | boolean | READ |
| `consumed` | boolean | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `expires_at` | timestamp with time zone | READ+WRITE |
| `ip_address` | inet | READ+WRITE |
| `user_agent` | text | READ+WRITE |

</details>

<details><summary><code>step_up_tokens</code> — 100% cobertura, 0/10 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `action` | USER-DEFINED | READ+WRITE |
| `target_ref` | text | READ+WRITE |
| `token_hash` | text | READ |
| `challenge_id` | uuid | READ+WRITE |
| `consumed` | boolean | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `expires_at` | timestamp with time zone | READ+WRITE |
| `consumed_at` | timestamp with time zone | READ |

</details>

### Magic Up

<details><summary><code>magic_up_brand_kits</code> — 100% cobertura, 0/15 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `client_id` | text | READ+WRITE |
| `client_name` | text | READ+WRITE |
| `logo_urls` | jsonb | READ |
| `primary_color` | text | READ |
| `secondary_color` | text | READ |
| `tone_of_voice` | text | READ |
| `visual_style` | text | READ |
| `required_words` | ARRAY | READ |
| `forbidden_words` | ARRAY | READ |
| `notes` | text | READ+WRITE |
| `metadata` | jsonb | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>magic_up_campaigns</code> — 100% cobertura, 0/15 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `client_id` | text | READ+WRITE |
| `client_name` | text | READ+WRITE |
| `title` | text | READ+WRITE |
| `objective` | text | READ |
| `channel` | text | READ |
| `audience` | text | READ |
| `tone` | text | READ |
| `cta` | text | READ |
| `occasion` | text | READ |
| `status` | text | READ+WRITE |
| `metadata` | jsonb | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>magic_up_comments</code> — 100% cobertura, 0/7 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `generation_id` | uuid | READ |
| `author_name` | text | READ |
| `comment` | text | READ |
| `is_public` | boolean | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>magic_up_generations</code> — 100% cobertura, 0/22 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `product_name` | text | READ+WRITE |
| `scene_title` | text | READ |
| `scene_category` | text | READ |
| `client_name` | text | READ+WRITE |
| `generated_image_url` | text | READ |
| `is_favorite` | boolean | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `campaign_id` | uuid | READ |
| `product_id` | text | READ+WRITE |
| `product_sku` | text | READ+WRITE |
| `prompt_text` | text | READ+WRITE |
| `model` | text | READ+WRITE |
| `channel` | text | READ |
| `aspect_ratio` | text | READ |
| `quality_score` | integer | READ+WRITE |
| `status` | text | READ+WRITE |
| `tags` | ARRAY | READ |
| `metadata` | jsonb | READ+WRITE |
| `copy_pack` | jsonb | READ |
| `export_presets` | jsonb | READ |

</details>

<details><summary><code>magic_up_public_shares</code> — 100% cobertura, 0/12 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `generation_id` | uuid | READ |
| `campaign_id` | uuid | READ |
| `share_token` | text | READ+WRITE |
| `expires_at` | timestamp with time zone | READ+WRITE |
| `allow_download` | boolean | READ |
| `allow_comments` | boolean | READ |
| `status` | text | READ+WRITE |
| `metadata` | jsonb | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>magic_up_reactions</code> — 100% cobertura, 0/7 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `generation_id` | uuid | READ |
| `reaction_type` | text | READ |
| `ip_hash` | text | READ |
| `user_agent` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

### Mockups

<details><summary><code>mockup_drafts</code> — 100% cobertura, 0/13 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `draft_key` | text | READ+WRITE |
| `product_id` | text | READ+WRITE |
| `product_name` | text | READ+WRITE |
| `technique_id` | text | READ+WRITE |
| `technique_name` | text | READ+WRITE |
| `client_id` | text | READ+WRITE |
| `client_name` | text | READ+WRITE |
| `personalization_areas` | jsonb | READ+WRITE |
| `logo_data` | text | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>mockup_prompt_configs</code> — 100% cobertura, 0/10 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `config_key` | text | READ+WRITE |
| `label` | text | READ+WRITE |
| `prompt_text` | text | READ+WRITE |
| `ai_model` | text | READ+WRITE |
| `technique_id` | uuid | READ+WRITE |
| `is_active` | boolean | READ+WRITE |
| `version` | integer | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>mockup_prompt_history</code> — 100% cobertura, 0/10 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `config_id` | uuid | READ+WRITE |
| `config_key` | text | READ+WRITE |
| `old_prompt` | text | READ |
| `new_prompt` | text | READ |
| `ai_model` | text | READ+WRITE |
| `version` | integer | READ+WRITE |
| `changed_by` | uuid | READ+WRITE |
| `change_notes` | text | READ+WRITE |
| `changed_at` | timestamp with time zone | READ |

</details>

<details><summary><code>mockup_templates</code> — 100% cobertura, 0/14 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `name` | text | READ+WRITE |
| `description` | text | READ+WRITE |
| `product_id` | text | READ+WRITE |
| `product_name` | text | READ+WRITE |
| `technique_id` | text | READ+WRITE |
| `technique_name` | text | READ+WRITE |
| `personalization_areas` | jsonb | READ+WRITE |
| `thumbnail_url` | text | READ+WRITE |
| `usage_count` | integer | READ |
| `is_favorite` | boolean | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

### Orçamentos

<details><summary><code>quote_approval_tokens</code> — 100% cobertura, 0/20 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `quote_id` | text | READ+WRITE |
| `token` | text | READ+WRITE |
| `seller_id` | uuid | READ+WRITE |
| `client_name` | text | READ+WRITE |
| `client_email` | text | READ |
| `status` | text | READ+WRITE |
| `expires_at` | timestamp with time zone | READ+WRITE |
| `viewed_at` | timestamp with time zone | READ |
| `responded_at` | timestamp with time zone | READ+WRITE |
| `response` | text | READ+WRITE |
| `response_notes` | text | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |
| `signer_name` | text | READ |
| `signer_document` | text | READ |
| `signer_ip` | text | READ |
| `signer_user_agent` | text | READ |
| `signature_hash` | text | READ |
| `signed_at` | timestamp with time zone | READ |

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

<details><summary><code>quote_drafts</code> — 100% cobertura, 0/4 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `data` | jsonb | READ+WRITE |
| `last_saved_at` | timestamp with time zone | READ |

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
| `technique_id` | text | READ+WRITE |
| `technique_name` | text | READ+WRITE |
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

<details><summary><code>quote_items</code> — 100% cobertura, 0/21 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `quote_id` | uuid | READ+WRITE |
| `product_id` | text | READ+WRITE |
| `product_name` | text | READ+WRITE |
| `product_sku` | text | READ+WRITE |
| `product_image_url` | text | READ+WRITE |
| `quantity` | integer | READ+WRITE |
| `unit_price` | numeric | READ |
| `subtotal` | numeric | READ+WRITE |
| `color_name` | text | READ+WRITE |
| `color_hex` | text | READ+WRITE |
| `notes` | text | READ+WRITE |
| `sort_order` | integer | READ+WRITE |
| `display_order` | integer | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |
| `kit_group_id` | text | READ |
| `kit_name` | text | READ |
| `size_code` | text | READ |
| `gender` | text | READ |
| `price_confirmed_at` | timestamp with time zone | READ |

</details>

<details><summary><code>quote_templates</code> — 100% cobertura, 0/16 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `seller_id` | uuid | READ+WRITE |
| `name` | text | READ+WRITE |
| `description` | text | READ+WRITE |
| `is_default` | boolean | READ+WRITE |
| `template_data` | jsonb | READ |
| `items_data` | jsonb | READ |
| `discount_percent` | numeric | READ |
| `discount_amount` | numeric | READ |
| `notes` | text | READ+WRITE |
| `internal_notes` | text | READ |
| `payment_terms` | text | READ |
| `delivery_time` | text | READ |
| `validity_days` | integer | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>quotes</code> — 100% cobertura, 0/38 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `quote_number` | text | READ+WRITE |
| `client_id` | text | READ+WRITE |
| `client_name` | text | READ+WRITE |
| `client_email` | text | READ |
| `client_phone` | text | READ |
| `client_company` | text | READ |
| `client_cnpj` | text | READ |
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
| `internal_notes` | text | READ |
| `valid_until` | timestamp with time zone | READ |
| `bitrix_deal_id` | text | READ |
| `bitrix_quote_id` | text | READ |
| `synced_to_bitrix` | boolean | READ+WRITE |
| `synced_at` | timestamp with time zone | READ+WRITE |
| `client_response` | text | READ |
| `client_response_at` | timestamp with time zone | READ |
| `client_response_notes` | text | READ |
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

<details><summary><code>access_security_settings</code> — 100% cobertura, 0/9 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `ip_whitelist_enabled` | boolean | READ |
| `city_whitelist_enabled` | boolean | READ |
| `block_unknown_locations` | boolean | READ |
| `max_failed_attempts` | integer | READ |
| `lockout_duration_minutes` | integer | READ |
| `strict_access_mode` | boolean | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>admin_settings</code> — 100% cobertura, 0/6 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `key` | text | READ+WRITE |
| `value` | jsonb | READ+WRITE |
| `updated_by` | uuid | READ+WRITE |
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
| `notes` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>comparison_reactions</code> — 100% cobertura, 0/8 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `comparison_id` | uuid | READ |
| `item_index` | integer | READ |
| `emoji` | text | READ |
| `anon_id` | text | READ |
| `ip_hash` | text | READ |
| `user_agent` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>component_media</code> — 100% cobertura, 0/10 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `component_id` | text | READ+WRITE |
| `product_id` | text | READ+WRITE |
| `media_type` | text | READ |
| `url` | text | READ+WRITE |
| `title` | text | READ+WRITE |
| `sort_order` | integer | READ+WRITE |
| `is_cover` | boolean | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>conversation_delivery_status</code> — 100% cobertura, 0/5 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `event_id` | uuid | READ |
| `status` | text | READ+WRITE |
| `error_details` | text | READ |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>conversation_event_history</code> — 100% cobertura, 0/10 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `conversation_id` | uuid | READ+WRITE |
| `role` | text | READ+WRITE |
| `event_type` | USER-DEFINED | READ+WRITE |
| `content` | text | READ+WRITE |
| `media_url` | text | READ |
| `media_metadata` | jsonb | READ |
| `tokens_estimated` | integer | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `request_id` | uuid | READ+WRITE |

</details>

<details><summary><code>custom_kits</code> — 100% cobertura, 0/23 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `name` | text | READ+WRITE |
| `status` | text | READ+WRITE |
| `box_data` | jsonb | READ |
| `items_data` | jsonb | READ |
| `personalization_data` | jsonb | READ |
| `kit_quantity` | integer | READ+WRITE |
| `box_price` | numeric | READ |
| `items_price` | numeric | READ |
| `personalization_price` | numeric | READ |
| `total_price` | numeric | READ |
| `volume_usage_percent` | numeric | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |
| `kit_type` | text | READ |
| `color` | text | READ+WRITE |
| `tag` | text | READ |
| `icon` | text | READ+WRITE |
| `description` | text | READ+WRITE |
| `is_favorite` | boolean | READ+WRITE |
| `last_used_at` | timestamp with time zone | READ+WRITE |
| `is_pinned` | boolean | READ+WRITE |

</details>

<details><summary><code>e2e_cleanup_audit</code> — 100% cobertura, 0/16 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `email` | text | READ+WRITE |
| `user_id` | uuid | READ+WRITE |
| `dry_run` | boolean | READ |
| `status` | text | READ+WRITE |
| `reason` | text | READ+WRITE |
| `ip` | text | READ+WRITE |
| `user_agent` | text | READ+WRITE |
| `total_deleted` | integer | READ |
| `deleted_by_table` | jsonb | READ |
| `errors` | jsonb | READ+WRITE |
| `duration_ms` | integer | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `seller_scope` | text | READ |
| `seller_id` | uuid | READ+WRITE |
| `name_filter_prefix` | text | READ |

</details>

<details><summary><code>e2e_cleanup_rate_limit</code> — 100% cobertura, 0/4 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `key` | text | READ+WRITE |
| `count` | integer | READ+WRITE |
| `window_start` | timestamp with time zone | READ |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>follow_up_reminders</code> — 100% cobertura, 0/12 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `quote_id` | text | READ+WRITE |
| `seller_id` | uuid | READ+WRITE |
| `reminder_type` | text | READ |
| `scheduled_for` | timestamp with time zone | READ |
| `is_sent` | boolean | READ |
| `sent_at` | timestamp with time zone | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `title` | text | READ+WRITE |
| `notes` | text | READ+WRITE |
| `is_completed` | boolean | READ |
| `completed_at` | timestamp with time zone | READ+WRITE |

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
| `position_y` | numeric | READ |
| `logo_width_cm` | numeric | READ |
| `logo_height_cm` | numeric | READ |
| `location_name` | text | READ+WRITE |
| `colors_count` | integer | READ |
| `annotations` | jsonb | READ |
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
| `details` | jsonb | READ+WRITE |
| `triggered_by` | text | READ |
| `duration_ms` | integer | READ+WRITE |
| `rls_coverage` | jsonb | READ |
| `rls_gaps_count` | integer | READ |

</details>

<details><summary><code>ownership_repair_logs</code> — 100% cobertura, 0/13 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `report_id` | uuid | READ |
| `table_name` | text | READ+WRITE |
| `owner_column` | text | READ |
| `issue_type` | text | READ |
| `action` | text | READ+WRITE |
| `rows_affected` | integer | READ |
| `dry_run` | boolean | READ |
| `triggered_by` | uuid | READ |
| `triggered_by_label` | text | READ |
| `notes` | text | READ+WRITE |
| `error_message` | text | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>recently_viewed_products</code> — 100% cobertura, 0/4 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `product_id` | text | READ+WRITE |
| `viewed_at` | timestamp with time zone | READ |

</details>

<details><summary><code>system_settings</code> — 100% cobertura, 0/4 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `key` | text | READ+WRITE |
| `value` | jsonb | READ+WRITE |
| `updated_at` | timestamp with time zone | SYSTEM |
| `updated_by` | uuid | READ+WRITE |

</details>

<details><summary><code>v_full_scope_grants</code> — 100% cobertura, 0/18 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `audit_id` | uuid | READ |
| `granted_at` | timestamp with time zone | READ |
| `granted_to_user_id` | uuid | READ |
| `granted_to_name` | text | READ |
| `granted_to_email` | character varying | READ |
| `step_up_action` | USER-DEFINED | READ |
| `operation` | text | READ+WRITE |
| `key_id` | uuid | READ+WRITE |
| `key_prefix` | text | READ+WRITE |
| `key_expires_at` | timestamp with time zone | READ |
| `justification` | text | READ+WRITE |
| `challenge_id` | uuid | READ+WRITE |
| `token_id` | uuid | READ |
| `ip_address` | inet | READ+WRITE |
| `user_agent` | text | READ+WRITE |
| `request_id` | text | READ+WRITE |
| `verifications_applied` | jsonb | READ |
| `extra` | jsonb | READ+WRITE |

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
| `duration_ms` | integer | READ+WRITE |
| `success` | boolean | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

### Pedidos

<details><summary><code>order_item_personalizations</code> — 100% cobertura, 0/11 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `order_item_id` | uuid | READ |
| `technique_id` | uuid | READ+WRITE |
| `technique_name` | text | READ+WRITE |
| `location_id` | uuid | READ |
| `location_name` | text | READ+WRITE |
| `image_url` | text | READ |
| `personalization_text` | text | READ |
| `price_adjustment` | numeric | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>order_items</code> — 100% cobertura, 0/18 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `order_id` | uuid | READ |
| `product_id` | text | READ+WRITE |
| `product_sku` | text | READ+WRITE |
| `product_name` | text | READ+WRITE |
| `product_image_url` | text | READ+WRITE |
| `quantity` | integer | READ+WRITE |
| `unit_price` | numeric | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `organization_id` | uuid | READ |
| `total_price` | numeric | READ |
| `color_name` | text | READ+WRITE |
| `color_hex` | text | READ+WRITE |
| `notes` | text | READ+WRITE |
| `size_code` | text | READ |
| `gender` | text | READ |
| `kit_group_id` | uuid | READ |
| `kit_name` | text | READ |

</details>

<details><summary><code>orders</code> — 100% cobertura, 0/25 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `seller_id` | uuid | READ+WRITE |
| `order_number` | text | READ |
| `status` | text | READ+WRITE |
| `fulfillment_status` | text | READ |
| `client_id` | text | READ+WRITE |
| `client_name` | text | READ+WRITE |
| `client_email` | text | READ |
| `client_phone` | text | READ |
| `client_company` | text | READ |
| `quote_id` | uuid | READ+WRITE |
| `subtotal` | numeric | READ+WRITE |
| `discount_amount` | numeric | READ |
| `shipping_cost` | numeric | READ |
| `total` | numeric | READ+WRITE |
| `notes` | text | READ+WRITE |
| `internal_notes` | text | READ |
| `tracking_number` | text | READ |
| `shipping_type` | text | READ |
| `payment_terms` | text | READ |
| `delivery_time` | text | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |
| `organization_id` | uuid | READ |
| `version` | integer | READ+WRITE |

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

<details><summary><code>price_history</code> — 100% cobertura, 0/5 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `product_id` | text | READ+WRITE |
| `variant_id` | text | READ+WRITE |
| `price` | numeric | READ |
| `recorded_at` | timestamp with time zone | READ |

</details>

### SEO & Busca

<details><summary><code>search_analytics</code> — 100% cobertura, 0/6 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `search_term` | text | READ+WRITE |
| `results_count` | integer | READ |
| `search_context` | text | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

### Segurança

<details><summary><code>auth_login_attempts</code> — 100% cobertura, 0/7 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `email` | text | READ+WRITE |
| `ip_address` | text | READ+WRITE |
| `success` | boolean | READ+WRITE |
| `failure_reason` | text | READ+WRITE |
| `user_agent` | text | READ+WRITE |
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
| `user_id` | uuid | READ+WRITE |
| `bucket` | character varying | READ |
| `path` | text | READ+WRITE |
| `hash` | character varying | READ+WRITE |
| `scan_result` | jsonb | READ+WRITE |
| `status_code` | integer | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>geo_allowed_countries</code> — 100% cobertura, 0/6 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `country_code` | character | READ+WRITE |
| `country_name` | text | READ |
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

<details><summary><code>public_token_failures</code> — 100% cobertura, 0/8 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `resource_type` | text | READ+WRITE |
| `resource_id` | text | READ+WRITE |
| `attempted_token` | text | READ |
| `ip_address` | text | READ+WRITE |
| `user_agent` | text | READ+WRITE |
| `reason` | text | READ+WRITE |
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

<details><summary><code>organization_members</code> — 100% cobertura, 0/8 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `organization_id` | uuid | READ |
| `user_id` | uuid | READ+WRITE |
| `role` | USER-DEFINED | READ+WRITE |
| `invited_by` | uuid | READ |
| `joined_at` | timestamp with time zone | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>organizations</code> — 100% cobertura, 0/9 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `name` | text | READ+WRITE |
| `slug` | text | READ+WRITE |
| `logo_url` | text | READ+WRITE |
| `description` | text | READ+WRITE |
| `is_active` | boolean | READ+WRITE |
| `settings` | jsonb | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>permissions</code> — 100% cobertura, 0/7 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `code` | text | READ+WRITE |
| `name` | text | READ+WRITE |
| `description` | text | READ+WRITE |
| `category` | text | READ+WRITE |
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
| `label` | text | READ+WRITE |
| `reason` | text | READ+WRITE |
| `initiated_by` | uuid | READ |
| `dry_run` | boolean | READ |
| `status` | USER-DEFINED | READ+WRITE |
| `total_items` | integer | READ |
| `success_count` | integer | READ |
| `failed_count` | integer | READ |
| `skipped_count` | integer | READ |
| `started_at` | timestamp with time zone | READ+WRITE |
| `finished_at` | timestamp with time zone | READ+WRITE |
| `duration_ms` | integer | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>role_migration_items</code> — 100% cobertura, 0/12 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `batch_id` | uuid | READ |
| `user_id` | uuid | READ+WRITE |
| `user_email` | text | READ+WRITE |
| `from_role` | USER-DEFINED | READ |
| `to_role` | USER-DEFINED | READ |
| `operation` | text | READ+WRITE |
| `status` | USER-DEFINED | READ+WRITE |
| `error_message` | text | READ+WRITE |
| `duration_ms` | integer | READ+WRITE |
| `processed_at` | timestamp with time zone | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>role_permissions</code> — 100% cobertura, 0/4 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `role` | USER-DEFINED | READ+WRITE |
| `permission_code` | text | READ |
| `created_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>user_comparisons</code> — 100% cobertura, 0/12 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `client_id` | text | READ+WRITE |
| `client_name` | text | READ+WRITE |
| `name` | text | READ+WRITE |
| `items` | jsonb | READ+WRITE |
| `share_token` | text | READ+WRITE |
| `is_public` | boolean | READ+WRITE |
| `share_expires_at` | timestamp with time zone | READ+WRITE |
| `view_count` | integer | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>user_known_devices</code> — 100% cobertura, 0/6 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `fingerprint` | text | READ+WRITE |
| `device_name` | text | READ |
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
| `started_at` | timestamp with time zone | READ+WRITE |
| `completed_at` | timestamp with time zone | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>user_preferences</code> — 100% cobertura, 0/7 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `comparison_weights` | jsonb | READ+WRITE |
| `comparison_column_order` | jsonb | READ |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |
| `filter_states` | jsonb | READ |

</details>

<details><summary><code>user_roles</code> — 100% cobertura, 0/3 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `role` | USER-DEFINED | READ+WRITE |

</details>

<details><summary><code>user_search_history</code> — 100% cobertura, 0/9 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `user_id` | uuid | READ+WRITE |
| `query_text` | text | READ |
| `history_type` | text | READ |
| `result_count` | integer | READ |
| `is_pinned` | boolean | READ+WRITE |
| `metadata` | jsonb | READ+WRITE |
| `created_at` | timestamp with time zone | SYSTEM |
| `updated_at` | timestamp with time zone | SYSTEM |

</details>

<details><summary><code>user_token_revocations</code> — 100% cobertura, 0/2 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `user_id` | uuid | READ+WRITE |
| `revoked_at` | timestamp with time zone | READ+WRITE |

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
| `triggered_by` | text | READ |
| `error_kind` | text | READ |
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
| `attempts` | smallint | READ |

</details>

<details><summary><code>inbound_webhook_endpoints</code> — 100% cobertura, 0/14 órfãs, rows: 0</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `slug` | text | READ+WRITE |
| `name` | text | READ+WRITE |
| `source_system` | text | READ+WRITE |
| `hmac_secret_ref` | text | READ+WRITE |
| `allowed_events` | ARRAY | READ |
| `active` | boolean | READ+WRITE |
| `description` | text | READ+WRITE |
| `created_by` | uuid | READ+WRITE |
| `last_received_at` | timestamp with time zone | READ+WRITE |
| `total_received` | integer | READ |
| `total_invalid` | integer | READ |
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
| `description` | text | READ+WRITE |
| `created_by` | uuid | READ+WRITE |
| `last_triggered_at` | timestamp with time zone | READ+WRITE |
| `total_success` | integer | READ |
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

<details><summary><code>webhook_delivery_metrics</code> — 100% cobertura, 0/15 órfãs, rows: 0 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | uuid | SYSTEM |
| `request_id` | text | READ+WRITE |
| `event_type` | text | READ+WRITE |
| `source` | text | READ+WRITE |
| `direction` | text | READ |
| `endpoint` | text | READ+WRITE |
| `http_status` | integer | READ |
| `duration_ms` | integer | READ+WRITE |
| `attempt` | integer | READ+WRITE |
| `success` | boolean | READ+WRITE |
| `error_class` | text | READ |
| `error_message` | text | READ+WRITE |
| `payload_bytes` | integer | READ |
| `metadata` | jsonb | READ+WRITE |
| `occurred_at` | timestamp with time zone | READ |

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

<details><summary><code>product_colors_view</code> — 100% cobertura, 0/8 órfãs, rows: — 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `name` | unknown | READ+WRITE |
| `hex` | unknown | READ |
| `group` | unknown | READ |
| `groupSlug` | unknown | READ |
| `variationSlug` | unknown | READ |
| `code` | unknown | READ+WRITE |
| `image` | unknown | READ |
| `images` | unknown | READ |

</details>

<details><summary><code>products</code> — 100% cobertura, 0/49 órfãs, rows: —</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | unknown | SYSTEM |
| `sku` | unknown | READ+WRITE |
| `name` | unknown | READ+WRITE |
| `description` | unknown | READ+WRITE |
| `short_description` | unknown | READ |
| `category_name` | unknown | READ |
| `brand` | unknown | READ |
| `sale_price` | unknown | READ |
| `base_price` | unknown | READ |
| `cost_price` | unknown | READ |
| `stock_quantity` | unknown | READ |
| `is_bestseller` | unknown | READ |
| `is_new` | unknown | READ |
| `is_kit` | unknown | READ |
| `supplier_code` | unknown | READ+WRITE |
| `supplier_name` | unknown | READ |
| `image_url` | unknown | READ |
| `videos` | unknown | READ |
| `category_id` | unknown | READ |
| `price` | unknown | READ |
| `og_image_url` | unknown | READ |
| `images` | unknown | READ |
| `stock` | unknown | READ |
| `created_at` | unknown | SYSTEM |
| `updated_at` | unknown | SYSTEM |
| `colors` | unknown | READ |
| `materials` | unknown | READ |
| `supplier_reference` | unknown | READ |
| `is_active` | unknown | READ+WRITE |
| `minQuantity` | unknown | READ |
| `dimensions` | unknown | READ |
| `height_cm` | unknown | READ |
| `width_cm` | unknown | READ |
| `length_cm` | unknown | READ |
| `diameter_cm` | unknown | READ |
| `weight_g` | unknown | READ |
| `capacity_ml` | unknown | READ |
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

<details><summary><code>stock_movements</code> — 87% cobertura, 2/16 órfãs, rows: — 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | unknown | SYSTEM |
| `productId` | unknown | READ+WRITE |
| `variantId` | unknown | READ+WRITE |
| `colorName` | unknown | READ |
| `type` | unknown | READ+WRITE |
| `quantity` | unknown | READ+WRITE |
| `previousStock` | unknown | READ |
| `newStock` | unknown | READ |
| `reason` | unknown | READ+WRITE |
| `reference` | unknown | READ |
| `referenceType` | unknown | ORPHAN |
| `unitCost` | unknown | READ |
| `totalCost` | unknown | READ |
| `createdAt` | unknown | READ |
| `createdBy` | unknown | READ+WRITE |
| `createdByName` | unknown | ORPHAN |

</details>

### Outros

<details><summary><code>print_areas</code> — 100% cobertura, 0/8 órfãs, rows: — 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | unknown | SYSTEM |
| `component_name` | unknown | READ+WRITE |
| `location_name` | unknown | READ+WRITE |
| `width_cm` | unknown | READ |
| `height_cm` | unknown | READ |
| `unit` | unknown | READ |
| `is_primary` | unknown | READ |
| `allowed_technique_ids` | unknown | READ |

</details>

<details><summary><code>tecnicas_gravacao</code> — 100% cobertura, 0/13 órfãs, rows: — 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | unknown | SYSTEM |
| `name` | unknown | READ+WRITE |
| `technique_name` | unknown | READ+WRITE |
| `code` | unknown | READ+WRITE |
| `technique_code` | unknown | READ |
| `setup_cost` | unknown | READ |
| `setup_price` | unknown | READ |
| `unit_cost` | unknown | READ |
| `handling_price` | unknown | READ |
| `max_colors` | unknown | READ+WRITE |
| `min_area_cm2` | unknown | READ |
| `max_area_cm2` | unknown | READ+WRITE |
| `sla_days` | unknown | READ |

</details>

## BD CRM (Bitrix mirror)

### CRM

<details><summary><code>companies</code> — 100% cobertura, 0/58 órfãs, rows: —</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | unknown | SYSTEM |
| `razao_social` | unknown | READ |
| `nome_fantasia` | unknown | READ |
| `title` | unknown | READ+WRITE |
| `cnpj` | unknown | READ |
| `ramo_atividade` | unknown | READ |
| `status` | unknown | READ+WRITE |
| `source` | unknown | READ+WRITE |
| `is_customer` | unknown | READ |
| `is_supplier` | unknown | READ |
| `is_carrier` | unknown | READ |
| `is_matriz` | unknown | READ |
| `logradouro` | unknown | READ |
| `numero` | unknown | READ |
| `complemento` | unknown | READ |
| `bairro` | unknown | READ |
| `cidade` | unknown | READ |
| `estado` | unknown | READ |
| `cep` | unknown | READ |
| `pais` | unknown | READ |
| `endereco` | unknown | READ |
| `endereco_faturamento` | unknown | READ |
| `inscricao_estadual` | unknown | READ |
| `inscricao_municipal` | unknown | READ |
| `cnae_principal` | unknown | READ |
| `cnae_descricao` | unknown | READ |
| `website` | unknown | READ |
| `instagram` | unknown | READ |
| `facebook` | unknown | READ |
| `linkedin` | unknown | READ |
| `logo_url` | unknown | READ+WRITE |
| `grupo_economico` | unknown | READ |
| `grupo_economico_id` | unknown | READ |
| `matriz_id` | unknown | READ |
| `central_id` | unknown | READ |
| `singular_id` | unknown | READ |
| `tipo_cooperativa` | unknown | READ |
| `employee_count` | unknown | READ |
| `annual_revenue` | unknown | READ |
| `financial_health` | unknown | READ |
| `bitrix_company_id` | unknown | READ |
| `bitrix_created_at` | unknown | READ |
| `bitrix_updated_at` | unknown | READ |
| `_deprecated_email` | unknown | READ |
| `_deprecated_phone` | unknown | READ |
| `_deprecated_phone_secondary` | unknown | READ |
| `tags_array` | unknown | READ |
| `challenges` | unknown | READ |
| `competitors` | unknown | READ |
| `search_vector` | unknown | READ |
| `deleted_at` | unknown | SYSTEM |
| `deleted_by` | unknown | READ |
| `user_id` | unknown | READ+WRITE |
| `assigned_by_id` | unknown | READ |
| `created_by_id` | unknown | READ |
| `merge_notes` | unknown | READ |
| `created_at` | unknown | SYSTEM |
| `updated_at` | unknown | SYSTEM |

</details>

<details><summary><code>company_addresses</code> — 100% cobertura, 0/21 órfãs, rows: — 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | unknown | SYSTEM |
| `company_id` | unknown | READ+WRITE |
| `tipo` | unknown | READ |
| `is_primary` | unknown | READ |
| `logradouro` | unknown | READ |
| `numero` | unknown | READ |
| `complemento` | unknown | READ |
| `bairro` | unknown | READ |
| `cidade` | unknown | READ |
| `estado` | unknown | READ |
| `cep` | unknown | READ |
| `pais` | unknown | READ |
| `google_maps_url` | unknown | READ |
| `google_place_id` | unknown | READ |
| `latitude` | unknown | READ |
| `longitude` | unknown | READ |
| `horario_funcionamento` | unknown | READ |
| `instrucoes_entrega` | unknown | READ |
| `ponto_referencia` | unknown | READ |
| `created_at` | unknown | SYSTEM |
| `updated_at` | unknown | SYSTEM |

</details>

<details><summary><code>contacts</code> — 100% cobertura, 0/37 órfãs, rows: —</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | unknown | SYSTEM |
| `company_id` | unknown | READ+WRITE |
| `first_name` | unknown | READ |
| `last_name` | unknown | READ |
| `full_name` | unknown | READ+WRITE |
| `nome_tratamento` | unknown | READ |
| `apelido` | unknown | READ |
| `cargo` | unknown | READ |
| `departamento` | unknown | READ |
| `role` | unknown | READ+WRITE |
| `cpf` | unknown | READ |
| `sexo` | unknown | READ |
| `birthday` | unknown | READ |
| `data_nascimento` | unknown | READ |
| `linkedin` | unknown | READ |
| `instagram` | unknown | READ |
| `notes` | unknown | READ+WRITE |
| `source` | unknown | READ+WRITE |
| `sentiment` | unknown | READ |
| `relationship_score` | unknown | READ |
| `relationship_stage` | unknown | READ |
| `behavior` | unknown | READ |
| `hobbies` | unknown | READ |
| `interests_array` | unknown | READ |
| `tags_array` | unknown | READ |
| `bitrix_contact_id` | unknown | READ |
| `deleted_at` | unknown | SYSTEM |
| `deleted_by` | unknown | READ |
| `user_id` | unknown | READ+WRITE |
| `assigned_by_id` | unknown | READ |
| `created_at` | unknown | SYSTEM |
| `updated_at` | unknown | SYSTEM |
| `_deprecated_email` | unknown | READ |
| `_deprecated_phone` | unknown | READ |
| `_deprecated_whatsapp` | unknown | READ |
| `emails` | unknown | READ |
| `phones` | unknown | READ |

</details>

### Outros

<details><summary><code>contact_emails</code> — 100% cobertura, 0/9 órfãs, rows: — 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | unknown | SYSTEM |
| `contact_id` | unknown | READ |
| `email` | unknown | READ+WRITE |
| `email_normalizado` | unknown | READ |
| `email_type` | unknown | READ |
| `is_primary` | unknown | READ |
| `is_verified` | unknown | READ |
| `created_at` | unknown | SYSTEM |
| `updated_at` | unknown | SYSTEM |

</details>

<details><summary><code>contact_phones</code> — 100% cobertura, 0/12 órfãs, rows: — 🚫 _(tabela não referenciada no código)_</summary>

| Coluna | Tipo | Status |
|---|---|---|
| `id` | unknown | SYSTEM |
| `contact_id` | unknown | READ |
| `numero` | unknown | READ |
| `numero_normalizado` | unknown | READ |
| `numero_e164` | unknown | READ |
| `phone_type` | unknown | READ |
| `is_primary` | unknown | READ |
| `is_whatsapp` | unknown | READ |
| `is_verified` | unknown | READ |
| `observacao` | unknown | READ |
| `created_at` | unknown | SYSTEM |
| `updated_at` | unknown | SYSTEM |

</details>

## Avisos / falsos-positivos esperados

- **Colunas usadas só por triggers ou RPCs** aparecem como `ORPHAN`. Confira `pg_proc`/`information_schema.routines` antes de remover.
- **Edge functions internas (cron, webhooks)** podem escrever sem exposição no front — `WRITE` sem `READ` é normal nesses casos.
- **External DB e CRM** foram inferidos a partir dos tipos TS do repo (`src/types/*.ts`); colunas existentes no BD remoto mas ausentes do tipo NÃO aparecem aqui. Para cobertura 100%, adicione operação `introspect` aos bridges.
- **`rows`** reflete o ambiente onde o script rodou. Em sandbox tipicamente é 0; em produção use `npm run audit:db-frontend` no contexto correto.
