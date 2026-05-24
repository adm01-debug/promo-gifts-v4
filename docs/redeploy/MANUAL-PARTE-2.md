# Manual de Migração — PARTE 2 (Fases 3 a 16)

> Esta é a **continuação** do manual. Leia primeiro a [Parte 1](./MANUAL-MIGRACAO-LOVABLE-PARA-SUPABASE-OFICIAL.md).

---

## 8. Fase 3 — Corrigir drift coluna-a-coluna em waves {#8-fase-3}

**Objetivo**: zerar o `schema_diff` entre tabelas que existem nos dois bancos.

**Princípio**: uma wave por sessão de raciocínio. Wave por wave. Nunca tudo de uma vez.

### Wave 3.1 — Quick wins (colunas faltantes)

Tabelas onde **só falta adicionar uma ou outra coluna** num dos lados. Risco baixo, rápido.

#### Padrão de pré-validação obrigatório

```sql
-- ANTES de adicionar uma coluna:
SELECT
  (SELECT count(*) FROM public.<tabela>) AS rows,
  (SELECT count(*) FROM information_schema.views v
    WHERE v.view_definition ILIKE '%<tabela>%<coluna>%') AS views_dep,
  (SELECT count(*) FROM pg_indexes
    WHERE schemaname='public' AND tablename='<tabela>'
      AND indexdef ILIKE '%<coluna>%') AS idx_dep;
```

Se `views_dep > 0` ou `idx_dep > 0`, investigue antes de mexer.

#### Exemplo real (Promo Gifts V4)

```sql
-- Wave 3.1.A no Oficial:
ALTER TABLE public.frontend_telemetry
  ALTER COLUMN duration_ms TYPE double precision USING duration_ms::double precision;

ALTER TABLE public.ip_access_control
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Trigger para auto-set updated_at
CREATE OR REPLACE FUNCTION public.tg_ip_access_control_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON public.ip_access_control;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.ip_access_control
  FOR EACH ROW EXECUTE FUNCTION public.tg_ip_access_control_set_updated_at();
```

### Wave 3.2 — Convenções de naming

Quando uma tabela usa `customer_*` num lado e `client_*` no outro. Padronize pelo mais usado nos consumidores reais.

**Cuidado**: renomear coluna quebra `RLS policies` que mencionam o nome antigo. Sempre busque `pg_policies.qual`:

```sql
-- Achar policies que referenciam a coluna antiga
SELECT schemaname, tablename, policyname, qual::text
  FROM pg_policies
 WHERE qual::text ILIKE '%<coluna_antiga>%'
    OR with_check::text ILIKE '%<coluna_antiga>%';
```

Para cada policy encontrada, faça `DROP POLICY` + `ALTER COLUMN RENAME` + `CREATE POLICY` com o nome novo.

### Wave 3.3 — Conflitos graves (tipos, PKs)

Quando uma coluna tem tipos diferentes (`text` vs `uuid`, `numeric` vs `double precision`).

#### Padrão de cast seguro

```sql
-- Sempre validar antes:
SELECT count(*) AS invalid
  FROM public.<tabela>
 WHERE <coluna> IS NOT NULL
   AND <coluna> !~* '^<regex_do_tipo_destino>$';

-- Para text → uuid:
-- regex: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'

-- Se 0 inválidos, cast:
ALTER TABLE public.<tabela>
  ALTER COLUMN <coluna> TYPE uuid USING NULLIF(<coluna>, '')::uuid;
```

#### Cuidado com índices únicos que usam sentinelas

Se existir um índice tipo:

```sql
CREATE UNIQUE INDEX idx_unique ON ... (col, COALESCE(other, ''::text));
```

E você muda `other` para `uuid`, precisa recriar o índice com sentinela uuid:

```sql
DROP INDEX idx_unique;
ALTER TABLE ... ALTER COLUMN other TYPE uuid USING NULLIF(other, '')::uuid;
CREATE UNIQUE INDEX idx_unique
  ON ... (col, COALESCE(other, '00000000-0000-0000-0000-000000000000'::uuid));
```

### Wave 3.4 — Catástrofes (refactor destrutivo)

Quando uma tabela tem schemas radicalmente diferentes (B2B sério vs B2C simplista).

**Regra**: refactor destrutivo só é aceitável se o lado a ser reescrito tem **0 rows e 0 FKs incoming**.

#### Padrão BPM

```
1. Pré-validação:
   - SELECT count(*) — confirmar 0 rows do lado a ser reescrito
   - Confirmar FKs incoming (information_schema)
   - Confirmar views/funções dependentes
2. Gateway: dados a preservar?
   Sim → migrar (INSERT INTO temp SELECT ... DROP ... CREATE ... INSERT FROM temp)
   Não → DROP CASCADE + CREATE limpo
3. Recriar índices
4. Recriar policies RLS
5. Recriar triggers (especialmente updated_at)
```

