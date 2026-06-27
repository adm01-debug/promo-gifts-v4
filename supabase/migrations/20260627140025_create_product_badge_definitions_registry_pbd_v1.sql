-- =========================================================================
-- Registro canônico de governança das BADGES DE PRODUTOS
-- fix_version=pbd_v1_20260627
-- Aditivo: NÃO altera o cálculo/render existente. Fonte única de verdade para
-- nome, cores, ícones, onde/como usar, regra de negócio, prioridade e config.
-- =========================================================================
CREATE TABLE public.product_badge_definitions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_key    text NOT NULL,
  name         text NOT NULL,
  short_label  text,
  description  text NOT NULL DEFAULT '',
  business_rule text NOT NULL DEFAULT '',
  category     text NOT NULL,
  source_kind  text NOT NULL,
  data_source  text NOT NULL DEFAULT '',
  placements   text[] NOT NULL DEFAULT '{}',
  surfaces     text[] NOT NULL DEFAULT '{}',
  icon_lucide  text,
  icon_emoji   text,
  color_token  text NOT NULL DEFAULT 'neutral',
  class_bg     text,
  class_text   text,
  class_border text,
  priority     integer NOT NULL DEFAULT 100,
  sort_order   integer NOT NULL DEFAULT 0,
  config       jsonb NOT NULL DEFAULT '{}'::jsonb,
  supports_expiration boolean NOT NULL DEFAULT false,
  is_enabled   boolean NOT NULL DEFAULT true,
  is_system    boolean NOT NULL DEFAULT true,
  notes        text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid DEFAULT auth.uid(),
  updated_by   uuid DEFAULT auth.uid(),
  CONSTRAINT pbd_badge_key_unique  UNIQUE (badge_key),
  CONSTRAINT pbd_badge_key_format  CHECK (badge_key ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT pbd_category_valid    CHECK (category IN ('status_estoque','novidade','curadoria','comercial','inteligencia','atributo','acao','sistema')),
  CONSTRAINT pbd_source_kind_valid CHECK (source_kind IN ('computed','manual','pipeline','intelligence','ui_only','hybrid')),
  CONSTRAINT pbd_color_token_valid CHECK (color_token IN ('neutral','red','orange','amber','yellow','green','teal','cyan','blue','indigo','violet','purple','pink','stone','brand')),
  CONSTRAINT pbd_priority_range    CHECK (priority BETWEEN 0 AND 1000),
  CONSTRAINT pbd_placements_valid  CHECK (placements <@ ARRAY['card_header_left','card_header_right','card_body','card_footer','corner_bl','corner_br','intelligence_panel','product_detail','catalog']::text[]),
  CONSTRAINT pbd_surfaces_valid    CHECK (surfaces   <@ ARRAY['catalog','super_filter','product_detail','novelties','comparison','quote_builder','inventory']::text[])
);

CREATE INDEX idx_pbd_category       ON public.product_badge_definitions(category);
CREATE INDEX idx_pbd_enabled        ON public.product_badge_definitions(is_enabled);
CREATE INDEX idx_pbd_source_kind    ON public.product_badge_definitions(source_kind);
CREATE INDEX idx_pbd_sort           ON public.product_badge_definitions(sort_order, priority DESC);
CREATE INDEX idx_pbd_placements_gin ON public.product_badge_definitions USING gin(placements);

ALTER TABLE public.product_badge_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY pbd_public_read  ON public.product_badge_definitions FOR SELECT TO authenticated, anon USING (true);
CREATE POLICY pbd_admin_insert ON public.product_badge_definitions FOR INSERT TO public WITH CHECK (public.is_admin_or_above(auth.uid()));
CREATE POLICY pbd_admin_update ON public.product_badge_definitions FOR UPDATE TO public USING (public.is_admin_or_above(auth.uid())) WITH CHECK (public.is_admin_or_above(auth.uid()));
CREATE POLICY pbd_admin_delete ON public.product_badge_definitions FOR DELETE TO public USING (public.is_admin_or_above(auth.uid()) AND is_system = false);

CREATE OR REPLACE FUNCTION public.fn_pbd_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO public AS $fn$
BEGIN
  -- fix_version=pbd_v1_20260627 | ANTI-REGRESSAO: manter SET search_path
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := COALESCE(NEW.created_at, now());
    NEW.updated_at := now();
    IF NEW.created_by IS NULL THEN NEW.created_by := auth.uid(); END IF;
    NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.badge_key IS DISTINCT FROM OLD.badge_key THEN
      RAISE EXCEPTION 'badge_key e imutavel (% -> %)', OLD.badge_key, NEW.badge_key USING ERRCODE = '23514';
    END IF;
    IF NEW.is_system IS DISTINCT FROM OLD.is_system AND NOT public.has_role(auth.uid(), 'dev'::app_role) THEN
      NEW.is_system := OLD.is_system;
    END IF;
    NEW.created_at := OLD.created_at;
    NEW.created_by := OLD.created_by;
    NEW.updated_at := now();
    NEW.updated_by := COALESCE(auth.uid(), OLD.updated_by);
  END IF;
  RETURN NEW;
