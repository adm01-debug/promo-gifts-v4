# PROMPT EXAUSTIVO — Criação do BD Canônico PromoGifts (Gold/Medallion)

> **Como usar:** cole este arquivo INTEIRO em uma nova sessão do Claude Code (ou Claude com MCP Supabase conectado ao projeto `doufsxqlfjyuvxuezpln`). O Claude deve executar as **14 fases sequencialmente**, uma por vez, aguardando `-- VERIFY:` OK antes de avançar. Nenhuma fase pode ser pulada.
>
> **Alvo:** projeto Supabase `doufsxqlfjyuvxuezpln` (Gold/Medallion — SSOT do PromoGifts). **NUNCA** apontar para `pqpdolkaeqlyzpdpbizo` (Lovable Cloud interno).
>
> **Modo:** idempotente. Toda DDL usa `IF NOT EXISTS` / `CREATE OR REPLACE` / `ON CONFLICT DO NOTHING`. Reexecutar qualquer fase é seguro.

---

## 0. CONTEXTO E REGRAS INVIOLÁVEIS

Você é um **DBA sênior com PhD em bancos de dados Postgres**. Vai construir o schema canônico completo do PromoGifts — plataforma B2B fechada de brindes corporativos, arquitetura Medallion (Bronze → Silver → Gold), Supabase PG17.

### Invariantes (violação = falha imediata da fase)

1. **SSOT:** todas as migrations rodam no projeto `doufsxqlfjyuvxuezpln`. Se o cliente Supabase apontar para outro ref, **PARE**.
2. **GRANT obrigatório:** toda `CREATE TABLE public.<x>` é imediatamente seguida por `GRANT` para os roles necessários **na mesma migration**, antes de `ENABLE ROW LEVEL SECURITY` e `CREATE POLICY`. Ordem inviolável:
   ```
   CREATE TABLE → GRANT → ENABLE RLS → CREATE POLICY → TRIGGER updated_at
   ```
3. **FK para usuários:** **PROIBIDO** `REFERENCES auth.users` em colunas de exibição (`seller_id`, `created_by`, `assigned_to`, `admin_id`, `user_id` de perfil, etc.). Sempre `REFERENCES public.profiles(user_id)`. Exceção autorizada: tabelas puramente de auditoria interna que não são embebidas via PostgREST.
4. **Roles nunca em `profiles`:** roles vivem exclusivamente em `public.user_roles` com enum `public.app_role`. Toda checagem de papel usa `public.has_role(auth.uid(), 'admin'::app_role)` (SECURITY DEFINER, `search_path=public`). Espelho `profiles.role` é derivado via trigger — nunca fonte.
5. **SECURITY DEFINER:** toda função SECURITY DEFINER tem obrigatoriamente:
   - `SET search_path = public` (previne search_path hijacking)
   - `REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated` (whitelist explícita depois)
6. **Sem `CHECK` para tempo:** rules como `expire_at > now()` vão para **trigger BEFORE INSERT/UPDATE**, nunca CHECK (imutabilidade do CHECK quebra restore).
7. **NOT NULL + `ON DELETE SET NULL`** é contradição. Use `ON DELETE NO ACTION` ou `RESTRICT` quando a coluna é NOT NULL.
8. **RLS obrigatório em 100% das tabelas `public`** com ao menos uma policy explícita (mesmo que seja `USING (false)` para deny-all quando o acesso é só via `service_role`).
9. **Data API:** `service_role` sempre recebe `GRANT ALL`. `authenticated` recebe conforme escopo. `anon` **apenas** para leituras públicas com token (view pública, share tokens).
10. **Timestamps:** toda tabela tem `id UUID PK DEFAULT gen_random_uuid()`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` + trigger `set_updated_at`. Soft-delete quando aplicável: `deleted_at TIMESTAMPTZ`.
11. **Índices:** toda FK indexada. Toda coluna usada em `WHERE`/`ORDER BY` frequente indexada. Índices parciais (`WHERE deleted_at IS NULL`) para soft-delete.
12. **Naming:** `snake_case`, tabelas plurais (`products`, não `product`), FKs singulares (`product_id`, `user_id`), booleans com prefixo `is_`/`has_`.

### Convenções de execução

- Aplique as migrations via **Supabase MCP** (`supabase--migration`) no projeto `doufsxqlfjyuvxuezpln`. Uma migration por fase, nome: `phase_NN_<slug>`.
- Ao final de cada fase, rode `-- VERIFY:` (SELECT) e confirme retorno esperado antes de avançar.
- Se qualquer VERIFY falhar, **PARE**, reporte a linha exata e aguarde correção.
- NÃO combine múltiplas fases em uma migration.

---

## 1. ORDEM DE EXECUÇÃO — 14 FASES

| # | Fase | Objetivo | Dependência |
|---|------|----------|-------------|
| 1 | Fundação | Extensões, enum `app_role`, `user_roles`, `has_role()`, `profiles`, `set_updated_at()` | — |
| 2 | Governança & Segurança | Auditoria, kill switches, admin_settings, rate limits, IP/geo control | 1 |
| 3 | Medallion Bronze/Silver/Gold | Tabelas raw, produtos_padronizacao, products, product_variants, suppliers, views Gold | 1 |
| 4 | Catálogo & UX | Categories, componentes, grupos, price freshness, views/search analytics | 3 |
| 5 | Favoritos/Coleções/Comparação | 4 domínios espelhados + reactions + trash TTL | 1, 3 |
| 6 | Kits & Templates | custom_kits, kit_templates, kit_variants, collaborators, comments, share tokens, cart_templates | 1, 3 |
| 7 | Magic-Up (branding + campanhas) | magic_up_brand_kits/campaigns/generations/comments/reactions/public_shares | 1 |
| 8 | Orçamentos & Pedidos | quotes, quote_items, personalizations, discount approval, e-signature, orders, PED/QOT trigger | 1, 3, 4 |
| 9 | CRM & Fornecedores | suppliers extras, external_connections, product_sync_logs, crm_callback_events, integration_credentials | 1 |
| 10 | Observabilidade | admin_audit_log particionado, telemetria, webhook_delivery_metrics particionado, AI usage | 1 |
| 11 | MCP & Step-Up Auth | mcp_api_keys + auditoria + auto-revoke, step_up_challenges/tokens/audit | 1, 2 |
| 12 | Simulador & Mockups | simulation_runs, mockup_templates, generated_mockups, art_file_attachments | 1, 3 |
| 13 | Storage buckets + Cron jobs | Buckets `logos`/`personalization`/`art-files`/`mockups`/`magic-up`/`product-cdn` + policies; pg_cron schedules | Todas anteriores |
| 14 | Edge Functions | ~85 funções: contratos I/O, esqueletos com CORS SSOT + Zod + logger + X-Request-Id | 1–13 |

---

## 2. TEMPLATE CANÔNICO DE TABELA

Todo `CREATE TABLE public.<nome>` segue este template. **Não invente colunas fora dele sem justificar em comentário.**

```sql
-- ═══════════════════════════════════════════════════════════
-- TABELA: public.<nome>
-- Domínio: <domínio>
-- Escopo: <descrição funcional em PT-BR>
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.<nome> (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Colunas de domínio (tipagem estrita, NOT NULL sempre que possível)
  -- Enums via CHECK: status TEXT NOT NULL CHECK (status IN ('a','b','c'))
  -- FKs sempre com ON DELETE explícito (CASCADE|RESTRICT|NO ACTION|SET NULL)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ  -- opcional; apenas se soft-delete for necessário
);

-- Índices (uma linha por índice; parcial quando aplicável)
CREATE INDEX IF NOT EXISTS idx_<nome>_<col> ON public.<nome>(<col>);
CREATE INDEX IF NOT EXISTS idx_<nome>_active ON public.<nome>(id) WHERE deleted_at IS NULL;