#### Exemplo real (order_items)

```sql
-- Lovable.order_items: schema legado B2C, 0 rows confirmadas
BEGIN;

-- 1) Drop índices dependentes
DROP INDEX IF EXISTS public.idx_order_items_organization_id;
DROP INDEX IF EXISTS public.idx_order_items_product_id;

-- 2) DROP 9 colunas legacy
ALTER TABLE public.order_items
  DROP COLUMN IF EXISTS color_hex,
  DROP COLUMN IF EXISTS color_name,
  -- ... etc.
  DROP COLUMN IF EXISTS total_price;

-- 3) Cast product_id text → uuid
ALTER TABLE public.order_items
  ALTER COLUMN product_id TYPE uuid USING NULLIF(product_id, '')::uuid;

-- 4) ADD 9 colunas do oficial (B2B)
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS personalization_config jsonb,
  -- ... etc.
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 5) Recriar índice
CREATE INDEX idx_order_items_product_id ON public.order_items USING btree (product_id);

-- 6) Trigger updated_at
-- ... padrão acima ...

COMMIT;
```

### Saída esperada da Fase 3

Uma migration por wave em `supabase/migrations/`, relatório `docs/redeploy/FASE-3-EXECUTION-LOG.md`.

---

## 9. Fase 3.5 — Drift residual + allowlist {#9-fase-35}

**Objetivo**: lidar com tabelas onde alinhar drift **não é desejável** (cache, infra, particionamento).

### Quando uma tabela vai para allowlist

| Categoria | Critério | Exemplo |
|---|---|---|
| `cache_denormalizado` | Tabela é cópia de cache do SSOT, com colunas extras tipo `synced_at` | `products` denormalizado no Lovable |
| `infra_independente` | Mesmo nome, propósitos diferentes nos dois bancos | `bot_detection_log` |
| `particao_log` | Particionamento mensal usado só num lado | `admin_audit_log_y2026m05` |
| `infra_lovable` | Tabela usada só pelo runtime Lovable Cloud | `simulation_logs`, `e2e_cleanup_audit` |

### Criar a allowlist

```sql
CREATE TABLE IF NOT EXISTS public.schema_drift_allowlist (
  table_name text PRIMARY KEY,
  reason     text NOT NULL,
  added_by   text NOT NULL,
  added_at   timestamptz NOT NULL DEFAULT now(),
  metadata   jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.schema_drift_allowlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage drift allowlist"
  ON public.schema_drift_allowlist
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles
                  WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles
                       WHERE user_id = auth.uid() AND role = 'admin'));

COMMENT ON TABLE public.schema_drift_allowlist IS
  'Divergências aceitáveis por design entre Lovable interno e Supabase oficial.';
```

### Popular a allowlist (sempre com `metadata.category`)

```sql
INSERT INTO public.schema_drift_allowlist (table_name, reason, added_by, metadata) VALUES
  ('products',
   'Cache denormalizado do catálogo SSOT (synced_at, external_id). Alinhar quebraria o cache.',
   'fase_3_5',
   '{"category":"cache_denormalizado"}'::jsonb),
  ('simulation_logs',
   'Telemetria interna do Lovable Cloud',
   'fase_3_5',
   '{"category":"infra_lovable"}'::jsonb)
ON CONFLICT (table_name) DO UPDATE
  SET reason = EXCLUDED.reason, added_at = now(), metadata = EXCLUDED.metadata;
```

---

## 10. Fase 4 — Gate CI de schema drift {#10-fase-4}

**Objetivo**: detecção automatizada de drift via pg_cron diário, alertando admins.

### Arquitetura

```
pg_cron 02:00 UTC
       │
       ▼
fn_run_schema_drift_check()
  ├─ trigger fetch (net.http_post async → Lovable RPC)
  ├─ polling até 30s em net._http_response
  └─ fn_compute_and_record_drift(signatures)
       │
       ▼
fn_compute_and_record_drift(jsonb)
  ├─ get_public_schema_signatures() local
  ├─ apply schema_drift_allowlist
  ├─ compute: only_oficial[], only_lovable[], schema_diff{}
  └─ record_schema_drift_result(payload)
       │
       ├─→ INSERT INTO schema_drift_log
       └─→ INSERT INTO workspace_notifications (se has_drift=true)
```

### Componentes a criar no Oficial

#### 10.1 — Tabela de log

