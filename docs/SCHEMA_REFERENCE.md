# SCHEMA_REFERENCE.md — Banco Canônico PromoGifts (Gold/Medallion)

> **Projeto:** `doufsxqlfjyuvxuezpln` — SSOT de produção (serve promogifts.com.br via Vercel).
> **Auditado em:** 2026-07-16 · **PostgreSQL:** 17.6 · **Tamanho:** 4.578 MB
> **Método:** exclusivamente via `pg_catalog` / `information_schema`. **Read-only.** Nenhuma DDL executada.
> **Gerado por:** sessão Claude (auditoria documental)

---

## 0. REGRA DE MÉTODO (leia antes de auditar este banco)

**Auditoria de schema é feita SÓ via `pg_catalog`.** Nunca via PostgREST/OpenAPI.

Motivo: PostgREST não enxerga trigger, policy, cron job nem GRANT, e confunde view com tabela.
Um "inventário" tirado do OpenAPI produz um retrato falso e leva a decisões erradas —
foi exatamente o que gerou o `CANONICAL_DB_CREATION_PROMPT` (ver §7).

Toda query deste documento está em §8 e é reproduzível.

---

## 1. SUMÁRIO EXECUTIVO

| Objeto | Qtd |
|---|---|
| Tabelas base (`public`) | **386** |
| Tabelas particionadas | 2 (`magazine_public_view_events`, `supplier_products_raw_history`) |
| Colunas (`public`) | **7.571** |
| Views | **190** |
| Materialized views | 5 |
| Funções | **1.277** (529 SECURITY DEFINER) |
| Policies RLS | **906** |
| Triggers | 385 |
| Índices | 1.242 |
| Foreign keys | 395 |
| Enums | 15 |
| Cron jobs | **136** (134 ativos) |

### Schemas com tabelas

| Schema | Tabelas | Papel |
|---|---|---|
| `public` | 388 | Aplicação (Bronze/Silver/Gold + auth + ops) |
| `auth` | 23 | Managed (Supabase) |
| `supplier_stricker` | 17 | Landing dedicado SPOT/Stricker |
| `realtime` | 10 | Managed |
| `storage` | 8 | Managed |
| `cf_recon` | 6 | Reconciliação Cloudflare Images |
| `prod_audit` | 5 | Auditoria de produção |
| `net`, `cron`, `vault`, `extensions`, `supabase_migrations`, `supabase_functions` | 1–2 | Managed |
| `classification_audit` | 1 | Auditoria de classificação |

> ⚠️ `supplier_stricker`, `cf_recon`, `prod_audit` e `classification_audit` são **schemas de aplicação**,
> não managed. Qualquer auditoria que olhe só `public` perde 29 tabelas.

### Extensões instaladas (16)

`http 1.6` · `hypopg 1.4.1` · `index_advisor 0.2.0` · `moddatetime 1.0` · `pg_cron 1.6.4` ·
`pg_graphql 1.5.11` · `pg_net 0.19.5` · `pg_stat_statements 1.11` · `pg_trgm 1.6` ·
`pgcrypto 1.3` · `pgmq 1.5.1` · `plpgsql 1.0` · `supabase_vault 0.3.1` · `unaccent 1.1` ·
`uuid-ossp 1.1` · `wrappers 0.5.7`

---

## 2. POSTURA DE SEGURANÇA — ESTADO REAL

O audit `#1709` (2026-07-16) reportou números que **já não valem**: as migrations `000001–000011`
do PR `#1710` foram aplicadas e fecharam a maior parte. Medição ao vivo:

| Controle | #1709 reportou | **Real hoje** | Status |
|---|---|---|---|
| Tabelas com RLS habilitado | — | **388/388** | ✅ 100% |
| Tabelas com RLS mas **sem policy** | 42 | **0** | ✅ corrigido |
| SECURITY DEFINER **sem `search_path`** | 44 | **0** | ✅ corrigido |
| Views **sem `security_invoker`** | 104 | **0** de 190 | ✅ corrigido |
| SECDEF executável por `anon` | 380 | **22** | ✅ −94% |
| SECDEF executável por `authenticated` | — | 69 | ℹ️ escopo |
| Partições `magazine_public_view_events` com RLS off | 4 | **0** | ✅ corrigido |

**Conclusão:** a superfície crítica do #1709 está fechada. Não re-execute aquelas migrations.

---

## 3. ACHADOS ABERTOS

### 🔴 P1 — `anon` tem GRANT de escrita em ~230 tabelas

