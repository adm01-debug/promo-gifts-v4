# Security Allowlists — Documentação Canônica

> **Fonte da verdade** dos allowlists de segurança versionados em `.security/`.
> Este arquivo é referenciado pelo gate `check-allowlist-memory-crosscheck` (CI).
> Toda entrada em allowlist DEVE ter contrapartida documentada aqui — caso contrário, o gate falha.

Última atualização: 2026-07-15

---

## Modelo de acesso

- Plataforma fechada (sem signup público). Todo acesso passa por autenticação Supabase + RBAC via `has_role()` / `is_admin()` / `is_dev()`.
- SECURITY DEFINER em `public` é usado para: (a) helpers RBAC canônicos, (b) agregados públicos anônimos, (c) settings admin com checagem interna, (d) endpoints public_intent via token.
- `anon` NUNCA deve ter EXECUTE em SECURITY DEFINER (gate `secdef-anon`). Exceções documentadas caso a caso.
- Toda função em `public` DEVE declarar `SET search_path = public` (gate `lint-0011`).

## Nunca deve acontecer

- SECURITY DEFINER em `public` executável por `anon` sem justificativa documentada aqui.
- Função em `public` sem `SET search_path` fixo (vetor de search-path injection).
- Nova função RBAC/helper adicionada sem entrada correspondente na allowlist 0029 + rationale aqui.

## Riscos aceitos

### Allowlist 0029 — SECURITY DEFINER exec por signed-in (`authenticated`)

Padrão intencional. As funções abaixo são SECURITY DEFINER executáveis por usuários autenticados por design:

- **RBAC helpers** (`has_role`, `is_admin`, `is_admin_strict`, `is_dev`, `is_manager_or_admin`, `is_supervisor_or_above`, `is_seller_only`, `is_org_member`, `has_org_role`, `get_user_org_ids`, `can_approve_discount`, `can_grant_mcp_full`, `can_manage_connections`, `can_manage_quotes`, `can_view_all_sales`, `can_view_audit_logs`, `can_view_connections`, `can_view_telemetry`, `is_kit_owner`, `is_kit_collaborator`) — padrão canônico Supabase para RLS sem recursão.
- **Quota AI** (`check_ai_quota`) — SELECT FOR UPDATE em `ai_usage_quotas`, precisa de SECURITY DEFINER para evitar race.
- **Painel admin de saúde** (`check_hardening_status`, `check_telemetry_regression`, `get_app_health_summary`, `get_platform_failure_metrics`, `get_auto_test_job_status`, `lookup_request_id`) — leitura agregada com checagem interna de role.
- **Bootstrap de usuário** (`ensure_default_favorite_list`, `log_user_logout`, `restore_seller_cart`) — self-scope via `auth.uid()`.
- **Agregados públicos anônimos** (`get_collections_weekly_count`, `get_favorites_weekly_count`, `get_top_collected_products`, `get_top_compared_products`, `get_top_favorited_products`, `get_industry_benchmark_stats`, `get_industry_top_products`, `get_bundle_suggestions`, `get_client_seasonality`, `get_client_top_products`, `get_user_recent_comparisons`) — não expõem PII; agregados apenas.
- **Settings admin** (`get_connection_failure_window_minutes`, `get_connections_auto_test_interval`, `set_connection_failure_window_minutes`, `set_connections_auto_test_interval`) — checam `is_admin()` internamente.
- **Batch admin** (`execute_role_migration_batch`, `repair_ownership_orphans`) — checam `is_admin_strict()` internamente, com auditoria.
- **Telemetria/logs self** (`log_rls_denial`, `record_dev_route_telemetry`) — insert em tabelas de log com self-scope.
- **Rerank de busca** (`search_records_rerank`) — read-only.

### Allowlist 0011 — Funções sem `SET search_path`

Snapshot atual: **0 entradas**. Qualquer nova função em `public` sem `SET search_path` faz o gate falhar. Adicionar aqui APENAS em casos legítimos (ex: função disparada por trigger que precisa herdar search_path do chamador) com `reason` explícito.

### Allowlist secdef-anon — SECURITY DEFINER exec por `anon`

Snapshot atual: **0 entradas**. Nenhuma função SECURITY DEFINER em `public` está exposta a `anon`. Endpoints public_intent (ex: `favorites-public-react`, `collections-public-react`, `comparisons-public-react`, `quote-public-view`) NÃO usam SECURITY DEFINER — validam token via edge function e usam service_role apenas no backend.

Adicionar entrada aqui exige justificativa forte (endpoint público via token com escopo mínimo) e documentação neste arquivo antes do merge.