```sql
CREATE TABLE IF NOT EXISTS public.schema_drift_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at            timestamptz NOT NULL DEFAULT now(),
  has_drift         boolean NOT NULL,
  tables_oficial    integer NOT NULL,
  tables_lovable    integer NOT NULL,
  only_oficial      text[] DEFAULT '{}',
  only_lovable      text[] DEFAULT '{}',
  schema_diff       jsonb DEFAULT '{}',
  notification_sent boolean DEFAULT false,
  error_message     text,
  allowlist_applied text[] DEFAULT '{}'
);

ALTER TABLE public.schema_drift_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read schema_drift_log"
  ON public.schema_drift_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles
                  WHERE user_id = auth.uid() AND role = 'admin'));
```

#### 10.2 — Settings (URL e anon key do Lovable)

```sql
INSERT INTO public.system_settings (key, value) VALUES
  ('lovable_url',      '"https://<lovable-id>.supabase.co"'::jsonb),
  ('lovable_anon_key', '"<JWT-anon-do-lovable>"'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
```

**Como obter a anon key do Lovable**: use `lovable_get_integrations(project_id)` e extraia `supabase.publishable_key`.

#### 10.3 — Função record_schema_drift_result

```sql
CREATE OR REPLACE FUNCTION public.record_schema_drift_result(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_log_id uuid;
  v_admin  uuid;
BEGIN
  INSERT INTO public.schema_drift_log (
    has_drift, tables_oficial, tables_lovable,
    only_oficial, only_lovable, schema_diff,
    notification_sent
  ) VALUES (
    (p_payload->>'has_drift')::boolean,
    (p_payload->>'tables_oficial')::integer,
    (p_payload->>'tables_lovable')::integer,
    ARRAY(SELECT jsonb_array_elements_text(p_payload->'only_oficial')),
    ARRAY(SELECT jsonb_array_elements_text(p_payload->'only_lovable')),
    p_payload->'schema_diff',
    false
  ) RETURNING id INTO v_log_id;

  -- Notificar admins se houver drift
  IF (p_payload->>'has_drift')::boolean THEN
    FOR v_admin IN
      SELECT user_id FROM public.user_roles WHERE role = 'admin'
    LOOP
      INSERT INTO public.workspace_notifications (
        user_id, category, title, message, severity, metadata
      ) VALUES (
        v_admin, 'system', 'Schema drift detectado',
        'O Gate CI detectou divergência de schema entre Lovable e Oficial. Veja schema_drift_log id=' || v_log_id,
        'warning',
        jsonb_build_object('log_id', v_log_id)
      );
    END LOOP;
    UPDATE public.schema_drift_log SET notification_sent = true WHERE id = v_log_id;
  END IF;

  RETURN v_log_id;
END;
$$;
```

#### 10.4 — Função compute (com allowlist e semântica correta)

```sql
CREATE OR REPLACE FUNCTION public.fn_compute_and_record_drift(p_lovable_signatures jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_oficial_sigs jsonb;
  v_only_oficial text[];
  v_only_lovable text[];
  v_diff         jsonb := '{}'::jsonb;
  v_has_drift    boolean;
  v_tab_oficial  int;
  v_tab_lovable  int;
  v_log_payload  jsonb;
  v_allowed      text[];
BEGIN
  SELECT array_agg(table_name) INTO v_allowed FROM public.schema_drift_allowlist;
  v_allowed := COALESCE(v_allowed, ARRAY[]::text[]);

  v_oficial_sigs := public.get_public_schema_signatures();

  SELECT array_agg(k ORDER BY k) INTO v_only_oficial
    FROM jsonb_object_keys(v_oficial_sigs) k
   WHERE NOT (p_lovable_signatures ? k) AND k != ALL(v_allowed);

  SELECT array_agg(k ORDER BY k) INTO v_only_lovable
    FROM jsonb_object_keys(p_lovable_signatures) k
   WHERE NOT (v_oficial_sigs ? k) AND k != ALL(v_allowed);

  SELECT jsonb_object_agg(k, jsonb_build_object(
           'oficial', v_oficial_sigs -> k,
           'lovable', p_lovable_signatures -> k))
    INTO v_diff
    FROM jsonb_object_keys(v_oficial_sigs) k
   WHERE p_lovable_signatures ? k
     AND (v_oficial_sigs -> k) <> (p_lovable_signatures -> k)
     AND k != ALL(v_allowed);

  v_diff := COALESCE(v_diff, '{}'::jsonb);
  v_tab_oficial := (SELECT COUNT(*) FROM jsonb_object_keys(v_oficial_sigs));
  v_tab_lovable := (SELECT COUNT(*) FROM jsonb_object_keys(p_lovable_signatures));

  -- SEMÂNTICA CORRETA: Oficial é SSOT (superset esperado).
  -- has_drift SÓ é true se:
  --   - only_lovable > 0  (algo novo no Lovable que viola SSOT)
  --   - schema_diff > 0   (tabelas em ambos divergentes)
  -- only_oficial é INFORMATIVO, não dispara alerta.
  v_has_drift := (COALESCE(array_length(v_only_lovable, 1), 0) > 0
                  OR (SELECT COUNT(*) FROM jsonb_object_keys(v_diff)) > 0);

  v_log_payload := jsonb_build_object(
    'has_drift',         v_has_drift,
    'tables_oficial',    v_tab_oficial,
    'tables_lovable',    v_tab_lovable,
    'only_oficial',      COALESCE(to_jsonb(v_only_oficial), '[]'::jsonb),
    'only_lovable',      COALESCE(to_jsonb(v_only_lovable), '[]'::jsonb),
    'schema_diff',       v_diff,
    'allowlist_applied', to_jsonb(v_allowed)
  );

  RETURN public.record_schema_drift_result(v_log_payload);
END;
$$;
```