-- GRANTs (ordem inviolável, ANTES de RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<nome> TO authenticated;
GRANT ALL ON public.<nome> TO service_role;
-- GRANT SELECT ON public.<nome> TO anon;  -- descomentar SOMENTE se houver policy explícita p/ anon

-- RLS
ALTER TABLE public.<nome> ENABLE ROW LEVEL SECURITY;

-- Policies canônicas (uma por operação; nome em PT-BR)
CREATE POLICY "Usuários leem seus próprios registros"
  ON public.<nome> FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários criam seus próprios registros"
  ON public.<nome> FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários atualizam seus próprios registros"
  ON public.<nome> FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários deletam seus próprios registros"
  ON public.<nome> FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins têm acesso total"
  ON public.<nome> FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_<nome>_updated_at ON public.<nome>;
CREATE TRIGGER trg_<nome>_updated_at
  BEFORE UPDATE ON public.<nome>
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.<nome> IS '<descrição em PT-BR>';
```

---

## 3. FASES DETALHADAS

> Cada fase abaixo é uma migration única. O Claude deve executá-la via `supabase--migration`, aguardar approve, rodar `-- VERIFY`, e só então avançar.

---

### `-- PHASE 1/14: FUNDAÇÃO` (extensões, roles, profiles, helpers)

```sql
-- Extensões (idempotente)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum global de papéis (PT-BR nativo, mapeado para EN em profiles.role via trigger)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM (
    'dev','admin','coordenador','supervisor','manager','agente','vendedor'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper: trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

-- profiles (espelho de auth.users; NUNCA armazena role como fonte)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,  -- referencia auth.users(id), sem FK direta (managed schema)
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  organization_id UUID,
  role TEXT,  -- ESPELHO derivado de user_roles (dev/admin→admin, coord/superv/mgr→manager, agente/vend→sales)
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários leem próprio perfil e admins leem todos"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Usuários atualizam próprio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role insere perfis"
  ON public.profiles FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Admins gerenciam perfis"
  ON public.profiles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- user_roles (FONTE ÚNICA de papéis)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  granted_by UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários leem próprios papéis"
  ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins gerenciam papéis"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- has_role (SECURITY DEFINER, search_path travado, EXECUTE granted seletivamente)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

-- is_dev / is_admin helpers
CREATE OR REPLACE FUNCTION public.is_dev(_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'dev'::public.app_role);
$$;
REVOKE EXECUTE ON FUNCTION public.is_dev(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_dev(UUID) TO authenticated, service_role;

-- Mapeamento role enum PT-BR → profiles.role EN
CREATE OR REPLACE FUNCTION public.fn_map_role_enum_to_profile(_role TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _role
    WHEN 'dev' THEN 'admin' WHEN 'admin' THEN 'admin'
    WHEN 'coordenador' THEN 'manager' WHEN 'supervisor' THEN 'manager' WHEN 'manager' THEN 'manager'
    WHEN 'agente' THEN 'sales' WHEN 'vendedor' THEN 'sales'
    ELSE 'user'
  END;
$$;

-- Trigger: espelha user_roles → profiles.role com prioridade
CREATE OR REPLACE FUNCTION public.fn_sync_profile_role()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_top TEXT;
BEGIN
  SELECT (ARRAY_AGG(role::text ORDER BY CASE role::text
    WHEN 'dev' THEN 1 WHEN 'admin' THEN 2 WHEN 'coordenador' THEN 3
    WHEN 'supervisor' THEN 4 WHEN 'manager' THEN 5
    WHEN 'agente' THEN 6 WHEN 'vendedor' THEN 7 ELSE 99 END))[1]
  INTO v_top
  FROM public.user_roles
  WHERE user_id = COALESCE(NEW.user_id, OLD.user_id);

  UPDATE public.profiles
     SET role = public.fn_map_role_enum_to_profile(v_top)
   WHERE user_id = COALESCE(NEW.user_id, OLD.user_id);
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS user_roles_sync_profile_role ON public.user_roles;
CREATE TRIGGER user_roles_sync_profile_role
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.fn_sync_profile_role();

-- Bootstrap de perfil ao criar usuário em auth.users
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();
```

**`-- VERIFY 1:`**
```sql
SELECT
  (SELECT COUNT(*) FROM pg_type WHERE typname = 'app_role') AS enum_ok,           -- esperado: 1
  (SELECT COUNT(*) FROM pg_proc WHERE proname = 'has_role') AS has_role_ok,       -- ≥1
  (SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('profiles','user_roles')) AS tables_ok; -- 2
```

---

### `-- PHASE 2/14: GOVERNANÇA & SEGURANÇA` (auditoria, kill switches, rate limits, IP/geo)

Tabelas (aplique com o template canônico para cada uma; RLS `admin-only` salvo indicação):

- `admin_settings` (key TEXT UNIQUE, value JSONB, description TEXT) — read: admin
- `system_settings` (mesma estrutura, escopo global) — read: authenticated, write: admin
- `system_kill_switches` (name TEXT UNIQUE, is_enabled BOOL, reason TEXT, updated_by UUID→profiles) — read: authenticated
- `admin_audit_log` **PARTICIONADA por mês** em `occurred_at`. Colunas: `actor_id UUID, action TEXT NOT NULL, target_type TEXT, target_id TEXT, before JSONB, after JSONB, ip INET, user_agent TEXT, request_id TEXT, severity TEXT CHECK (severity IN ('info','warning','error','critical')), correlation_id UUID, tags TEXT[], occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Cria 6 partições `y2025m12`..`y2026m06`.
- `audit_logs` (equivalente resumido, não particionado, para writes de baixo volume)
- `access_security_settings` (min_password_length INT, mfa_required BOOL, session_ttl_minutes INT, ...)
- `ip_access_control` (ip INET, mode TEXT CHECK (mode IN ('allow','block')), reason TEXT, expires_at TIMESTAMPTZ, created_by UUID→profiles)
- `geo_allowed_countries` (country_code CHAR(2) PK, is_allowed BOOL, reason TEXT)
- `bot_detection_log` (ip INET, user_agent TEXT, score NUMERIC, action TEXT, path TEXT, correlation_id UUID)
- `login_attempts` / `auth_login_attempts` (email TEXT, ip INET, success BOOL, reason TEXT)
- `user_known_devices` (user_id UUID→profiles, fingerprint TEXT, last_seen_at, user_agent)
- `password_reset_requests` (user_id UUID→profiles, token_hash TEXT, expires_at, consumed_at) — trigger valida `expires_at > now()`
- `user_token_revocations` (user_id UUID→profiles, revoked_at)
- `edge_rate_limits` (bucket TEXT, ip INET, count INT, window_start TIMESTAMPTZ, UNIQUE (bucket, ip, window_start))
- `request_rate_limits` (mesma ideia por rota + user)
- `rls_denial_log` (table_name TEXT, operation TEXT, user_id UUID, ...)
- `public_token_failures` (token_hash TEXT, kind TEXT, ip INET, occurred_at)
- `secret_rotation_log` (secret_name TEXT, rotated_by UUID→profiles, rotated_at)
- `hardening_health_snapshots` (score INT, dimensions JSONB, taken_at)
- `file_scan_logs` (file_path TEXT, verdict TEXT, scanner TEXT, scanned_at)
- `e2e_cleanup_audit` (16 col — auditoria de limpeza E2E; admin-only)
- `e2e_cleanup_rate_limit` (4 col; deny-all para anon/authenticated, service_role-only)

**Padrão de particionamento (`admin_audit_log`):**
```sql
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID DEFAULT gen_random_uuid(),
  actor_id UUID, action TEXT NOT NULL, target_type TEXT, target_id TEXT,
  before JSONB, after JSONB, ip INET, user_agent TEXT, request_id TEXT,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','error','critical')),
  correlation_id UUID, tags TEXT[], occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- 6 partições rolling
CREATE TABLE IF NOT EXISTS public.admin_audit_log_y2025m12
  PARTITION OF public.admin_audit_log FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
-- ... repetir y2026m01..y2026m06
```

Rotina de rotação futura (cron): função `fn_rotate_admin_audit_partitions()` cria a partição `now()+1 mês` e desanexa a mais antiga (>12 meses).

**Deny-all pattern** (para tabelas só-service_role):
```sql
CREATE POLICY "Bloqueia leitura para anon" ON public.e2e_cleanup_rate_limit
  FOR SELECT TO anon USING (false);
CREATE POLICY "Bloqueia leitura para authenticated" ON public.e2e_cleanup_rate_limit
  FOR SELECT TO authenticated USING (false);
-- (repetir para INSERT/UPDATE/DELETE anon+authenticated; service_role ignora via GRANT ALL)
```

**`-- VERIFY 2:`**
```sql
SELECT COUNT(*) AS gov_tables FROM information_schema.tables
WHERE table_schema='public' AND table_name IN (
  'admin_settings','system_settings','system_kill_switches','admin_audit_log',
  'audit_logs','access_security_settings','ip_access_control','geo_allowed_countries',
  'bot_detection_log','login_attempts','user_known_devices','edge_rate_limits',
  'rls_denial_log','hardening_health_snapshots'
);  -- esperado ≥14
```

---

### `-- PHASE 3/14: MEDALLION` (Bronze/Silver/Gold + views)

**Bronze** (dados crus do fornecedor, imutáveis):
- `supplier_products_raw` (id, supplier_id, supplier_sku, raw JSONB NOT NULL, source_url TEXT, ingested_at)
- `supplier_products_raw_history` (mesma estrutura + versioning: raw_hash TEXT, valid_from, valid_to)
- `suppliers` (name, slug UNIQUE, code TEXT UNIQUE, active BOOL, homepage, contact JSONB, verified_at)

**Silver** (padronizado):
- `produtos_padronizacao` (id UUID, supplier_id, supplier_sku, product_name TEXT, description TEXT, ncm TEXT, weight_grams INT, box_qty INT, ...)
- `produtos_padronizacao_variantes` (padronizacao_id UUID → produtos_padronizacao, color_name, color_hex, size, sku_variant)

**Gold** (produção — o que o app lê):
- `products` (36 col — id UUID, name TEXT NOT NULL, slug TEXT UNIQUE, description TEXT, short_description TEXT, category_id UUID→categories ON DELETE NO ACTION, supplier_id UUID→suppliers ON DELETE NO ACTION, brand TEXT, price NUMERIC(12,2), sale_price NUMERIC(12,2), cost_price NUMERIC(12,2), stock_quantity INT, min_order_quantity INT DEFAULT 1, is_bestseller BOOL, is_new BOOL, is_kit BOOL, is_active BOOL DEFAULT true, image_url TEXT, images TEXT[], videos JSONB, metadata JSONB, price_updated_at TIMESTAMPTZ, price_freshness_threshold_days INT DEFAULT 60, search_vector TSVECTOR, ...)
- `product_variants` (product_id UUID→products ON DELETE CASCADE, sku_variant TEXT, color_name, color_hex, size, image_url, stock, ativo BOOL)
- `variant_supplier_sources` (variant_id → product_variants, supplier_id, next_date_1..N DATE, ...)
- `product_images_cdn` (product_id, url_cdn TEXT NOT NULL, url_original, cloudflare_status TEXT, width INT, height INT)
- `print_area_techniques` (id UUID, product_id, location_name TEXT, technique_code TEXT, technique_name, max_width_cm NUMERIC, max_height_cm NUMERIC, setup_cost NUMERIC, unit_cost NUMERIC, handling_price NUMERIC, max_colors INT, sla_days INT, is_primary BOOL)
- `price_history` (product_id, variant_id, old_price, new_price, changed_at, source TEXT)

**Views Gold** (`SECURITY INVOKER` + apenas colunas públicas):
```sql
CREATE OR REPLACE VIEW public.v_products_public AS
SELECT id, name, slug, short_description, category_id, supplier_id, brand,
       COALESCE(sale_price, price) AS display_price, price, image_url, images,
       is_bestseller, is_new, is_kit, price_updated_at, price_freshness_threshold_days
FROM public.products
WHERE is_active = true AND deleted_at IS NULL;

CREATE OR REPLACE VIEW public.v_suppliers_public AS
SELECT id, name, slug, code, verified_at FROM public.suppliers WHERE active = true;

CREATE OR REPLACE VIEW public.v_products_min_price AS
SELECT p.id AS product_id, MIN(COALESCE(pv.price, p.price)) AS min_price
FROM public.products p LEFT JOIN public.product_variants pv ON pv.product_id = p.id
WHERE p.is_active GROUP BY p.id;

CREATE OR REPLACE VIEW public.vw_medallion_coverage AS
SELECT supplier_id, COUNT(*) FILTER (WHERE bronze) AS bronze,
       COUNT(*) FILTER (WHERE silver) AS silver,
       COUNT(*) FILTER (WHERE gold) AS gold
FROM (
  SELECT s.id AS supplier_id,
    EXISTS(SELECT 1 FROM public.supplier_products_raw r WHERE r.supplier_id=s.id) AS bronze,
    EXISTS(SELECT 1 FROM public.produtos_padronizacao pp WHERE pp.supplier_id=s.id) AS silver,
    EXISTS(SELECT 1 FROM public.products p WHERE p.supplier_id=s.id) AS gold
  FROM public.suppliers s
) x GROUP BY supplier_id;

CREATE OR REPLACE VIEW public.v_pipeline_progress AS
SELECT 'bronze'::TEXT AS layer, COUNT(*) AS n FROM public.supplier_products_raw
UNION ALL SELECT 'silver', COUNT(*) FROM public.produtos_padronizacao
UNION ALL SELECT 'gold', COUNT(*) FROM public.products;
```

**GRANTs das views:** apenas `SELECT` para `authenticated` e `anon` (leitura pública catálogo).

**Funções do pipeline** (SECURITY DEFINER, `search_path=public`):
- `fn_normalize_ncm(TEXT) → TEXT` (remove pontuação, valida 8 dígitos, rejeita placeholders `00000000`)
- `fn_display_product_name(TEXT) → TEXT` (title case preservando siglas/unidades, idempotente)
- `fn_apply_transform(config JSONB, input TEXT) → TEXT` (19 transform types)
- `fn_standardize_raw(raw_id UUID) → UUID` (bronze → silver; persiste TODOS os campos derivados, respeita locked_fields)
- `fn_enrich_padronizacao(pad_id UUID) → VOID` (enriquece IPI via `ncm_codes` + moda de irmãos; nunca sobrescreve fornecedor)
- `fn_silver_to_gold(pad_id UUID) → UUID` (promoção Silver → Gold; aplica `fn_display_product_name`)
- `fn_spot_to_silver`, `fn_sm_to_silver` (adaptadores por fornecedor)

**`-- VERIFY 3:`**
```sql
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema='public' AND table_name IN (
  'suppliers','products','product_variants','variant_supplier_sources',
  'product_images_cdn','print_area_techniques','price_history',
  'supplier_products_raw','produtos_padronizacao','produtos_padronizacao_variantes'
);  -- esperado 10
SELECT COUNT(*) FROM information_schema.views
WHERE table_schema='public' AND table_name IN (
  'v_products_public','v_suppliers_public','v_products_min_price',
  'vw_medallion_coverage','v_pipeline_progress'
);  -- esperado 5
```

---

### `-- PHASE 4/14: CATÁLOGO & UX`

- `categories` (id, name, slug UNIQUE, parent_id UUID→categories ON DELETE SET NULL, icon TEXT, sort_order INT, is_hidden BOOL) — public read
- `category_icons` (category_id UUID→categories, icon_name, svg_content, tint TEXT) — public read
- `product_components` (kit_id/product_id UUID→products, component_name, quantity INT)
- `product_component_locations` (component_id, location_name, is_primary)
- `product_groups` (name, description, group_type TEXT) + `product_group_members` (group_id, product_id, sort_order)
- `product_price_freshness_overrides` (product_id UUID PK→products, threshold_days INT NOT NULL) — admin write, public read
- `recently_viewed_products` (user_id UUID→profiles, product_id UUID→products, viewed_at, UNIQUE (user_id, product_id))
- `product_views` (product_id, user_id, session_id TEXT, viewed_at, referrer TEXT)
- `search_analytics` (query TEXT, results_count INT, user_id, occurred_at)
- `user_search_history` (user_id, query, filters JSONB, occurred_at)
- `catalog_analytics` (event TEXT, payload JSONB, occurred_at, user_id)
- `saved_filters` (user_id, name, filters JSONB, is_default BOOL)
- `saved_trends_views` (user_id, name, config JSONB)
- `navigation_analytics` (user_id, path TEXT, referrer, occurred_at)

RLS: `recently_viewed_products`, `saved_filters`, `user_search_history`, `saved_trends_views` → user-scoped. Analytics → user insere próprios, admin lê tudo. Categories/category_icons/price_freshness → public read.

**`-- VERIFY 4:`** `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE ANY (ARRAY['categor%','product_comp%','product_group%','saved_%','search_analytics','user_search_history','recently_viewed_products','navigation_analytics','product_views','catalog_analytics','product_price_freshness_overrides']);` → ≥13

---

### `-- PHASE 5/14: FAVORITOS / COLEÇÕES / COMPARAÇÃO`

**Espelhamento** (favoritos e coleções seguem estrutura IDÊNTICA — trocando apenas `favorite_*` por `collection_*`):

Para `favorites`:
- `favorite_lists` (user_id UUID→profiles, name TEXT NOT NULL, description, is_default BOOL, share_token UUID, share_expires_at, presentation_mode BOOL, notes TEXT, is_public BOOL, ...)
- `favorite_items` (list_id UUID→favorite_lists ON DELETE CASCADE, product_id, variant_id, note TEXT, price_snapshot NUMERIC, added_at, sort_order INT)
- `favorite_items_trash` (mesma estrutura + `deleted_at`, `expires_at` = deleted_at + 30 days) — cron limpa `WHERE expires_at < now()`
- `favorite_item_reactions` (item_id UUID→favorite_items, reactor_hash TEXT, emoji TEXT CHECK (emoji IN ('👍','❤️','🔥','💡')), occurred_at) — anônimo via share

Para `collections`: mesmíssima estrutura (`collections`, `collection_items`, `collection_items_trash`, `collection_item_reactions`).

Para `user_comparisons`:
- `user_comparisons` (user_id, name, product_ids UUID[], created_at, share_token UUID, share_expires_at, is_public BOOL, radar_config JSONB, ai_summary TEXT)
- `comparison_reactions` (comparison_id UUID→user_comparisons, reactor_hash TEXT, emoji TEXT)

**Compartilhamento público:** RLS permite `SELECT` para `anon` **apenas** se `share_token = current_setting('request.jwt.claim.share_token', true)::UUID AND share_expires_at > now()` (implementado via edge function que injeta claim, não via anon key direto).

**Cron TTL** (Fase 13):
```sql
SELECT cron.schedule('trash-cleanup-favorites', '0 3 * * *',
  $$DELETE FROM public.favorite_items_trash WHERE expires_at < now();$$);
SELECT cron.schedule('trash-cleanup-collections', '5 3 * * *',
  $$DELETE FROM public.collection_items_trash WHERE expires_at < now();$$);
```

**`-- VERIFY 5:`** COUNT em `favorite_%`,`collection_%`,`user_comparisons`,`comparison_reactions` ≥10.

---

### `-- PHASE 6/14: KITS & TEMPLATES`

- `custom_kits` (24 col — user_id, name, description, cover_image, items JSONB, total_price NUMERIC(12,2), markup_ratio NUMERIC, is_public BOOL, share_token, ...)
- `kit_templates` (18 col — name, category, template JSONB NOT NULL, cover_image, is_featured BOOL, owner_id UUID→profiles)
- `kit_variants` (kit_id UUID→custom_kits, variant_name, config JSONB, base_price NUMERIC)
- `kit_collaborators` (kit_id, user_id UUID→profiles, role TEXT CHECK (role IN ('viewer','editor','owner')), UNIQUE (kit_id, user_id))
- `kit_comments` (kit_id, author_id UUID→profiles, body TEXT NOT NULL, parent_id UUID→kit_comments)
- `kit_share_tokens` (kit_id, token UUID UNIQUE, expires_at, created_by UUID→profiles) — trigger valida `expires_at > now()`
- `cart_templates` (7 col — user_id, name, items JSONB, total_price)

RLS: owner + collaborators (via subquery em `kit_collaborators`). Public share via token.

**`-- VERIFY 6:`** 7 tabelas presentes.

---

### `-- PHASE 7/14: MAGIC-UP` (branding + campanhas + geração AI)

7 tabelas — todas user-scoped:
- `magic_up_brand_kits` (15 col — user_id, name, logo_url, logo_base64, palette JSONB, fonts JSONB, tone TEXT, industry TEXT)
- `magic_up_campaigns` (15 col — user_id, brand_kit_id UUID→magic_up_brand_kits ON DELETE SET NULL, name, brief TEXT, channels TEXT[], status TEXT CHECK (status IN ('draft','running','completed','archived')))
- `magic_up_generations` (22 col — campaign_id, provider TEXT, model TEXT, prompt TEXT, output JSONB, tokens_in INT, tokens_out INT, cost_usd NUMERIC(10,6), status TEXT, error TEXT)
- `magic_up_comments`, `magic_up_reactions`, `magic_up_public_shares` (12 col — share_token UUID UNIQUE, expires_at)

**Zod obrigatório em edge fn:** `logoBase64` OU `logoUrl` (XOR).

**`-- VERIFY 7:`** 7 tabelas `magic_up_%` presentes.

---

### `-- PHASE 8/14: ORÇAMENTOS & PEDIDOS`

**Tabelas principais:**
- `quotes` (57 col — número `QOT-YY-XXXX` gerado via trigger; seller_id UUID→profiles(user_id) NOT NULL ON DELETE NO ACTION; created_by, assigned_to UUID→profiles; client_id TEXT (CRM externo, sem FK); client_name, client_document TEXT, client_email, client_phone; status TEXT CHECK (status IN ('draft','sent','approved','rejected','expired','cancelled','converted')); subtotal, discount_amount, discount_percent, real_discount_percent NUMERIC (validado por alçada considerando markup), markup_ratio NUMERIC DEFAULT 1.0, freight NUMERIC, total_amount NUMERIC; expires_at TIMESTAMPTZ, sent_at, approved_at; approval_token UUID; **e-signature:** signature_cpf_cnpj TEXT, signature_ip INET, signature_user_agent TEXT, signature_hash TEXT, signed_at TIMESTAMPTZ; version INT, contract_version TEXT)
- `quote_items` (31 col — quote_id UUID→quotes ON DELETE CASCADE, product_id TEXT, variant_id TEXT, name, sku, quantity INT NOT NULL CHECK (quantity > 0), unit_price NUMERIC(14,4) NOT NULL, subtotal NUMERIC(14,4) generated stored, personalization_ids UUID[], sort_order INT, ...)
- `quote_item_personalizations` (18 col — quote_item_id, technique_id, location_name, area_cm2 NUMERIC, colors INT, setup_cost NUMERIC(14,4), unit_cost NUMERIC(14,4), quantity INT, subtotal generated stored)
- `quote_history` (10 col — quote_id, user_id UUID→profiles ON DELETE NO ACTION, action TEXT, before JSONB, after JSONB, at TIMESTAMPTZ)
- `quote_templates` (20 col — owner_id, name, items JSONB, is_public BOOL)
- `quote_drafts` (4 col — user_id, quote_id, draft JSONB, updated_at)
- `quote_approval_tokens` (20 col — quote_id, token UUID UNIQUE, expires_at, consumed_at, ip INET, user_agent TEXT, consumed_signature JSONB)
- `discount_approval_requests` (14 col — quote_id, seller_id UUID→profiles(user_id), admin_id UUID→profiles(user_id), requested_percent NUMERIC, real_discount_percent NUMERIC, reason TEXT, status TEXT CHECK (status IN ('pending','approved','rejected','expired')), expires_at)
- `discount_approval_audit` (13 col — request_id, actor_id UUID→profiles(user_id) ON DELETE NO ACTION, action TEXT, before JSONB, after JSONB, at)
- `seller_discount_limits` (8 col — user_id UUID UNIQUE→profiles(user_id), max_discount_percent NUMERIC, max_absolute NUMERIC, set_by UUID→profiles(user_id))
- `follow_up_reminders` (12 col — quote_id, user_id, remind_at TIMESTAMPTZ, message TEXT, done BOOL)
- `orders` (37 col — número `PED-YY-XXXX` gerado via trigger; quote_id UUID→quotes ON DELETE NO ACTION; status TEXT CHECK; client fields duplicated para congelamento; totais, entrega, pagamento; **integração CRM** via `bitrix_deal_id TEXT`)
- `order_items` (18 col — order_id, product_id, sku, name, quantity, unit_price NUMERIC(14,4), subtotal generated)
- `order_item_personalizations` (11 col — mesma ideia de quote_item_personalizations)

**Triggers:**
```sql
-- QOT-YY-XXXX
CREATE OR REPLACE FUNCTION public.fn_next_quote_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE y CHAR(2) := to_char(now(), 'YY'); n INT;
BEGIN
  IF NEW.number IS NOT NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(MAX(NULLIF(SPLIT_PART(number,'-',3),'')::INT), 0) + 1 INTO n
  FROM public.quotes WHERE number LIKE 'QOT-' || y || '-%';
  NEW.number := 'QOT-' || y || '-' || LPAD(n::TEXT, 4, '0');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_quotes_number BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.fn_next_quote_number();

-- PED-YY-XXXX (idem para orders)
```

**Validação e-signature** (trigger BEFORE UPDATE em `quotes` quando status → 'approved'):
```sql
-- Requer signature_cpf_cnpj + signature_ip + signature_user_agent + signature_hash NOT NULL
-- signature_hash = SHA-256 hex de (quote_number || cpf_cnpj || ip || user_agent || signed_at)
```

**RLS orçamento (essencial):**
- Vendedor vê só próprios (`seller_id = auth.uid()` OR `assigned_to = auth.uid()` OR `created_by = auth.uid()`)
- Manager (has_role) vê time inteiro
- Admin vê tudo
- **Anon** com `approval_token` válido lê view `v_quote_public` (Fase 3 cria a view; policy usa `token = current_setting`)

**Whitelist markup** (view pública NUNCA revela `markup_ratio` cru):
```sql
CREATE OR REPLACE VIEW public.v_quote_public AS
SELECT id, number, client_name, client_document, subtotal, discount_amount,
       discount_percent, freight, total_amount, expires_at, status,
       signed_at, signature_cpf_cnpj  -- assinatura pública ok
       -- markup_ratio, real_discount_percent, cost_price OMITIDOS
FROM public.quotes WHERE status IN ('sent','approved');
```

**`-- VERIFY 8:`** 14 tabelas do domínio orçamento/pedido + view `v_quote_public` + funções `fn_next_quote_number`/`fn_next_order_number` presentes.

---

### `-- PHASE 9/14: CRM & FORNECEDORES` (integrações externas)

- `external_connections` (15 col — name TEXT UNIQUE, provider TEXT CHECK (provider IN ('bitrix24','n8n','supabase','custom')), base_url TEXT, is_active BOOL, config JSONB, credentials_ref TEXT, last_ping_at, last_error TEXT, ...)
- `external_connections_sync_log` (12 col — connection_id, direction TEXT, payload_summary JSONB, status TEXT, duration_ms INT, occurred_at)
- `connection_test_history` (21 col — connection_id, tested_at, latency_ms, http_status, success BOOL, response_snapshot JSONB, tested_by UUID→profiles)
- `product_sync_logs` (17 col — supplier_id, run_id UUID, source TEXT, rows_in INT, rows_upsert INT, rows_error INT, duration_ms, started_at, finished_at, error TEXT)
- `crm_callback_events` (10 col — provider, event_type TEXT, payload JSONB, correlation_id, received_at, processed_at, status TEXT)
- `integration_credentials` (16 col — provider TEXT, secret_ref TEXT NOT NULL, scope TEXT, rotated_at, expires_at, created_by UUID→profiles) — RLS admin-only + `service_role`
- `inbound_webhook_endpoints` (17 col — slug TEXT UNIQUE, hmac_secret_ref TEXT, is_active, allowed_ips INET[])
- `inbound_webhook_events` (13 col — endpoint_id, payload_hash, payload JSONB, hmac_valid BOOL, received_at, processed_at)
- `outbound_webhooks` (19 col — target_url TEXT, event_types TEXT[], hmac_secret_ref, retry_policy JSONB, is_active)
- `webhook_deliveries` (11 col — outbound_webhook_id, payload JSONB, response_status, response_body TEXT, attempts INT, delivered_at, next_attempt_at)
- `webhook_delivery_locks` (3 col — delivery_id UUID PK, locked_by TEXT, locked_at) — advisory lock em row

**RPC** `fn_admin_sync_external_connections()` (wrapper admin-only sobre função interna); revoke PUBLIC.

**`-- VERIFY 9:`** 11 tabelas CRM/webhook + RPC `fn_admin_sync_external_connections` presente.

---

### `-- PHASE 10/14: OBSERVABILIDADE`

- `frontend_telemetry` (10 col — session_id, user_id, event_name TEXT, payload JSONB, occurred_at, ip INET, user_agent, path TEXT)
- `query_telemetry` (18 col — query_hash TEXT, table_name, operation TEXT, duration_ms, rows INT, user_id, request_id, occurred_at)
- `app_vitals` (9 col — metric TEXT CHECK (metric IN ('LCP','CLS','INP','TTFB','FID')), value NUMERIC, path, occurred_at)
- `system_error_logs` (8 col — level TEXT, message TEXT, stack TEXT, context JSONB, source TEXT, occurred_at)
- `webhook_delivery_metrics` **PARTICIONADA por mês em `occurred_at`** (15 col — request_id TEXT, source TEXT, direction TEXT, target TEXT, http_status INT, duration_ms INT, retry_count INT, occurred_at, error TEXT, correlation_id UUID) — 4 partições rolling
- `ai_usage_logs` (13 col — user_id, provider TEXT, model TEXT, feature TEXT, tokens_in INT, tokens_out INT, cost_usd NUMERIC(10,6), request_id, occurred_at)
- `ai_usage_events` (6 col — user_id, feature, count INT, day DATE, UNIQUE (user_id, feature, day))
- `ai_usage_quotas` (6 col — user_id UUID UNIQUE, monthly_limit_tokens INT, monthly_limit_usd NUMERIC(10,2), used_tokens INT DEFAULT 0, used_usd NUMERIC(10,6) DEFAULT 0)
- `ai_insights_cache` (11 col — key TEXT UNIQUE, payload JSONB, ttl_at TIMESTAMPTZ, hits INT DEFAULT 0)

**RPCs de saúde:**
- `get_app_health_summary(_minutes INT DEFAULT 15) → TABLE(...)` (admin/dev, agrega webhook_delivery_metrics)
- `lookup_request_id(_request_id TEXT) → TABLE(...)` (admin/dev)
- `get_webhook_delivery_summary(_from TIMESTAMPTZ, _to TIMESTAMPTZ) → TABLE(...)`

Todas: `REVOKE EXECUTE FROM PUBLIC; GRANT EXECUTE TO authenticated;` + guard interno com `has_role('admin')` OU `is_dev()`.

**`-- VERIFY 10:`** 9 tabelas + 3 RPCs de saúde presentes.

---

### `-- PHASE 11/14: MCP KEYS & STEP-UP AUTH`

- `mcp_api_keys` (13 col — id, user_id UUID→profiles(user_id) NOT NULL, key_hash TEXT UNIQUE NOT NULL, key_prefix TEXT NOT NULL, scope TEXT CHECK (scope IN ('read','write','full')), issued_at, expires_at, last_used_at, revoked_at, revoked_reason TEXT, granted_by UUID→profiles(user_id))
  - **Trigger AFTER DELETE em `user_roles`** revoga chaves FULL do usuário que perdeu role dev
- `mcp_full_grantors` (4 col — grantor_id UUID UNIQUE→profiles(user_id), granted_at, granted_by UUID→profiles) — quem pode emitir FULL
- `mcp_key_auto_revocations` (7 col — key_id, reason TEXT, revoked_at, trigger_source TEXT)
- `mcp_access_violations` (11 col — key_id, endpoint TEXT, ip INET, reason TEXT, occurred_at)

**RPCs:**
- `validate_mcp_key(_key TEXT) → TABLE(user_id UUID, scope TEXT, valid BOOL)` (SECURITY DEFINER; introspecção via hash)
- `can_grant_mcp_full(_user_id UUID) → BOOLEAN`
- `auto_revoke_orphan_full_keys() → INT` (cron a cada 15min)

**Trigger de revogação instantânea:**
```sql
CREATE OR REPLACE FUNCTION public.fn_revoke_mcp_full_on_dev_loss()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role = 'dev' AND NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = OLD.user_id AND role = 'dev'
  ) THEN
    UPDATE public.mcp_api_keys
       SET revoked_at = now(), revoked_reason = 'dev_role_lost'
     WHERE user_id = OLD.user_id AND scope = 'full' AND revoked_at IS NULL;
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER trg_user_roles_revoke_mcp AFTER DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.fn_revoke_mcp_full_on_dev_loss();
```

**Step-Up Auth (MFA gated):**
- `step_up_challenges` (14 col — user_id, action TEXT, target TEXT, challenge_hash TEXT, expires_at, consumed_at)
- `step_up_tokens` (10 col — user_id, token_hash TEXT UNIQUE, action TEXT, target TEXT, expires_at, consumed_at) — trigger valida `expires_at > now()`
- `step_up_audit_log` (11 col — user_id, action, target, granted BOOL, aal TEXT CHECK (aal IN ('aal1','aal2')), amr TEXT[], occurred_at)

**RPC `consume_step_up_token(_token TEXT, _action TEXT) → BOOLEAN`** (SECURITY DEFINER).

**`-- VERIFY 11:`** 7 tabelas + trigger + 3 RPCs presentes.

---

### `-- PHASE 12/14: SIMULADOR & MOCKUPS`

- `simulation_runs` (12 col — user_id, product_id, config JSONB, result JSONB, duration_ms, status TEXT, started_at, finished_at)
- `simulation_logs` (8 col — run_id, level, message, at)
- `simulator_wizard_drafts` (9 col — user_id, draft JSONB, updated_at)
- `optimization_queue` (14 col — kind TEXT, payload JSONB, priority INT, status TEXT CHECK (status IN ('queued','running','done','failed')), attempts INT, next_run_at, locked_at, locked_by TEXT)
- `optimization_queue_runs` (8 col — queue_id, started_at, finished_at, status, error TEXT)
- `mockup_templates` (13 col — name, category, template_svg TEXT, palette JSONB, is_active)
- `mockup_prompt_configs` (10 col — template_id, prompt TEXT NOT NULL, provider TEXT, model TEXT, temperature NUMERIC)
- `mockup_prompt_history` (10 col — config_id, prompt_snapshot TEXT, output_snapshot TEXT, occurred_at)
- `mockup_drafts` (13 col — user_id, product_id, config JSONB, preview_url TEXT)
- `generated_mockups` (29 col — user_id, product_id, template_id, prompt TEXT, image_url TEXT NOT NULL, cost_usd NUMERIC(10,6), tokens INT, status TEXT, generated_at)
- `art_file_attachments` (13 col — owner_id UUID→profiles, kind TEXT CHECK (kind IN ('logo','artwork','mockup','other')), storage_path TEXT NOT NULL, size_bytes INT, mime_type TEXT, virus_scan_status TEXT DEFAULT 'pending')

**`-- VERIFY 12:`** 11 tabelas simulator/mockup presentes.

---

### `-- PHASE 13/14: STORAGE BUCKETS + CRON JOBS`

**Buckets (via `storage.buckets` insert):**
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES
  ('logos','logos', true, 5242880, ARRAY['image/png','image/jpeg','image/svg+xml']),
  ('personalization','personalization', false, 20971520, ARRAY['image/png','image/jpeg','application/pdf']),
  ('art-files','art-files', false, 52428800, ARRAY['image/png','image/jpeg','application/pdf','image/svg+xml']),
  ('mockups','mockups', true, 20971520, ARRAY['image/png','image/jpeg','image/webp']),
  ('magic-up','magic-up', false, 20971520, ARRAY['image/png','image/jpeg']),
  ('product-cdn','product-cdn', true, 20971520, ARRAY['image/png','image/jpeg','image/webp','video/mp4'])
ON CONFLICT (id) DO NOTHING;
```

**Storage RLS** (padrão user-scoped, exceto públicos):
```sql
-- Personalization: só o dono acessa
CREATE POLICY "Usuários leem próprios arquivos de personalização"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'personalization' AND (auth.uid()::text = (storage.foldername(name))[1]));
CREATE POLICY "Usuários enviam próprios arquivos de personalização"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'personalization' AND (auth.uid()::text = (storage.foldername(name))[1]));
-- (idem UPDATE/DELETE; replicar para art-files, magic-up)

-- Logos, mockups, product-cdn: leitura pública, escrita autenticada
CREATE POLICY "Leitura pública de logos" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'logos');
```

**Cron jobs** (via `cron.schedule`; use `supabase--insert`, NÃO migration, pois URL/anon-key são específicos do projeto):

```sql
-- Cleanup trash 30d
SELECT cron.schedule('trash-cleanup-favorites', '0 3 * * *',
  $$DELETE FROM public.favorite_items_trash WHERE expires_at < now();$$);
SELECT cron.schedule('trash-cleanup-collections', '5 3 * * *',
  $$DELETE FROM public.collection_items_trash WHERE expires_at < now();$$);

-- Auto-revoke MCP full órfão (15min)
SELECT cron.schedule('mcp-auto-revoke-full', '*/15 * * * *',
  $$SELECT public.auto_revoke_orphan_full_keys();$$);

-- Refresh MV de ruptura de estoque (5min)
SELECT cron.schedule('mv-refresh-stock-rupture', '*/5 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_stock_rupture_alert;$$);

-- Rotate admin_audit_log partitions (diário)
SELECT cron.schedule('rotate-admin-audit-partitions', '0 2 * * *',
  $$SELECT public.fn_rotate_admin_audit_partitions();$$);

-- Webhook alerts → Sentry (1min) — invoca edge function
SELECT cron.schedule('webhook-alerts-monitor', '* * * * *',
  $$SELECT net.http_post(
    url:='https://doufsxqlfjyuvxuezpln.supabase.co/functions/v1/webhook-alerts-monitor',
    headers:='{"Content-Type":"application/json","apikey":"<ANON_KEY>"}'::jsonb,
    body:='{}'::jsonb
  );$$);

-- Watcher price drop favorites/collections (hourly)
SELECT cron.schedule('watcher-price-drop', '0 * * * *',
  $$SELECT net.http_post(
    url:='https://doufsxqlfjyuvxuezpln.supabase.co/functions/v1/watcher-price-drop',
    headers:='{"Content-Type":"application/json","apikey":"<ANON_KEY>"}'::jsonb,
    body:='{}'::jsonb
  );$$);
```

**`-- VERIFY 13:`** `SELECT COUNT(*) FROM cron.job;` ≥6; `SELECT COUNT(*) FROM storage.buckets;` ≥6.

---

### `-- PHASE 14/14: EDGE FUNCTIONS`

**Estrutura padrão para toda edge function** (`supabase/functions/<name>/index.ts`):

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';
import { buildPublicCorsHeaders, getCorsHeaders } from '../_shared/cors.ts';
import { createStructuredLogger, withRequestIdHeader } from '../_shared/structured-logger.ts';

const Schema = z.object({ /* ... */ });

Deno.serve(async (req) => {
  const log = createStructuredLogger({ fn: '<name>', req });
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      log.warn('invalid_input', { errors: parsed.error.flatten().fieldErrors });
      return withRequestIdHeader(new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      ), log);
    }

    // Auth (verify_jwt=false na config; validação manual)
    const authHeader = req.headers.get('Authorization') ?? '';
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      log.warn('unauthorized');
      return withRequestIdHeader(new Response(
        JSON.stringify({ error: 'unauthorized' }),
        { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
      ), log);
    }

    // ...lógica...

    log.info('ok');
    return withRequestIdHeader(new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    ), log);
  } catch (err) {
    log.error('failed', { err: String(err) });
    return withRequestIdHeader(new Response(
      JSON.stringify({ error: 'internal' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    ), log);
  }
});
```

**Lista completa das ~85 edge functions** com contrato I/O sintético (nome → método, entrada, saída, auth):

#### Auth & Security
| Nome | Método | Body | Saída | Auth |
|---|---|---|---|---|
| `secrets-manager` | POST | `{action,name,value?}` | `{ok}` | admin |
| `connection-tester` | POST | `{connection_id}` | `{latency_ms,status,response}` | admin |
| `mcp-server` | POST | RPC JSON | RPC result | mcp key (Bearer) |
| `mcp-keys-issue` | POST | `{user_id,scope,expires_at?}` | `{key,key_prefix}` | admin + step-up |
| `mcp-keys-rotate` | POST | `{key_id}` | `{new_key,new_prefix}` | owner + step-up |
| `mcp-keys-update` | POST | `{key_id,expires_at?}` | `{ok}` | owner |
| `mcp-keys-revoke` | POST | `{key_id,reason}` | `{ok}` | owner ou admin |
| `full-op-diagnostics` | GET | — | `{is_dev,can_grant_full,step_up_valid}` | dev |
| `ownership-repair` | POST | `{dry_run,table,strategy}` | `{fixed,skipped,errors}` | admin + step-up |
| `password-reset-request` | POST | `{email}` | `{ok}` | anon (rate-limited) |
| `bulk-random-passwords` | POST | `{user_ids[]}` | `{updated}` | admin + step-up |

#### CRM & External
| Nome | Método | Body | Saída | Auth |
|---|---|---|---|---|
| `crm-db-bridge` | POST | `{op,params}` | RPC result | authenticated + custom RBAC |
| `external-db-bridge` | POST | `{op,params}` | RPC result | authenticated |
| `webhook-inbound` | POST | provider payload | `{received:true}` | HMAC |
| `webhook-dispatcher` | POST | `{event,payload}` | `{delivered_count}` | service_role internal |
| `webhook-alerts-monitor` | POST | `{}` | `{alerts_sent}` | cron only |
| `crm-callback-handler` | POST | callback payload | `{ok}` | HMAC |

#### Quotes & Orders
| Nome | Método | Body | Saída | Auth |
|---|---|---|---|---|
| `quote-public-view` | GET | `?token=` | `{quote_public}` (whitelist markup) | anon (token válido) |
| `quote-public-approve` | POST | `{token,signature:{cpf_cnpj,ip,ua}}` | `{approved,quote_number}` | anon (token válido) |
| `quote-sync-crm` | POST | `{quote_id}` | `{bitrix_deal_id}` | authenticated |
| `discount-approval-request` | POST | `{quote_id,requested_percent,reason}` | `{request_id}` | vendedor |
| `discount-approval-decide` | POST | `{request_id,decision,note}` | `{ok}` | admin |
| `follow-up-cron` | POST | `{}` | `{sent}` | cron |
| `order-create-from-quote` | POST | `{quote_id}` | `{order_number}` | authenticated |

#### Favoritos / Coleções / Comparação (públicos)
| Nome | Método | Body | Saída | Auth |
|---|---|---|---|---|
| `favorites-public-view` | GET | `?token=` | `{list,items}` | anon (token) |
| `favorites-public-react` | POST | `{token,item_id,emoji}` | `{ok}` | anon + rate-limit 5/min/ip |
| `collections-public-view` | GET | `?token=` | `{collection,items}` | anon (token) |
| `collections-public-react` | POST | `{token,item_id,emoji}` | `{ok}` | anon |
| `comparisons-public-view` | GET | `?token=` | `{comparison}` | anon (token) |
| `comparisons-public-react` | POST | `{token,emoji}` | `{ok}` | anon |
| `watcher-price-drop` | POST | `{}` | `{notified}` | cron |

#### Magic-Up (branding/campanhas)
| Nome | Método | Body | Saída | Auth |
|---|---|---|---|---|
| `magic-up-generate` | POST | `{brand_kit,brief,channels,logoBase64?/logoUrl?}` | `{generation_id,output}` | authenticated + AI quota |
| `magic-up-remix` | POST | `{generation_id,tweaks}` | `{generation_id}` | authenticated |
| `magic-up-public-view` | GET | `?token=` | `{campaign}` | anon (token) |

#### Simulador / Mockups
| Nome | Método | Body | Saída | Auth |
|---|---|---|---|---|
| `simulator-run` | POST | `{product_id,config}` | `{run_id,result}` | authenticated |
| `mockup-generate` | POST | `{product_id,template_id,prompt}` | `{image_url,cost}` | authenticated + AI quota |
| `mockup-remix-prompt` | POST | `{config_id,tweaks}` | `{prompt}` | admin |
| `art-scan-file` | POST | `{attachment_id}` | `{verdict}` | service_role (async) |

#### Observabilidade & Health
| Nome | Método | Body | Saída | Auth |
|---|---|---|---|---|
| `health-check` | GET | — | `{db,redis,ai,storage}` | anon |
| `cors-audit` | GET | — | `{shared,snapshot,audit}` | dev only |
| `telemetry-ingest` | POST | `{events[]}` | `{accepted}` | authenticated (rate-limited) |

**Config** (`supabase/config.toml`): todas com `verify_jwt = false` (validação manual em código). Publish edge functions via `supabase--deploy_edge_functions`.

**`-- VERIFY 14:`** todas as 85 funções deployadas (`SELECT COUNT(*)` via API de management ou `supabase functions list`).

---

## 4. SEEDS MÍNIMOS (aplicar via `supabase--insert`)

```sql
-- Feature flags (system_kill_switches)
INSERT INTO public.system_kill_switches (name, is_enabled, reason) VALUES
  ('ai_generation', true, 'default_on'),
  ('public_quote_view', true, 'default_on'),
  ('mcp_keys_issue', true, 'default_on'),
  ('discount_approval', true, 'default_on')
ON CONFLICT (name) DO NOTHING;

-- access_security_settings default
INSERT INTO public.access_security_settings (id, min_password_length, mfa_required, session_ttl_minutes)
VALUES (gen_random_uuid(), 12, false, 1440)
ON CONFLICT DO NOTHING;

-- Países permitidos default
INSERT INTO public.geo_allowed_countries (country_code, is_allowed, reason) VALUES
  ('BR', true, 'primary_market')
ON CONFLICT (country_code) DO NOTHING;

-- ai_usage_quotas default para service_role bootstrap
-- (opcional; app cria on-demand)
```

**Sem admin user seed** — o primeiro `dev`/`admin` é promovido manualmente pelo PO após o primeiro signup via:
```sql
-- Rode UMA VEZ, substituindo o email:
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'dev'::public.app_role FROM public.profiles WHERE email = 'PO@promobrindes.com.br'
ON CONFLICT DO NOTHING;
```

---

## 5. VERIFICAÇÕES PÓS-MIGRATION (rodar após Fase 14)

```sql
-- 5.1 Toda tabela public tem RLS ativo
SELECT tablename FROM pg_tables t
LEFT JOIN pg_class c ON c.relname = t.tablename
WHERE t.schemaname = 'public'
  AND NOT c.relrowsecurity;
-- esperado: 0 linhas

-- 5.2 Toda tabela public tem ao menos uma policy
SELECT t.tablename FROM pg_tables t
LEFT JOIN pg_policies p ON p.schemaname=t.schemaname AND p.tablename=t.tablename
WHERE t.schemaname='public' GROUP BY t.tablename HAVING COUNT(p.policyname)=0;
-- esperado: 0 linhas

-- 5.3 Nenhuma FK apontando para auth.users em colunas de exibição
SELECT t.relname||'.'||a.attname
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
-- esperado: 0 linhas

-- 5.4 Nenhuma SECURITY DEFINER sem search_path
SELECT p.proname
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
  AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig,'{}'::text[])) cfg
                  WHERE cfg LIKE 'search_path=%');
-- esperado: 0 linhas

-- 5.5 Nenhuma FK NOT NULL com ON DELETE SET NULL/SET DEFAULT
SELECT t.relname||'.'||a.attname
FROM pg_constraint c
JOIN pg_class t ON t.oid=c.conrelid
JOIN pg_namespace n ON n.oid=t.relnamespace
JOIN LATERAL unnest(c.conkey) ck(an) ON true
JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=ck.an
WHERE c.contype='f' AND n.nspname='public'
  AND a.attnotnull AND c.confdeltype IN ('n','d')
  AND (SELECT count(*) FROM unnest(c.conkey))=1;
-- esperado: 0 linhas

-- 5.6 profiles.role coerente com user_roles
SELECT p.user_id FROM public.profiles p
JOIN (
  SELECT user_id,(ARRAY_AGG(role::text ORDER BY CASE role::text
    WHEN 'dev' THEN 1 WHEN 'admin' THEN 2 WHEN 'coordenador' THEN 3
    WHEN 'supervisor' THEN 4 WHEN 'manager' THEN 5
    WHEN 'agente' THEN 6 WHEN 'vendedor' THEN 7 ELSE 99 END))[1] r
  FROM public.user_roles GROUP BY user_id
) c ON c.user_id=p.user_id
WHERE p.role IS DISTINCT FROM public.fn_map_role_enum_to_profile(c.r);
-- esperado: 0 linhas

-- 5.7 Contagem final aproximada
SELECT COUNT(*) AS total_tables FROM information_schema.tables
WHERE table_schema='public' AND table_type='BASE TABLE';
-- esperado: ~145 tabelas
```

---

## 6. GATES DE CI A EXECUTAR APÓS APLICAR

Rode nesta ordem (todos devem passar):

```bash
node scripts/validate-supabase-config.mjs           # Gate 0 — SSOT ok
node scripts/check-security-definer-audit.mjs        # search_path travado
node scripts/check-security-definer-acl.mjs          # REVOKE PUBLIC ok
node scripts/check-supabase-linter.mjs               # baseline supabase linter
node scripts/check-edge-structured-logging.mjs       # logger SSOT em todas edges
node scripts/check-edge-request-id-propagation.mjs   # X-Request-Id propagado
node scripts/check-edge-cors-headers.mjs             # x-request-id em CORS
node scripts/check-no-inline-cors.mjs                # helper SSOT usado
node scripts/build-cors-snapshot.mjs && git diff --exit-code supabase/functions/_shared/cors-snapshot.json
npm run test -- tests/rls                            # policies obrigatórias
npm run test -- tests/lib/gold-relations.test.ts     # Gold contract
npm run test -- tests/unit/supabase-schema-contract.test.ts
```

---

## 7. ROLLBACK POR FASE

Cada fase gera um par `phase_NN_up.sql` + `phase_NN_down.sql`. O `down` faz o inverso na ordem reversa:

```
DROP POLICY ... ON public.<tabela>;
ALTER TABLE public.<tabela> DISABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.<tabela> FROM authenticated, anon, service_role;
DROP TABLE IF EXISTS public.<tabela> CASCADE;
DROP TYPE IF EXISTS public.<enum> CASCADE;
```

Rollback nunca cascateia através de fases: pare na fase que precisa reverter, rode `phase_NN_down.sql`, corrija, replique `phase_NN_up.sql`.

---

## 8. CHECKLIST DE HANDOFF

Ao terminar as 14 fases, entregue:

- [ ] Todas as 14 migrations aplicadas em `doufsxqlfjyuvxuezpln` com sucesso
- [ ] Todos os 7 VERIFY blocks retornando 0 violações (§5)
- [ ] Todos os gates de CI passando (§6)
- [ ] `supabase/migrations/` sincronizado com o histórico do banco (`supabase db diff --linked --schema public` = vazio)
- [ ] `src/integrations/supabase/types.ts` regenerado
- [ ] Lista de edge functions deployadas conferida via `supabase functions list`
- [ ] `docs/E2E_SMOKE_COVERAGE.md` atualizado se rotas mudaram
- [ ] Snapshot em `supabase/migrations-snapshot/` regenerado (`npm run schema:snapshot`)
- [ ] Relatório final em `qa/CANONICAL_BUILD_REPORT.md` com contagem de tabelas, policies, funções e cron jobs

---

## 9. REGRAS FINAIS PARA O CLAUDE EXECUTOR

1. **Nunca pule VERIFY.** Falhou → pare e reporte a query + linha.
2. **Nunca combine fases** em uma migration única.
3. **Nunca aplique DDL diretamente** — sempre via `supabase--migration` (aguarda approve do PO).
4. **Seeds vão via `supabase--insert`**, nunca via migration (URL/anon-key são dados do projeto).
5. **Cron jobs vão via `supabase--insert`** pelo mesmo motivo.
6. **Edge functions:** escreva o arquivo em `supabase/functions/<name>/index.ts`, depois `supabase--deploy_edge_functions` com a lista.
7. **Se qualquer regra deste prompt entrar em conflito com o `project-knowledge` do repo, o `project-knowledge` vence** (SSOT `doufsxqlfjyuvxuezpln` é inviolável).
8. **Comunique em PT-BR.** Toda mensagem, comentário SQL, e nome de policy em português.
9. **Antes de qualquer alteração de schema**, confirme com o PO se ele autoriza — a REGRA #1 do `project-knowledge` exige aprovação explícita.

---

**FIM DO PROMPT.**

Cole este arquivo em uma nova sessão do Claude Code e execute na ordem apresentada. Boa sorte, DBA — construa com excelência.
