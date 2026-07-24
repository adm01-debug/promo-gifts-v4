# ONDA — Hardening de Identidade & Guardrails de Schema (2026-06-26)

Sessão de hardening do banco `doufsxqlfjyuvxuezpln`, focada na cadeia de identidade
(`profiles` ↔ `user_roles` ↔ `auth.users`) e em invariantes de integridade do domínio
Orçamento/Desconto. Toda mudança foi precedida de simulação e validada.

## Mudanças aplicadas (no histórico de migrations do Supabase)

| version | migration | efeito |
| --- | --- | --- |
| 20260626161404 | `fix_user_identity_linkage_and_postgrest_embeds` | backfill de `profiles.user_id`; FK `user_roles.user_id→profiles`; FK `discount_approval_requests.seller_id→profiles`; reload PostgREST |
| 20260626162308 | `sweep_fk_orcamento_para_profiles` | 6 colunas de exibição repontadas `auth.users`→`profiles(user_id)`, 1 FK por coluna (sem ambiguidade de embed) |
| 20260626163054 | `role_single_source_sync_mapped_en` | `user_roles` = fonte única de `role`; `profiles.role` = espelho derivado (vocabulário EN) via `fn_map_role_enum_to_profile` + trigger `user_roles_sync_profile_role` |
| 20260626170757 | `fix_notnull_fk_setnull_contradictions` | `products.category_id/supplier_id`, `quote_history.user_id`, `quotes.seller_id`: `ON DELETE SET NULL`→`NO ACTION` (corrige contradição `NOT NULL`+`SET NULL`) |

### Frontend (commits na main)
- `useSellerDiscountLimits.setLimit`: guard de `userId` ausente (evita `23502`).
- `MfaChallengeDialog`: trava anti double-submit (`useRef` + flag `verified`) — evita `422`.

## Guardrails de schema (invariantes — para wire em CI)

Cada query deve retornar **0 linhas**. Qualquer linha = violação → falha o gate.

### G1 — Colunas de pessoa do domínio Orçamento apontam para `profiles`, não `auth.users`
```sql
SELECT t.relname||'.'||a.attname AS violacao
FROM pg_constraint c
JOIN pg_class t ON t.oid=c.conrelid
JOIN pg_class f ON f.oid=c.confrelid
JOIN pg_namespace fn ON fn.oid=f.relnamespace
JOIN LATERAL unnest(c.conkey) ck(an) ON true
JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=ck.an
WHERE c.contype='f' AND fn.nspname='auth' AND f.relname='users'
  AND (t.relname,a.attname) IN (
    ('quotes','seller_id'),('quotes','created_by'),('quotes','assigned_to'),
    ('discount_approval_requests','seller_id'),('discount_approval_requests','admin_id'),
    ('seller_discount_limits','user_id'),('seller_discount_limits','set_by'));
```

### G2 — Nenhuma FK `NOT NULL` com `ON DELETE SET NULL`/`SET DEFAULT` (trava delete do pai)
```sql
SELECT t.relname||'.'||a.attname AS violacao
FROM pg_constraint c
JOIN pg_class t ON t.oid=c.conrelid
JOIN pg_namespace n ON n.oid=t.relnamespace
JOIN LATERAL unnest(c.conkey) ck(an) ON true
JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=ck.an
WHERE c.contype='f' AND n.nspname='public'
  AND a.attnotnull AND c.confdeltype IN ('n','d')
  AND (SELECT count(*) FROM unnest(c.conkey))=1;
```

### G3 — Nenhuma função `SECURITY DEFINER` sem `search_path` travado
```sql
SELECT p.proname AS violacao
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
  AND NOT EXISTS (
    SELECT 1 FROM unnest(coalesce(p.proconfig,'{}'::text[])) cfg WHERE cfg LIKE 'search_path=%');
```

### G4 — `profiles.role` coerente com `user_roles` (espelho derivado)
```sql
SELECT p.user_id AS violacao
FROM public.profiles p
JOIN (
  SELECT user_id,(ARRAY_AGG(role::text ORDER BY CASE role::text
    WHEN 'dev' THEN 1 WHEN 'admin' THEN 2 WHEN 'coordenador' THEN 3
    WHEN 'supervisor' THEN 4 WHEN 'manager' THEN 5 WHEN 'agente' THEN 6
    WHEN 'vendedor' THEN 7 ELSE 99 END))[1] r
  FROM public.user_roles GROUP BY user_id
) c ON c.user_id=p.user_id
WHERE p.role IS DISTINCT FROM public.fn_map_role_enum_to_profile(c.r);
```

## Mapa de roles (enum PT → profiles EN)
`dev→admin`, `admin→admin`, `coordenador→manager`, `supervisor→manager`, `manager→manager`, `agente→sales`, `vendedor→sales`. Prioridade (multi-role): `dev > admin > coordenador > supervisor > manager > agente > vendedor`. Ponto único de ajuste: `fn_map_role_enum_to_profile`.

## Observação operacional
Durante esta sessão foram observadas **migrations concorrentes** no mesmo banco (ex.: `dar_mirror_*`, `harden_quotes_seller_id_not_null`, `enforce_quotes_seller_id_not_null`, `fix_discount_approval_audit_actor_id_fk`), aplicadas por outro processo/sessão e interleaved com as desta sessão. Recomenda-se **serializar mudanças de schema** para evitar condições de corrida entre agentes e drift entre o banco e o repositório.