⚠️ **Cuidado com a semântica de `has_drift`**: a versão inicial considerava `only_oficial > 0` como drift. **Não faça isso** — o Oficial é SSOT (superset esperado) e isso geraria alerta todo dia. Use exatamente a definição acima.

#### 10.5 — Função trigger fetch (HTTP async)

```sql
CREATE OR REPLACE FUNCTION public.fn_trigger_schema_drift_fetch()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_url     text;
  v_key     text;
  v_req_id  bigint;
BEGIN
  -- ATENÇÃO: extrair text de jsonb sem aspas extras (#>> '{}')
  SELECT value #>> '{}' INTO v_url FROM public.system_settings WHERE key = 'lovable_url';
  SELECT value #>> '{}' INTO v_key FROM public.system_settings WHERE key = 'lovable_anon_key';

  SELECT net.http_post(
    url := v_url || '/rest/v1/rpc/get_public_schema_signatures',
    headers := jsonb_build_object(
      'apikey',        v_key,
      'Authorization', 'Bearer ' || v_key,
      'Content-Type',  'application/json'
    ),
    body := '{}'::jsonb
  ) INTO v_req_id;

  RETURN v_req_id;
END;
$$;
```

⚠️ **Cuidado**: use `value #>> '{}'` para extrair string de jsonb sem aspas duplas. Se usar `value::text::text`, vai resultar em `"\"https://...\""` com aspas extras → erro "Out of memory" no `net.http_post`.

#### 10.6 — Função orquestradora (trigger + polling + compute)

```sql
CREATE OR REPLACE FUNCTION public.fn_run_schema_drift_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, net
AS $$
DECLARE
  v_req_id   bigint;
  v_status   integer;
  v_content  jsonb;
  v_log_id   uuid;
  v_attempts integer := 0;
BEGIN
  v_req_id := public.fn_trigger_schema_drift_fetch();

  -- Polling até 30s
  WHILE v_attempts < 30 LOOP
    PERFORM pg_sleep(1);
    SELECT status_code, content::jsonb
      INTO v_status, v_content
      FROM net._http_response
     WHERE id = v_req_id;

    IF v_status IS NOT NULL THEN EXIT; END IF;
    v_attempts := v_attempts + 1;
  END LOOP;

  IF v_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'timeout', 'req_id', v_req_id);
  END IF;

  IF v_status <> 200 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'http_' || v_status, 'req_id', v_req_id);
  END IF;

  v_log_id := public.fn_compute_and_record_drift(v_content);
  RETURN jsonb_build_object('ok', true, 'log_id', v_log_id);
END;
$$;
```

#### 10.7 — Agendar o cron

```sql
SELECT cron.schedule(
  'schema-drift-check',
  '0 2 * * *',   -- diário 02:00 UTC
  $$SELECT public.fn_run_schema_drift_check();$$
);
```

#### 10.8 — Smoke test E2E

```sql
-- Execução manual completa:
SELECT public.fn_run_schema_drift_check();

-- Inspecionar resultado:
SELECT to_char(ran_at, 'YYYY-MM-DD HH24:MI:SS') AS quando,
       has_drift,
       tables_oficial,
       tables_lovable,
       COALESCE(array_length(only_oficial, 1), 0) AS only_oficial,
       COALESCE(array_length(only_lovable, 1), 0) AS only_lovable,
       (SELECT COUNT(*) FROM jsonb_object_keys(schema_diff)) AS schema_drift,
       notification_sent
  FROM public.schema_drift_log
 ORDER BY ran_at DESC LIMIT 3;
```

---

## 11. Fase 1.1 — Drop de tabelas legacy "fantasma" {#11-fase-11}

**Objetivo**: limpar tabelas legacy no Lovable que sobraram de refatorações anteriores. Geralmente sufixadas com `_old` ou substituídas por novas implementações.

