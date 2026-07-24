# Prompt Exaustivo — Implementação do Módulo Magazine no BD Canônico Gold

> Copie o bloco entre `====== INÍCIO DO PROMPT ======` e `====== FIM DO PROMPT ======` e cole em uma nova sessão de agente (Claude Code / Lovable / etc.) apontando para este projeto. Ele é auto-contido: define alvo, restrições, entregáveis, ordem de execução e critérios de aceite.

```text
====== INÍCIO DO PROMPT ======

PERSONA: Você é Claude Opus 4.8, engenheiro full-stack sênior + DBA PhD.
Trabalhe como time multi-agente (Supabase Engineer + Code Auditor + API Integrator).

MISSÃO
Implementar, no BD canônico Gold `doufsxqlfjyuvxuezpln` (Supabase "Gestão de
Produtos"), TODA a infraestrutura do módulo Magazine: 6 tabelas, índices,
GRANTs, RLS + policies, triggers, storage bucket, 5 edge functions e 2 cron
jobs. O front-end já existe (`src/pages/magazine/**`,
`src/services/magazineService.ts`, `src/types/magazine.ts`) e opera em modo
localStorage; esta migração habilita persistência server-side, share público
seguro e geração de PDF.

RESTRIÇÕES INVIOLÁVEIS (leia antes de qualquer SQL)
1. Alvo é EXCLUSIVAMENTE o Supabase Gold `doufsxqlfjyuvxuezpln`.
   PROIBIDO criar qualquer objeto novo no Lovable Cloud interno
   (`pqpdolkaeqlyzpdpbizo`) ou no Supabase CRM. Confirme o alvo antes de
   emitir DDL.
2. Ordem obrigatória para toda tabela pública (SSOT do projeto):
   (1) CREATE TABLE → (2) GRANT → (3) ENABLE RLS → (4) CREATE POLICY.
   Migração sem GRANT explícito é INCORRETA — PostgREST retorna
   permission_denied em runtime.
3. Nunca use CHECK constraint com `now()`, `current_user`, referências a
   outras tabelas ou funções mutáveis — use TRIGGER de validação.
4. Toda função SECURITY DEFINER em `public` precisa `SET search_path =
   public, pg_temp` e REVOKE EXECUTE de PUBLIC/anon/authenticated,
   granting explícito só onde necessário (ACL policy do projeto).
5. Edge functions usam:
   - `_shared/cors.ts` (`buildPublicCorsHeaders` ou `getCorsHeaders(req)`) —
     PROIBIDO literal `Access-Control-Allow-Headers` inline.
   - `_shared/structured-logger.ts` (`createStructuredLogger`) — todo log
     JSON com `request_id` (header `X-Request-Id`); resposta ecoa via
     `log.respond`.
   - Zod para validar body/query/headers; retorno 400 com fieldErrors.
   - Rate-limit por `edge_rate_limits` (tabela pública já existente) ou por
     estrutura equivalente definida abaixo.
6. Roles no BD são armazenadas em `user_roles` (nunca em `profiles`);
   verificação via `public.has_role(auth.uid(), 'admin'::app_role)`.
7. Reutilize funções já existentes no Gold quando possível:
   - `public.update_updated_at_column()` (trigger genérico updated_at)
   - `public.has_role(uuid, app_role)`
   - `public.record_public_token_failure(...)` (para logar 401 público)
   - `public.hash_ip(text)` se existir; senão criar com
     `digest(ip||salt,'sha256')`.
8. Antes de aplicar QUALQUER migração, apresente o SQL completo, aguarde
   aprovação do PO e execute em uma única transação. Se a plataforma
   quebrar a execução em blocos, sinalize e paute a ordem.

CONTEXTO DO FRONT-END (leitura obrigatória)
- `src/types/magazine.ts` — SSOT dos tipos: `Magazine`, `MagazineItem`,
  `MagazineContentSettings`, `MagazineClientBranding`, `MagazineTemplateId`,
  `MagazineCategory`. NÃO invente nomes divergentes; mapeie coluna→campo.
- `src/services/magazineService.ts` — hoje grava em localStorage; deve ser
  refatorado depois para chamar Supabase, mas isso NÃO é escopo deste
  prompt (só infra de BD/edge).
- `src/pages/magazine/hooks/useMagazineReaderState.ts` — já espera a tabela
  `magazine_reader_state` no schema descrito em
  `qa/migrations-draft/2026-07-12_magazine_reader_state.sql`. Respeite o
  contrato: chave composta (`magazine_token`, `viewer_fingerprint`),
  colunas `bookmarks INTEGER[]`, `last_page_index INTEGER`.
- `src/pages/magazine/PublicMagazineView.tsx` — consumidor da rota pública
  `/revista-publica/:token`; hoje lê localStorage, precisa da edge
  `magazine-public-view` retornando revista + páginas + itens.
- Drafts já revisados que servem de base:
  - `qa/migrations-draft/2026-07-12_magazines.sql`
  - `qa/migrations-draft/2026-07-12_magazine_reader_state.sql`
  Use como PONTO DE PARTIDA, mas complete-os conforme spec abaixo (faltam
  colunas de analytics/reactions, storage e alguns índices).

ENTREGÁVEIS (nesta ordem)

A) MIGRAÇÃO SQL ÚNICA — arquivo
   `supabase/migrations/YYYYMMDDHHMMSS_magazine_module.sql`.
   Contém, em ordem:

   A.1 EXTENSÕES (idempotentes):
       - pgcrypto (gen_random_uuid, digest)
       - pg_cron (agendamento)
       - pg_net (opcional — só se cron precisar chamar edge por HTTP)

   A.2 ENUMS
       - `magazine_status`: ('draft','published','archived')
       - `magazine_template_family`: ('editorial','catalog','corporate')
       - `magazine_category`: 14 valores idênticos ao TS
         ('technology','drinkwares','general','wearables','pins','awards',
          'packaging','stationery','bags','clocks','signs','id','giftsets',
          'customized')
       - `magazine_reaction_kind`: ('like','love','fire','idea')

   A.3 TABELAS

       (T1) public.magazines
         id UUID PK DEFAULT gen_random_uuid()
         owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
         organization_id UUID NULL           (sem FK — org table pode não existir)
         title TEXT NOT NULL DEFAULT 'Nova Revista'
         subtitle TEXT NOT NULL DEFAULT ''
         template_id TEXT NOT NULL DEFAULT 'editorial-vogue'
         template_family magazine_template_family NOT NULL DEFAULT 'editorial'
         client_name TEXT NULL
         client_logo_url TEXT NULL
         client_crm_id TEXT NULL
         client_brand_colors JSONB NOT NULL
           DEFAULT '{"primary":"#2e4a3a","secondary":"#e86f2e","text":"#1a1a1a"}'::jsonb
         category magazine_category NULL
         content_settings JSONB NOT NULL DEFAULT '{}'
         page_order JSONB NULL               (array de índices ou null)
         status magazine_status NOT NULL DEFAULT 'draft'
         public_token TEXT NULL UNIQUE       (gerado no publish; 24+ chars base62)
         pdf_url TEXT NULL
         pdf_signature TEXT NULL             (sha256 do payload que gerou o PDF)
         pdf_generated_at TIMESTAMPTZ NULL
         view_count INTEGER NOT NULL DEFAULT 0
         published_at TIMESTAMPTZ NULL
         archived_at TIMESTAMPTZ NULL
         deleted_at TIMESTAMPTZ NULL         (soft delete)
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

       (T2) public.magazine_items
         id UUID PK DEFAULT gen_random_uuid()
         magazine_id UUID NOT NULL REFERENCES public.magazines(id) ON DELETE CASCADE
         product_id UUID NOT NULL
         variant_id UUID NULL
         variant_color_name TEXT NULL
         position INTEGER NOT NULL DEFAULT 0
         page_number INTEGER NULL
         product_snapshot JSONB NOT NULL
         overrides JSONB NOT NULL DEFAULT '{}'
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
         UNIQUE (magazine_id, position)

       (T3) public.magazine_templates
         id UUID PK DEFAULT gen_random_uuid()
         owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
         organization_id UUID NULL
         name TEXT NOT NULL
         template_id TEXT NOT NULL
         content_settings JSONB NOT NULL DEFAULT '{}'
         branding JSONB NOT NULL DEFAULT '{}'
         shared_in_org BOOLEAN NOT NULL DEFAULT false
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

       (T4) public.magazine_reader_state    (schema já esboçado em draft)
         id UUID PK DEFAULT gen_random_uuid()
         magazine_token TEXT NOT NULL
         viewer_fingerprint TEXT NOT NULL
         last_page_index INTEGER NOT NULL DEFAULT 0
         bookmarks INTEGER[] NOT NULL DEFAULT '{}'
         user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
         UNIQUE (magazine_token, viewer_fingerprint)

       (T5) public.magazine_public_view_events   (analytics de views públicas)
         id BIGSERIAL PK
         magazine_id UUID NOT NULL REFERENCES public.magazines(id) ON DELETE CASCADE
         token_hash TEXT NOT NULL                 (sha256 do public_token)
         ip_hash TEXT NOT NULL                    (hash do IP com salt)
         user_agent_hash TEXT NULL                (hash UA truncado)
         referer_host TEXT NULL                   (só host, PII-safe)
         page_index INTEGER NULL                  (última página vista se enviada)
         session_id TEXT NULL                     (uuid client-gerado)
         viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()

       (T6) public.magazine_public_reactions    (reactions anônimas)
         id UUID PK DEFAULT gen_random_uuid()
         magazine_id UUID NOT NULL REFERENCES public.magazines(id) ON DELETE CASCADE
         page_index INTEGER NULL                  (null = reação à revista toda)
         item_id UUID NULL REFERENCES public.magazine_items(id) ON DELETE CASCADE
         kind magazine_reaction_kind NOT NULL
         viewer_fingerprint TEXT NOT NULL
         ip_hash TEXT NOT NULL
         created_at TIMESTAMPTZ NOT NULL DEFAULT now()
         UNIQUE (magazine_id, viewer_fingerprint, kind, page_index, item_id)

   A.4 ÍNDICES (todos com IF NOT EXISTS)
       magazines:
         idx_magazines_owner              (owner_id)
         idx_magazines_org                (organization_id)
           WHERE organization_id IS NOT NULL
         idx_magazines_token_lookup       (public_token)
           WHERE status = 'published' AND public_token IS NOT NULL
         idx_magazines_published          (status, published_at DESC)
           WHERE status = 'published'
         idx_magazines_not_deleted        (owner_id, updated_at DESC)
           WHERE deleted_at IS NULL
       magazine_items:
         idx_magazine_items_mag_pos       (magazine_id, position)
         idx_magazine_items_product       (product_id)
       magazine_templates:
         idx_magazine_templates_owner     (owner_id)
         idx_magazine_templates_org       (organization_id, shared_in_org)
           WHERE shared_in_org = true
       magazine_reader_state:
         idx_reader_state_token           (magazine_token)
         idx_reader_state_user            (user_id) WHERE user_id IS NOT NULL
         idx_reader_state_updated         (updated_at)  -- TTL cleanup
       magazine_public_view_events:
         idx_mag_view_events_mag_time     (magazine_id, viewed_at DESC)
         idx_mag_view_events_token_hash   (token_hash, viewed_at DESC)
         idx_mag_view_events_ip_recent    (ip_hash, viewed_at DESC)
       magazine_public_reactions:
         idx_mag_reactions_mag            (magazine_id, kind, created_at DESC)
         idx_mag_reactions_page           (magazine_id, page_index)
           WHERE page_index IS NOT NULL

   A.5 TRIGGERS
       - trg_<tabela>_updated_at BEFORE UPDATE ... EXECUTE FUNCTION
         public.update_updated_at_column()   (para T1, T2, T3, T4)
       - trg_magazines_publish_stamp BEFORE UPDATE ON public.magazines:
             quando NEW.status='published' AND OLD.status<>'published'
             → NEW.published_at := coalesce(NEW.published_at, now())
             quando NEW.status='archived' → NEW.archived_at := now()
       - trg_magazines_token_on_publish BEFORE UPDATE ON public.magazines:
             se NEW.status='published' AND NEW.public_token IS NULL →
             gera token base62 24 chars via encode(gen_random_bytes(18),'base64')
             (remove /,+,=)
       - trg_reader_state_validate BEFORE INSERT/UPDATE:
             cardinality(bookmarks) <= 500 AND last_page_index BETWEEN 0 AND 9999
             (substitui CHECK — permite mensagens claras)

   A.6 GRANTS (por tabela, ANTES do RLS)
       magazines, magazine_items, magazine_templates, magazine_public_reactions:
         GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated;
         GRANT ALL ... TO service_role;
         (sem anon — leitura pública via edge com service_role)
       magazine_reader_state, magazine_public_view_events:
         GRANT SELECT, INSERT, UPDATE ... TO anon, authenticated;
         GRANT ALL ... TO service_role;
         (DELETE só service_role — cron cleanup)

   A.7 RLS + POLICIES

       magazines
         ENABLE ROW LEVEL SECURITY;
         magazines_owner_all      FOR ALL TO authenticated
           USING (owner_id = auth.uid() AND deleted_at IS NULL)
           WITH CHECK (owner_id = auth.uid());
         magazines_org_read       FOR SELECT TO authenticated
           USING (organization_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM public.organization_members om
                              WHERE om.organization_id = magazines.organization_id
                                AND om.user_id = auth.uid())
                  AND deleted_at IS NULL);
         magazines_admin_all      FOR ALL TO authenticated
           USING (public.has_role(auth.uid(),'admin'::app_role))
           WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

       magazine_items
         magazine_items_via_owner_or_org  FOR ALL TO authenticated
           USING (EXISTS (SELECT 1 FROM public.magazines m
                          WHERE m.id = magazine_items.magazine_id
                            AND (m.owner_id = auth.uid()
                                 OR (m.organization_id IS NOT NULL AND EXISTS (
                                       SELECT 1 FROM public.organization_members om
                                       WHERE om.organization_id = m.organization_id
                                         AND om.user_id = auth.uid())))))
           WITH CHECK (EXISTS (SELECT 1 FROM public.magazines m
                               WHERE m.id = magazine_items.magazine_id
                                 AND m.owner_id = auth.uid()));

       magazine_templates
         templates_owner_all      FOR ALL TO authenticated
           USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
         templates_org_read       FOR SELECT TO authenticated
           USING (shared_in_org = true
                  AND organization_id IS NOT NULL
                  AND EXISTS (SELECT 1 FROM public.organization_members om
                              WHERE om.organization_id = magazine_templates.organization_id
                                AND om.user_id = auth.uid()));

       magazine_reader_state (padrão do draft — inclui anon)
         reader_state_public_select   FOR SELECT TO anon, authenticated USING (true);
         reader_state_public_insert   FOR INSERT TO anon, authenticated
           WITH CHECK (magazine_token IS NOT NULL
                       AND viewer_fingerprint IS NOT NULL
                       AND cardinality(bookmarks) <= 500
                       AND last_page_index BETWEEN 0 AND 9999);
         reader_state_public_update   FOR UPDATE TO anon, authenticated
           USING (true)
           WITH CHECK (cardinality(bookmarks) <= 500
                       AND last_page_index BETWEEN 0 AND 9999);
         reader_state_delete_service  FOR DELETE TO service_role USING (true);

       magazine_public_view_events
         view_events_insert_public    FOR INSERT TO anon, authenticated
           WITH CHECK (magazine_id IS NOT NULL AND token_hash IS NOT NULL);
         view_events_read_owner       FOR SELECT TO authenticated
           USING (EXISTS (SELECT 1 FROM public.magazines m
                          WHERE m.id = magazine_public_view_events.magazine_id
                            AND m.owner_id = auth.uid()));
         view_events_read_admin       FOR SELECT TO authenticated
           USING (public.has_role(auth.uid(),'admin'::app_role));

       magazine_public_reactions
         reactions_insert_public      FOR INSERT TO anon, authenticated
           WITH CHECK (magazine_id IS NOT NULL AND viewer_fingerprint IS NOT NULL);
         reactions_delete_own_fp      FOR DELETE TO anon, authenticated
           USING (viewer_fingerprint = current_setting('request.header.x-viewer-fp', true));
         reactions_read_public        FOR SELECT TO anon, authenticated USING (true);

   A.8 FUNÇÕES SUPORTE (SECURITY DEFINER onde marcado)
       - public.magazine_touch_view_count(_magazine_id UUID) RETURNS void
         SECURITY DEFINER — incrementa magazines.view_count. GRANT EXECUTE
         somente para service_role.
       - public.magazine_gen_public_token() RETURNS TEXT SECURITY DEFINER
         REVOKE FROM PUBLIC/anon/authenticated; GRANT service_role.
       - public.magazine_cleanup_orphan_state(_ttl_days INT DEFAULT 180)
         RETURNS INTEGER — DELETE em reader_state cujo magazine_token não
         existe mais em magazines OU updated_at < now() - _ttl_days.
         SECURITY DEFINER + REVOKE PUBLIC.
       - public.magazine_hash_ip(_ip TEXT) RETURNS TEXT LANGUAGE SQL
         IMMUTABLE — encode(digest(_ip || current_setting('app.ip_salt', true),
         'sha256'),'hex'). Se `app.ip_salt` não estiver setado, usar
         fallback fixo do projeto.

   A.9 STORAGE BUCKET (via `storage.create_bucket` ou tool equivalente)
       bucket: `magazine-pdfs`
       public: false (leitura via URL assinada emitida por edge)
       file_size_limit: 25 MB
       allowed_mime_types: ['application/pdf']
       Policies em storage.objects:
         - "owner_read_write" TO authenticated
             USING/CHECK: (bucket_id='magazine-pdfs'
                           AND (storage.foldername(name))[1] = auth.uid()::text)
         - "service_full" TO service_role USING (bucket_id='magazine-pdfs')

B) EDGE FUNCTIONS
   Local: `supabase/functions/<nome>/index.ts` + `<nome>_test.ts` (Deno).
   Cada função DEVE: usar `_shared/cors.ts`, `createStructuredLogger`, Zod,
   ecoar `X-Request-Id`, retornar erros com status HTTP correto e corpo
   `{ error, request_id, details? }`.

   B.1  `magazine-public-view`   (verify_jwt=false, público)
        POST/GET com `{ token: string }`.
        1. Valida token via Zod (24-40 chars, base62).
        2. Rate-limit por IP (20 req/min) via `edge_rate_limits`.
        3. Se falhar → chamar public.record_public_token_failure(...) e
           retornar 401 `{ error: 'invalid_or_expired' }`.
        4. Client service_role: SELECT em magazines JOIN magazine_items
           (product_snapshot inline), FILTRO status='published'
           AND deleted_at IS NULL AND public_token = ?.
        5. Increment async: public.magazine_touch_view_count(id).
        6. Inserir 1 linha em magazine_public_view_events
           (ip_hash via public.magazine_hash_ip).
        7. Retornar payload compatível com o tipo `Magazine` do front
           (mesmos nomes de campos — camelCase no JSON de saída).

   B.2  `magazine-reader-state-write`   (verify_jwt=false)
        POST { token, fingerprint, lastPageIndex?, bookmarks?, sessionId? }.
        Zod estrito: fingerprint UUID; bookmarks int[] <=500;
        lastPageIndex 0..9999.
        Rate-limit 2 writes/segundo por fingerprint (via edge_rate_limits
        composite key `magazine-reader-state:<fp>`). Excedeu → 429.
        Upsert em magazine_reader_state com onConflict
        (magazine_token, viewer_fingerprint).
        Se falha 42501/42P01 do BD → retornar 503 `{ error:
        'sync_disabled' }` e o hook front já cai em local-only.

   B.3  `magazine-public-react`   (verify_jwt=false)
        POST { token, fingerprint, kind, pageIndex?, itemId? }.
        Rate-limit 5/min/IP. Se reação já existir (unique constraint) →
        DELETE (toggle). Retornar `{ toggled: 'added'|'removed' }`.

   B.4  `magazine-pdf-render`   (verify_jwt=true — user autenticado)
        POST { magazineId }.
        1. Validar RLS: authorize() com getClaims; SELECT magazine com o
           userClient (dono ou membro org). Se não retornar → 403.
        2. Serializar payload (title, items, branding) e calcular sha256 →
           `payload_signature`.
        3. Se `magazines.pdf_signature = payload_signature` E
           `magazines.pdf_url` presente → devolver URL cacheada.
        4. Senão, gerar PDF (via chamada HTTP a serviço externo
           puppeteer/gotenberg; se ainda não existir, STUB que retorna 501
           com `{ error: 'pdf_renderer_pending' }` e loga
           `pdf_render_pending`).
        5. Upload no bucket `magazine-pdfs` em
           `<owner_id>/<magazine_id>-<timestamp>.pdf`.
        6. UPDATE magazines SET pdf_url, pdf_signature,
           pdf_generated_at = now().
        7. Retornar signed URL válida por 24h.

   B.5  `magazine-cleanup`   (verify_jwt=false; chamada pelo cron via
        pg_net com header interno `X-Cron-Secret` obrigatório — comparar
        com secret `MAGAZINE_CRON_SECRET`)
        - SELECT public.magazine_cleanup_orphan_state(180)
        - DELETE em magazine_public_view_events onde viewed_at <
          now() - interval '180 days' (chunked LIMIT 10000).
        - UPDATE magazines SET status='archived', archived_at=now()
          WHERE status='draft' AND updated_at < now() - interval '365 days'
            AND deleted_at IS NULL.
        - Log estruturado por etapa com contagem.

   B.6  Cada função deve ter arquivo `_test.ts` cobrindo:
          happy path, 400 (Zod), 401 (token inválido), 429 (rate-limit),
          503 (BD off). Use `Deno.test` + fetch para o localhost quando o
          runner suportar; senão, testes unitários das funções puras.

C) CRON (pg_cron; timezone UTC)

   C.1  cron.schedule('magazine-cleanup-nightly',
                      '15 3 * * *',
                      $$ SELECT net.http_post(
                           url  := 'https://<PROJECT_REF>.functions.supabase.co/magazine-cleanup',
                           headers := jsonb_build_object(
                             'Content-Type','application/json',
                             'X-Cron-Secret', current_setting('app.magazine_cron_secret', true)),
                           body := '{}'::jsonb
                         ); $$);

   C.2  cron.schedule('magazine-view-events-rollup',
                      '5 * * * *',
                      $$ INSERT INTO public.magazines_view_stats_hourly(...)
                         SELECT magazine_id, date_trunc('hour', viewed_at), count(*)
                         FROM public.magazine_public_view_events
                         WHERE viewed_at >= now() - interval '1 hour'
                         ON CONFLICT DO NOTHING; $$);

   C.3  Secrets:
          - MAGAZINE_CRON_SECRET (48+ chars) via generate_secret
          - MAGAZINE_IP_SALT (48+ chars) via generate_secret

D) SECRETS RUNTIME NECESSÁRIOS (antes do deploy das edges):
     - MAGAZINE_CRON_SECRET      (generate_secret 48 chars)
     - MAGAZINE_IP_SALT          (generate_secret 48 chars)
     - MAGAZINE_PDF_RENDERER_URL (add_secret; opcional, B.4 real)
     - MAGAZINE_PDF_RENDERER_KEY (add_secret; opcional)

E) VALIDAÇÃO E CRITÉRIOS DE ACEITE (rodar e reportar TUDO)

   E.1  Verificação estrutural:
     - `SELECT count(*) FROM pg_tables WHERE schemaname='public' AND
        tablename LIKE 'magazine%';` → 6.
     - rowsecurity=true em todas as 6 tabelas.
     - Contagem de policies: magazines=3+, items=1+, templates=2,
       reader_state=4, view_events=3, reactions=3.
     - `information_schema.role_table_grants` confirma authenticated e
       service_role em todas; anon apenas em reader_state e view_events.
     - `SELECT jobname FROM cron.job WHERE jobname LIKE 'magazine%';` → 2.

   E.2  Smoke tests (INSERT/UPDATE via psql com JWT de teste):
     - User X insere magazine → OK.
     - User Y (outra org) SELECT magazine de X → 0 linhas.
     - User Y da mesma org SELECT → 1 linha.
     - INSERT reader_state como anon → OK.
     - INSERT com 501 bookmarks → falha (trigger).
     - UPDATE status='published' → published_at e public_token preenchidos.

   E.3  Edge tests via `supabase--curl_edge_functions`:
     - magazine-public-view sem token → 400 fieldErrors.
     - Token inválido → 401 e linha em public_token_failures.
     - Token válido → 200 e view_count incrementou.
     - 3 writes em <1s do mesmo fp → 3ª = 429.
     - magazine-pdf-render sem auth → 401.
     - magazine-cleanup sem X-Cron-Secret → 403.

   E.4  `supabase--linter` sem erros novos.

   E.5  `SELECT * FROM public.audit_security_definer_acl();` sem
        violações nas funções criadas.

F) RELATÓRIO FINAL (em português)
   1. Tabelas criadas + contagem de rows.
   2. Índices criados (nome + tabela).
   3. Policies (tabela → nome → comando).
   4. Triggers e funções.
   5. Edge functions + status de deploy.
   6. Cron jobs + próxima execução.
   7. Bucket + policies.
   8. Warnings do linter.
   9. Diff sugerido (não aplicado) para
      `src/services/magazineService.ts` migrar de localStorage → Supabase.

G) O QUE NÃO FAZER
   - Não editar `src/integrations/supabase/client.ts`.
   - Não regenerar `types.ts` manualmente.
   - Não criar tabela no Lovable Cloud interno.
   - Não usar `service_role` no front-end.
   - Não deploy de edge sem `MAGAZINE_CRON_SECRET` e `MAGAZINE_IP_SALT`
     presentes.
   - Não rodar `ALTER DATABASE ...`.

H) ORDEM DE EXECUÇÃO
   1. Confirmar alvo BD Gold.
   2. Gerar/registrar secrets (D).
   3. Migração única (A) → aprovar → aplicar.
   4. Criar storage bucket + policies.
   5. Escrever + typecheck das 5 edges (B).
   6. Testes Deno (B.6) + `supabase--test_edge_functions`.
   7. Deploy das edges.
   8. Criar cron jobs (C).
   9. Rodar E e produzir F.

CRITÉRIO DE PARADA
Só declare "pronto" quando E passar sem erro, linter estiver limpo e F
estiver preenchido. Se qualquer etapa falhar, PARE, reporte o erro exato,
proponha correção e aguarde o PO. Nada de workaround silencioso.

====== FIM DO PROMPT ======
```

## Escopo coberto

- 6 tabelas em `public.*` (magazines, magazine_items, magazine_templates, magazine_reader_state, magazine_public_view_events, magazine_public_reactions).
- Enums, índices parciais, triggers de `updated_at`/publish stamp/token, funções SECURITY DEFINER com ACL correta.
- Storage bucket privado `magazine-pdfs` com policies.
- 5 edge functions com padrão SSOT (CORS shared, structured logger, Zod, request_id, rate-limit).
- 2 cron jobs (`magazine-cleanup-nightly`, `magazine-view-events-rollup`).
- Secrets runtime, validações estruturais e de segurança, critérios de aceite explícitos.