END;$fn$;
CREATE TRIGGER trg_pbd_before_write BEFORE INSERT OR UPDATE ON public.product_badge_definitions FOR EACH ROW EXECUTE FUNCTION public.fn_pbd_before_write();

CREATE OR REPLACE FUNCTION public.fn_pbd_block_system_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO public AS $fn$
BEGIN
  -- fix_version=pbd_v1_20260627
  IF OLD.is_system THEN
    RAISE EXCEPTION 'Badge de sistema "%" nao pode ser excluida (apenas desabilitada via is_enabled).', OLD.badge_key USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;$fn$;
CREATE TRIGGER trg_pbd_block_system_delete BEFORE DELETE ON public.product_badge_definitions FOR EACH ROW EXECUTE FUNCTION public.fn_pbd_block_system_delete();

CREATE OR REPLACE FUNCTION public.fn_pbd_project_intelligence_settings()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public AS $fn$
DECLARE v_hot boolean; v_best_enabled boolean; v_best_min numeric;
BEGIN
  -- fix_version=pbd_v1_20260627 | ANTI-REGRESSAO: SECURITY DEFINER + SET search_path obrigatorios
  -- Projeta hot_item/best_seller para admin_settings.intelligence_badges (compat ProductCard ao vivo).
  IF COALESCE(NEW.badge_key, OLD.badge_key) NOT IN ('hot_item','best_seller') THEN RETURN NULL; END IF;
  SELECT is_enabled INTO v_hot FROM public.product_badge_definitions WHERE badge_key = 'hot_item';
  SELECT is_enabled, NULLIF(config->>'minAvgDailyDepletion7d','')::numeric
    INTO v_best_enabled, v_best_min FROM public.product_badge_definitions WHERE badge_key = 'best_seller';
  INSERT INTO public.admin_settings(key, value, updated_at)
  VALUES ('intelligence_badges', jsonb_build_object(
            'hotItem',    jsonb_build_object('enabled', COALESCE(v_hot, true)),
            'bestSeller', jsonb_build_object('enabled', COALESCE(v_best_enabled, true), 'minAvgDailyDepletion7d', COALESCE(v_best_min, 15))
          ), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
  RETURN NULL;
END;$fn$;
CREATE TRIGGER trg_pbd_project_intelligence AFTER INSERT OR UPDATE OR DELETE ON public.product_badge_definitions FOR EACH ROW EXECUTE FUNCTION public.fn_pbd_project_intelligence_settings();

-- ============================ DOCUMENTAÇÃO ============================
COMMENT ON TABLE public.product_badge_definitions IS 'Registro canonico de governanca das badges de PRODUTOS (nome, cores, icones, onde/como usar, regra de negocio, prioridade, config). Aditivo: nao altera o calculo/render existente. fix_version=pbd_v1_20260627. ANTI-REGRESSAO: nao remover RLS; manter SET search_path nas fns fn_pbd_*; badge_key e imutavel; badges is_system nao sao deletaveis.';
COMMENT ON COLUMN public.product_badge_definitions.badge_key IS 'Slug estavel e imutavel (identidade). Casa com o tipo do badge no frontend.';
COMMENT ON COLUMN public.product_badge_definitions.category IS 'Agrupamento conceitual: status_estoque|novidade|curadoria|comercial|inteligencia|atributo|acao|sistema.';
COMMENT ON COLUMN public.product_badge_definitions.source_kind IS 'Como e dirigido: computed|manual|pipeline|intelligence|ui_only|hybrid.';
COMMENT ON COLUMN public.product_badge_definitions.placements IS 'ONDE aparece no card: card_header_left|card_header_right|card_body|card_footer|corner_bl|corner_br|intelligence_panel|product_detail|catalog.';
COMMENT ON COLUMN public.product_badge_definitions.surfaces IS 'EM QUE telas aparece: catalog|super_filter|product_detail|novelties|comparison|quote_builder|inventory.';
COMMENT ON COLUMN public.product_badge_definitions.priority IS 'Peso de prioridade/proeminencia (maior = mais proeminente).';
COMMENT ON COLUMN public.product_badge_definitions.config IS 'Parametros especificos do badge (limiares, colunas de expiracao, etc).';
COMMENT ON COLUMN public.product_badge_definitions.is_enabled IS 'Liga/desliga global (governanca). Para hot_item/best_seller projeta em admin_settings.intelligence_badges.';
COMMENT ON COLUMN public.product_badge_definitions.is_system IS 'Badge de sistema (semeada). Nao deletavel; apenas configuravel/desabilitavel.';
COMMENT ON FUNCTION public.fn_pbd_before_write() IS 'fix_version=pbd_v1_20260627. Auditoria (created/updated by/at) + imutabilidade de badge_key + protecao de is_system.';
COMMENT ON FUNCTION public.fn_pbd_block_system_delete() IS 'fix_version=pbd_v1_20260627. Bloqueia DELETE de badges is_system.';
COMMENT ON FUNCTION public.fn_pbd_project_intelligence_settings() IS 'fix_version=pbd_v1_20260627. Projeta hot_item/best_seller para admin_settings.intelligence_badges (compat ProductCard).';