**Por que essa fase é numerada 1.1 e não 5**: ela só é executada **depois** do Gate CI rodar pela primeira vez, porque é o Gate CI que identifica exatamente quais tabelas estão sobrando.

### Padrão BPM

```
Tarefa 1 — Pré-validação (cada tabela):
  • SELECT count(*) — confirmar 0 rows
  • FKs incoming via information_schema.table_constraints
  • Views/funções dependentes via pg_views e pg_proc
  • Referências no código do repo via github_search_code

Gateway: algum risco encontrado?
  Sim → documentar, decidir caso a caso
  Não → prosseguir

Tarefa 2 — Drop em transação:
  BEGIN;
    DROP TABLE IF EXISTS public.<t1> CASCADE;
    DROP TABLE IF EXISTS public.<t2> CASCADE;
  COMMIT;

Tarefa 3 — Pós-validação Gate CI:
  • Disparar fn_run_schema_drift_check
  • Esperado: only_lovable = 0, has_drift = false ✅

Tarefa 4 — Commit no GitHub:
  • Migration doc-only em supabase/migrations/
  • Relatório em docs/redeploy/FASE-1.1-EXECUTION-LOG.md
```

### Pré-validação exemplo

```sql
-- No Lovable
SELECT t.table_name,
       (SELECT count(*) FROM information_schema.columns c
         WHERE c.table_schema='public' AND c.table_name=t.table_name) AS qtd_colunas,
       pg_size_pretty(pg_total_relation_size('public.' || t.table_name)) AS tamanho,
       (SELECT count(*) FROM pg_indexes
         WHERE schemaname='public' AND tablename=t.table_name) AS qtd_indices,
       (SELECT count(*) FROM pg_policies
         WHERE schemaname='public' AND tablename=t.table_name) AS qtd_policies
  FROM (VALUES ('<t1>'),('<t2>'),('<t3>')) AS t(table_name);

-- FKs incoming
SELECT tc.table_name AS quem_referencia,
       kcu.column_name AS coluna,
       ccu.table_name AS alvo
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu USING (constraint_schema, constraint_name)
  JOIN information_schema.constraint_column_usage ccu USING (constraint_schema, constraint_name)
 WHERE tc.constraint_type = 'FOREIGN KEY'
   AND ccu.table_schema = 'public'
   AND ccu.table_name IN ('<t1>','<t2>','<t3>');
```

### Busca de referências no repo

```python
GITHUB - MCP - FOREVER:github_search_code(
  q='"from(\\"<tabela>\\")" OR "from(\'<tabela>\')" repo:<owner>/<repo>'
)
```

Ignore hits em `docs/` e `audit/` — esses são auto-gerados e não precisam mudar.

---

## 12. Limitação conhecida — desbloqueio definitivo do app {#12-limitação-conhecida}

Depois de tudo isso, o **app continua escrevendo no banco do Lovable Cloud interno** (não no Oficial). Como explicado na Seção 2 da Parte 1, isso é por causa do `is_managed_by_lovable: true`.

### Três caminhos possíveis (apresente ao sponsor humano)

1. **Sair do Lovable Cloud** (recomendado para projetos maduros): self-deploy via Vercel/Netlify/Cloudflare Pages. O `client.ts` do repo finalmente vai mandar no runtime.
2. **Reconfigurar o Lovable Cloud** (não documentado oficialmente): exige suporte direto da Lovable. Não há interface pública.
3. **Aceitar dois Supabase em paralelo**: Lovable interno como runtime, Oficial como SSOT, com sync ativo. Tem custo de complexidade contínuo.

**Importante**: você (Claude) **não tem como executar** nenhum desses três caminhos via MCP. Deixe claro pro sponsor que sua atuação termina aqui.

---

## 13. Padrões e princípios {#13-padrões-e-princípios}

### Princípios não-negociáveis

1. **Simule exaustivamente antes de executar.** Toda mutação destrutiva precisa de pré-check com `SELECT count(*)` e busca de dependências.
2. **Uma melhoria de cada vez, com excelência.** Não tente fazer 8 waves de uma vez — quebra a observabilidade do que mudou.
3. **Banco é source of truth (Decision 010).** Nunca `supabase db push`. Sempre `apply_migration` direto, depois doc no repo.
4. **Allowlist é auditável.** Se uma tabela "fica diferente por design", isso vai numa tabela RLS-protegida com `reason`, `added_by`, `added_at`. Nunca hardcode regex na função.
5. **Idempotência por padrão.** `IF NOT EXISTS`, `IF EXISTS`, `ON CONFLICT DO UPDATE`. Permite re-rodar sem erro.
6. **Documentação no `main` (até T22 ativar branch protection).** Commits docs/migrations vão direto. Issues e PRs com features vão por branch.
7. **Confirme antes de destrutivo.** O sponsor opera "idealiza → realiza", mas o filtro "**só prossiga em DROP/TRUNCATE com confirmação explícita**" continua valendo.