RLS bloqueia hoje, mas **GRANT é a segunda linha de defesa e ela não existe**. Se qualquer policy
regredir (o Lovable já reverteu guardas 6× em 10 min — incidente 401 de 11/06), o GRANT permite a escrita.

Tabelas críticas onde `anon` tem `INSERT`/`UPDATE`/`DELETE`:

```
user_roles          ← escalação de privilégio se policy regredir
profiles
permissions
role_permissions
organizations
organization_members
orders
order_items
external_connections
```

**Correção sugerida (cirúrgica, não destrutiva):**
```sql
REVOKE INSERT, UPDATE, DELETE ON public.user_roles, public.profiles,
  public.permissions, public.role_permissions, public.organizations,
  public.organization_members, public.orders, public.order_items,
  public.external_connections
FROM anon;
```
`service_role` bypassa RLS e não é afetado. Edge functions usam `service_role`.

### 🟠 P2 — 61 cron jobs multi-statement

Regra estabelecida (bug #13 do stack Evolution/AtomicaBR): **`VACUUM` em pg_cron deve ser
single-statement**. Um job com `;` no meio aborta silenciosamente no primeiro erro e
os statements seguintes nunca rodam.

Jobs de manutenção afetados (mesma classe do bug #13):
- `vacuum-analyze-weekly`
- `vacuum-high-dead-tuples`
- `analyze-weekly-supplement`
- `refresh-all-materialized-views`
- `stock_snapshots_weekly_purge`

(+56 outros — lista completa via query §8.4)

### 🟡 P3 — 2 cron jobs desligados

| Job | Impacto |
|---|---|
| `process-webhook-outbox` | `webhook_outbox` foi criado no FIX QBP-05 (2026-06-22) para desacoplar o dispatch de webhooks de orçamento. Com o job parado, **a fila não drena**. Confirmar se é intencional. |
| `pipeline-classify-categories` | Classificação automática de categorias parada. |

### 🟡 P4 — Drift de documentação em `products`

`COMMENT ON TABLE products` afirma **152 colunas**. Reais: **184**.
A god table cresceu 32 colunas sem atualizar o comentário. Corrigir o comentário, não a tabela.

---

## 4. ARQUITETURA MEDALLION — MAPA REAL

```
BRONZE  supplier_products_raw ................ 18.996 linhas / 332 MB
        supplier_products_raw_history ........ particionada p2026_06..p2026_10
                                               (p2026_06: 407.944 · p2026_07: 193.545)
        supplier_customization_raw ........... 327
        supplier_customization_options_raw ... 36.980 / 128 MB
        kit_component_enrichment_raw ......... 6.819
           │
           ▼  fn_standardize_supplier / fn_standardize_variant
SILVER  produtos_padronizacao ................ 7.704 / 77 col / 27 MB
        produtos_padronizacao_variantes ...... 18.907 / 54 col / 41 MB
        produtos_site_padronizacao ........... 3.076  (vitrine xbzbrindes)
        kit_component_padronizacao ........... 6.819 / 41 col
        product_packaging .................... 6.610  (fonte SILVER de embalagem)
           │
           ▼  fn_promote_supplier / fn_promote_variants_of_parent
GOLD    products ............................. 7.710 / 184 col / 175 MB  ⚠️ god table
        product_variants ..................... 22.609 / 40 col / 35 MB
        variant_supplier_sources ............. 22.573 / 65 col / 69 MB
        product_images ....................... 72.007 / 45 col / 141 MB
        print_area_techniques ................ 24.442  (FONTE ÚNICA de áreas de gravação)
```

### Satélites 1:1 de `products` (sincronizados por trigger)

| Tabela | Linhas | Trigger |
|---|---|---|
| `product_seo` | 7.710 | `trg_sync_product_seo` |
| `product_supply` | 7.710 | `trg_sync_product_supply` |
| `product_fiscal` | 7.689 | `trg_sync_product_fiscal` |
| `product_ai_content` | 7.279 | `trg_sync_product_ai_content` |
| `product_physical` | 7.608 | `trg_sync_product_physical` — **WRITE-ONLY buffer**, não lido por view/FK |

### Séries temporais (maiores objetos do banco)

| Tabela | Linhas | Tamanho | Retenção |
|---|---|---|---|
| `stock_snapshots` | **3.626.559** | **1.545 MB** | 14 dias (`stock_snapshots_weekly_purge`) |
| `stock_daily_summary` | 695.286 | 242 MB | permanente |
| `product_relationships` | 153.366 | 73 MB | derivada |
| `image_backfill_queue` | 116.383 | 79 MB | fila |
| `seo_audit_log` | 93.884 | 38 MB | histórico |

---

## 5. AUTORIZAÇÃO

**Fonte única de papéis:** `public.user_roles` (13 linhas, PK composta `user_id, role`, multi-role).
`profiles.role` é **espelho derivado** — nunca fonte.

**Enum `app_role`** (ordem física no catálogo, ≠ hierarquia):
```
dev · supervisor · admin · manager · agente · coordenador · vendedor
```

**Enums de autorização/fluxo (15 no total):**

| Enum | Valores |
|---|---|
| `app_role` | dev, supervisor, admin, manager, agente, coordenador, vendedor |
| `org_role` | owner, admin, member |
| `step_up_action` | promote_dev, demote_dev, mcp_full_issue, mcp_full_escalate, secret_rotation, secret_revoke, mcp_key_revoke, mcp_key_rotate |
| `magazine_status` | draft, published, archived |
| `magazine_reaction_kind` | like, love, fire, idea |
| `payment_status` | pending, authorized, captured, refunded, failed |
| `supplier_raw_status` | pending, processing, processed, failed, skipped, quarantined |
| `silver_norm_status` | raw, normalizing, normalized, validated, rejected, promoted |
| `produtos_padronizacao_status` | pending, standardized, rejected, promoted |
| `role_migration_status` | pending, running, completed, failed, cancelled |
| `role_migration_item_status` | pending, success, failed, skipped |
| `conversation_event_type` | text, image, audio, video, file, system |
| `familia_cor_enum` | amarelo, laranja, vermelho, coral, rosa, magenta, roxo, lilas, azul, ciano, verde, marrom, bege, neutro, metalico |
| `categoria_cor_enum` | pantone, basica, institucional, especial, bordado, hot_stamping, serigrafia, sublimacao |
| `tipo_cor_enum` | solid, metalica, fluorescente, pastel, neon, especial |

### ⚠️ `auth.users` — invariantes reais

- **69 FKs apontam para `auth.users`.** Não são erro de modelagem; são o desenho vigente.
  Qualquer plano que proponha "proibir FK para auth.users" implica refatorar 69 constraints.
- **Existe exatamente 1 trigger em `auth.users`: `on_auth_user_created`.**
  É o bootstrap de perfil. **Não dropar.** Um `DROP TRIGGER IF EXISTS on_auth_user_created`
  deixa todo signup novo sem `profiles` — e sem `user_organizations`, o que trava
  `user_belongs_to_org()` / `is_org_owner_or_admin()` e fecha o app para o usuário.

---

## 6. MATERIALIZED VIEWS

| MV | Tamanho | Refresh |
|---|---|---|
| `mv_product_images_audit` | 93 MB | `refresh-mv-product-images-audit` |
| `mv_stock_rupture_alert` | 11 MB | `refresh-mv-stock-rupture-alert` |
| `mv_product_leaf_category` | 2.040 kB | `refresh-mv-product-leaf-category` |
| `mv_ema_kpi_by_level` | 80 kB | `refresh-mv-ema-kpi-by-level` |
| `mv_supplier_reliability` | 64 kB | `refresh-mv-supplier-reliability` |

**190 views**, 100% com `security_invoker`. **61 views** têm SELECT para `anon` (catálogo público).

---

## 7. POR QUE NÃO EXISTE "CANONICAL_DB_CREATION_PROMPT"

Em 2026-07-16 circulou um prompt de 14 fases para "criar o schema canônico" neste projeto.
Ele **não foi executado**. Registro do motivo, para não voltar:

| Premissa do prompt | Realidade medida |
|---|---|
| `-- esperado: ~145 tabelas` | **388** |
| "Modo idempotente" | `CREATE POLICY` **não aceita `IF NOT EXISTS`** no PG. Policies permissivas se combinam com **OR** → só alargam acesso |
| `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users` | O trigger **existe e está em uso** → quebraria todo signup |
| "PROIBIDO FK para `auth.users`" | **69 FKs** existem por desenho |
| `CREATE OR REPLACE VIEW v_products_public` (16 col) | View real expõe `ipi_rate`, `ncm_id`, `bitrix_product_id`, `tax_reference_state`. `CREATE OR REPLACE VIEW` **não remove colunas** → erro ou catálogo mutilado |
| `WHERE deleted_at IS NULL` em `products` | Coluna é **`is_deleted`** |
| cron `REFRESH ... mv_stock_rupture_alert` | A MV **não é criada** em nenhuma das 14 fases |
| `"apikey":"<ANON_KEY>"` | Placeholder literal em 2 jobs → 401/min + chave em texto plano |
| `REVOKE EXECUTE ON has_role FROM PUBLIC` | PG **exige** EXECUTE para roles usados em cláusula `USING` → quebraria o catálogo público |

O próprio prompt, em §9.9, exigia aprovação do PO antes de qualquer alteração de schema —
e a ordem de execução tinha origem no bot Lovable, não no PO.

**Regra derivada → ver `CLAUDE.md` REGRA #8.**

---

## 8. QUERIES CANÔNICAS DE AUDITORIA

Todas read-only. Rodar via MCP Supabase (`execute_sql`) ou `psql`.

### 8.1 Inventário de tabelas
```sql
SELECT c.relname, c.relrowsecurity AS rls,
       (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname) AS policies,
       (SELECT count(*) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS cols,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
       s.n_live_tup AS rows
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_stat_user_tables s ON s.relid=c.oid
WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relispartition
ORDER BY pg_total_relation_size(c.oid) DESC;
```

### 8.2 Tabelas com RLS sem policy (esperado: 0)
```sql
SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relrowsecurity
  AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname);
```

### 8.3 SECURITY DEFINER sem search_path (esperado: 0)
```sql
SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
  AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig,'{}')) c WHERE c LIKE 'search_path=%');
```

### 8.4 Cron jobs multi-statement
```sql
SELECT jobname, schedule, command FROM cron.job
WHERE active AND (length(command)-length(replace(command,';','')))>1
ORDER BY jobname;
```

### 8.5 GRANT de escrita para anon (P1 — ver §3)
```sql
SELECT DISTINCT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public' AND grantee='anon'
  AND privilege_type IN ('INSERT','UPDATE','DELETE')
ORDER BY table_name;
```

### 8.6 Views sem security_invoker (esperado: 0)
```sql
SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='v'
  AND NOT COALESCE(array_to_string(c.reloptions,',') LIKE '%security_invoker=%on%'
                OR array_to_string(c.reloptions,',') LIKE '%security_invoker=true%', false);
```

### 8.7 Funções SECDEF executáveis por anon
```sql
SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')
ORDER BY 1;
```

---

## 9. INVARIANTES DESTE BANCO

1. **SSOT:** `doufsxqlfjyuvxuezpln`. Nunca `pqpdolkaeqlyzpdpbizo`. (`CLAUDE.md` REGRA #1)
2. **Não criar estrutura nova** — adicionar registros, não tabelas. Exceção: `_backup_*_yyyymmdd` temporário.
3. **`pg_cron` VACUUM = single-statement.** Multi-statement aborta no primeiro erro.
4. **`user_roles` é a fonte de papéis.** `profiles.role` é espelho derivado.
5. **`print_area_techniques` é fonte única** de áreas de gravação. Nome/custo da técnica vêm por JOIN com `tabela_preco_gravacao_oficial` via `tabela_preco_id` — não duplicar.
6. **`product_physical` é WRITE-ONLY.** Não dropar: `fn_promote_padronizacao`, `fn_site_promote_to_gold` e `fn_asia_site_promote_to_gold` gravam lá (risco de HALT do cron de promoção).
7. **`products.primary_image_url` não se edita direto.** É mantido por `trg_sync_images_to_product`.
8. **INSERT em massa via pipeline:** `SELECT set_config('app.write_source','pipeline',false);` antes, senão `fn_products_capture_manual_edits` marca tudo em `locked_fields`.
9. **`on_auth_user_created` em `auth.users` não se dropa.**
10. **Auditoria de schema só via `pg_catalog`.** (§0)

---

## 10. MANUTENÇÃO DESTE DOCUMENTO

Este arquivo é um **retrato datado**. Números mudam.

Antes de confiar em qualquer contagem aqui, rode §8.1 e compare.
Se divergir >5%, regenere o documento em vez de remendar.

Guardas automáticas já existentes no banco:
- `schema_signature_baseline` (7.201 colunas aprovadas) + `fn_capture_schema_baseline()`
- `schema_signature_drift_log` (99 checagens) / `schema_signature_drift_allowlist`
- `schema_drift_log` (122) — comparação Lovable ↔ Oficial via edge `schema-drift-check`

---

*Auditado read-only em 2026-07-16 via pg_catalog. Nenhuma DDL executada. Nenhum dado alterado.*