### Padrões de naming

| Tipo | Convenção | Exemplo |
|---|---|---|
| Migrations | `YYYYMMDDHHMMSS_<snake_case_descritivo>.sql` | `20260522154700_align_wave_3_5_1_quick_wins.sql` |
| Relatório de execução | `FASE-<n>-EXECUTION-LOG.md` em `docs/redeploy/` | `FASE-3.5-EXECUTION-LOG.md` |
| Função SQL helper | `fn_<verbo>_<objeto>` | `fn_compute_and_record_drift` |
| Trigger function | `tg_<tabela>_<acao>` | `tg_order_items_set_updated_at` |
| Allowlist category | snake_case curto | `cache_denormalizado`, `infra_lovable` |

### Como registrar migration manualmente no `schema_migrations`

Quando você executa SQL via `execute_sql` (não `apply_migration`), precisa registrar:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, statements, name)
VALUES (
  '<YYYYMMDDHHMMSS>',
  ARRAY['<statement1>', '<statement2>'],
  '<nome_descritivo>'
) ON CONFLICT (version) DO NOTHING;
```

Sempre prefira `apply_migration` que já faz isso automaticamente.

---

## 14. Templates de SQL prontos {#14-templates-prontos}

### Template — Trigger updated_at padrão

```sql
CREATE OR REPLACE FUNCTION public.tg_<tabela>_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_updated_at ON public.<tabela>;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.<tabela>
  FOR EACH ROW EXECUTE FUNCTION public.tg_<tabela>_set_updated_at();
```

### Template — RLS policy admin-only

```sql
ALTER TABLE public.<tabela> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage <tabela>"
  ON public.<tabela>
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles
                  WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles
                       WHERE user_id = auth.uid() AND role = 'admin'));
```

### Template — Pré-check antes de cast text → uuid

```sql
SELECT
  count(*) AS total_rows,
  count(*) FILTER (
    WHERE <coluna> IS NOT NULL
      AND <coluna> !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ) AS invalid_uuids
FROM public.<tabela>;
-- Se invalid_uuids = 0, pode castar com segurança
```

### Template — Migration doc-only (Lovable)

```sql
-- ============================================================================
-- Migration (LOVABLE-ONLY, documentação): <nome>
-- Date: <YYYY-MM-DD HH:MM> UTC
-- Phase: <fase descritiva>
-- Applied via: lovable_db_query (PROJECT <id-do-lovable>)
-- ============================================================================
-- IMPORTANTE: arquivo doc-only. Decision 010 proíbe push contra oficial.
-- Aplicado diretamente no Lovable Cloud interno via MCP.
-- ============================================================================

BEGIN;

-- ... SQL ...

COMMIT;

-- Pós-validação: <o que validar>
```

### Template — Relatório de execução

```markdown
# Redeploy <ano-mês> — Fase <n> — Log de Execução

**Data**: <data>
**Operador**: Agente Claude via MCP <lista>
**Sponsor**: <nome>
**Bancos envolvidos**:
- **Oficial (SSOT)**: <id>
- **Lovable Cloud interno**: <id>

## TL;DR

<1 parágrafo do que aconteceu>

| Métrica | Antes | Depois | Δ |
|---|---:|---:|---:|
| <métrica> | <v> | <v> | <Δ> |

## Tarefas executadas

### ✅ Tarefa 1 — <nome>
**Status**: DONE
**Migration**: <arquivo>
**O que foi feito**: <descrição>
**Pré-validação**: <evidências>
**Pós-validação**: <evidências>

[... próximas tarefas ...]

## Estado pós-execução
<snapshot dos indicadores>

## Pendências
<o que ficou para próxima fase>

## Lições aprendidas
1. <lição>
2. <lição>

## Commits relacionados
- <sha1>: <descrição>
- <sha2>: <descrição>
```

---

## 15. Troubleshooting {#15-troubleshooting}

### Problema: `net.http_post` retorna "Out of memory"

**Causa**: aspas duplas no JWT extraído com `value::text::text` em vez de `value #>> '{}'`.

**Solução**:
```sql
-- ERRADO
SELECT value::text::text FROM system_settings WHERE key = 'lovable_anon_key';
-- → '"eyJhbG..."' (com aspas)

-- CERTO
SELECT value #>> '{}' FROM system_settings WHERE key = 'lovable_anon_key';
-- → 'eyJhbG...' (sem aspas)
```

### Problema: `fn_run_schema_drift_check` retorna `{"ok": false, "error": "timeout"}`

**Causa**: o Lovable está demorando >30s para responder ao HTTP POST.

**Solução em duas etapas**:
```sql
SELECT public.fn_trigger_schema_drift_fetch();  -- pega request_id
-- Esperar mais 30-60s manualmente
WITH resp AS (SELECT content::jsonb AS sigs FROM net._http_response WHERE id = <request_id>)
SELECT public.fn_compute_and_record_drift(sigs) FROM resp;
```

Se persistente, aumentar o limite de polling de 30 para 60.

### Problema: ALTER TYPE pg_enum reclama de transação

**Causa**: PostgreSQL exige que `ALTER TYPE ... ADD VALUE` seja committed antes do valor ser usado.

**Solução**: rode em statement separado:
```sql
-- Statement 1 (commit antes do próximo)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'novo_valor';

-- Statement 2 (em outra chamada)
ALTER TABLE x ALTER COLUMN y TYPE public.app_role USING y::public.app_role;
```

Em MCP, isso significa fazer **duas chamadas separadas** a `execute_sql`/`apply_migration`, não uma com `;` entre os comandos.

### Problema: Lovable MCP retorna "exige confirm:true"

**Causa**: o Lovable MCP exige confirmação explícita para mutações (INSERT/UPDATE/DELETE/DDL).

**Solução**: passe `confirm=true` na chamada:
```python
LOVABLE - MCP:lovable_db_query(
  project_id=...,
  sql=...,
  confirm=True,  # ← aqui
  token="auto"
)
```

### Problema: `apply_migration` falha com "version already exists"

**Causa**: você já rodou essa version antes.

**Solução 1**: use `ON CONFLICT DO NOTHING` ao registrar manualmente.
**Solução 2**: incremente a version (mude o sufixo HHMMSS).

### Problema: índice único quebra após cast de tipo

**Causa**: índice único com `COALESCE(col, ''::text)` deixa de funcionar quando `col` vira `uuid`.

**Solução**: dropar índice antes do cast, recriar com sentinela do tipo novo:
```sql
DROP INDEX idx_unique_old;
ALTER TABLE ... ALTER COLUMN ... TYPE uuid USING ...;
CREATE UNIQUE INDEX idx_unique_new
  ON ... (..., COALESCE(col, '00000000-0000-0000-0000-000000000000'::uuid));
```

### Problema: edge function deployed no projeto errado

**Causa**: o MCP de Supabase pode ter múltiplos projetos linkados; `deploy_edge_function` pode escolher o errado se não for específico.

**Solução**: para esse manual, **evite edge functions**. Use SQL puro com `pg_net` para HTTP — toda a Fase 4 foi escrita assim por essa razão.

### Problema: `has_drift = true` mesmo com `schema_diff = 0`

**Causa**: a função `fn_compute_and_record_drift` está considerando `only_oficial > 0` como drift.

**Solução**: usar a definição correta (Seção 10.4):
```sql
v_has_drift := (COALESCE(array_length(v_only_lovable, 1), 0) > 0
                OR (SELECT COUNT(*) FROM jsonb_object_keys(v_diff)) > 0);
-- only_oficial é INFORMATIVO, não dispara has_drift
```

### Problema: pessoas usando o app reclamam que dados sumiram

**Causa real**: você fez DROP CASCADE em uma tabela que tinha dados, ou as RLS policies novas estão bloqueando leitura.

**Mitigação preventiva**: **SEMPRE** rode `SELECT count(*)` antes de qualquer DROP. Sempre teste RLS com `SET LOCAL role authenticated; SELECT count(*) FROM <tabela>;` antes de considerar feito.

---

## 16. Checklist final de aceitação {#16-checklist-final}

Antes de considerar a migração concluída, verifique:

### Fase 0
- [ ] `is_managed_by_lovable` documentado
- [ ] Hosts dos dois bancos confirmados diferentes
- [ ] Sponsor avisado sobre a limitação do app

### Fase 1
- [ ] `get_public_schema_signatures()` criada nos dois bancos
- [ ] Diff completo gerado e classificado
- [ ] Plano de waves da Fase 3 documentado

### Fase 2
- [ ] Tabelas órfãs migradas com RLS + índices + triggers
- [ ] Funções helper migradas com `search_path` fixo
- [ ] pg_cron jobs replicados (schedules levemente offset)

### Fase 3
- [ ] Wave 3.1, 3.2, 3.3, 3.4 executadas e validadas
- [ ] Cada wave tem migration no `apply_migration`
- [ ] Cada wave tem doc commitada em `docs/redeploy/`

### Fase 3.5
- [ ] `schema_drift_allowlist` criada e populada
- [ ] Cada entrada tem `metadata.category`
- [ ] Cada entrada tem `reason` descritivo

### Fase 4
- [ ] `get_public_schema_signatures` nos dois bancos
- [ ] `schema_drift_log` + `record_schema_drift_result` no Oficial
- [ ] `fn_compute_and_record_drift` com semântica correta de `has_drift`
- [ ] `fn_trigger_schema_drift_fetch` usando `#>> '{}'`
- [ ] `fn_run_schema_drift_check` orquestrador
- [ ] `system_settings.lovable_url` e `lovable_anon_key` plugadas
- [ ] pg_cron `schema-drift-check` agendado
- [ ] Smoke test E2E passou com `status_code = 200`

### Fase 1.1
- [ ] Pré-validação das legacy (rows, FKs, deps, código)
- [ ] DROP em transação
- [ ] Gate CI roda e mostra `has_drift = false`

### GitHub
- [ ] Todas as migrations em `supabase/migrations/` (uma por wave)
- [ ] Todos os execution logs em `docs/redeploy/`
- [ ] Manual deste arquivo (esse aqui) commitado em `docs/redeploy/MANUAL.md`
- [ ] Issue de tracking atualizada (se existir)

### Estado terminal
- [ ] `has_drift = false`
- [ ] `only_lovable = 0` (excluindo allowlist)
- [ ] `schema_drift = 0` (excluindo allowlist)
- [ ] Sponsor informado sobre o "PR no app" como bloqueio remanescente

---

## Apêndice A — Fluxo BPM completo (visão única)

```
[INÍCIO]
   │
   ▼
[Fase 0] Descoberta
   │  Inventário dos 3 ambientes
   │  is_managed_by_lovable?
   ▼
[Fase 1] Inventário + Diff
   │  get_public_schema_signatures (ambos)
   │  Classificar drift por severidade
   ▼
[Fase 2] Tabelas órfãs + funções + crons
   │  Migrar do Lovable → Oficial
   │  search_path fixo em SECURITY DEFINER
   ▼
[Fase 3] Wave por wave
   │  3.1 Quick wins (colunas)
   │  3.2 Naming (renames)
   │  3.3 Conflitos (casts)
   │  3.4 Catástrofes (refactor)
   ▼
[Fase 3.5] Allowlist
   │  schema_drift_allowlist + seed
   ▼
[Fase 4] Gate CI
   │  pg_cron diário
   │  Alerta admins via workspace_notifications
   ▼
[Fase 1.1] Limpeza legacy
   │  DROP _old, fantasmas
   │  Gate CI vira verde
   ▼
[FIM] Schema 100% alinhado
   │
   │  Limitação: app continua escrevendo no Lovable
   │  (resolver via PR do app, fora do escopo deste manual)
   ▼
[Bloqueio remanescente]
```

## Apêndice B — Indicadores e KPIs sugeridos

Para o sponsor humano monitorar:

| KPI | Meta | Como medir |
|---|---|---|
| Tabelas com `schema_diff` | 0 | `SELECT COUNT(*) FROM jsonb_object_keys(schema_diff) FROM schema_drift_log ORDER BY ran_at DESC LIMIT 1` |
| `only_lovable` (fora allowlist) | 0 | `array_length(only_lovable, 1)` na última execução |
| Dias desde último alerta de drift | crescente | `now() - max(ran_at) FILTER (WHERE has_drift)` |
| Tabelas em allowlist | estável | `count(*) FROM schema_drift_allowlist` |
| Cron rodando diariamente | sim | `SELECT * FROM cron.job WHERE jobname='schema-drift-check'` |

---

## Apêndice C — Glossário

| Termo | Significado |
|---|---|
| **SSOT** | Single Source of Truth — o banco "verdadeiro" |
| **Lovable interno** | Supabase gerenciado pelo Lovable Cloud (`is_managed_by_lovable: true`) |
| **Oficial** | Supabase externo controlado pelo usuário |
| **Drift** | Divergência de schema entre os dois bancos |
| **Allowlist** | Lista auditável de divergências aceitáveis por design |
| **Gate CI** | Mecanismo de detecção contínua (cron + função + alerta) |
| **Wave** | Sub-fase da Fase 3 (uma classe de correção) |
| **Decision 010** | Banco = SSOT, nunca `supabase db push` |
| **Decision 012** | Migrations Lovable-only são doc-only no repo |
| **B2B/B2C** | Modelos de negócio diferentes (afeta schemas tipo `order_items`) |

---

**Fim do manual.**

Se você for o Claude que vai executar essa migração agora: respira fundo, lê tudo uma vez, comenta dúvidas com o sponsor antes da Fase 1, e segue passo a passo. Não pula a Fase 0. Não pula pré-validação. Cada problema documentado aqui custou tempo real para descobrir.

Boa sorte e que o `has_drift` esteja sempre `false`. 🚀