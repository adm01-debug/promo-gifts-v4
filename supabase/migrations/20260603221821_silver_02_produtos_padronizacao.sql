
-- ════════════════════════════════════════════════════════════════
-- SILVER — produtos_padronizacao
-- Recebe o cru da supplier_products_raw, aplica equivalências
-- (cor, NCM, unidade…) e guarda o produto JÁ PADRONIZADO, pronto
-- para promover a products. Uma linha por (supplier_id, supplier_reference).
-- ════════════════════════════════════════════════════════════════

CREATE TYPE produtos_padronizacao_status AS ENUM
  ('pending','standardized','rejected','promoted');

CREATE TABLE public.produtos_padronizacao (
  -- Identidade / proveniência
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_id              uuid REFERENCES public.supplier_products_raw(id) ON DELETE SET NULL,
  supplier_id         uuid NOT NULL REFERENCES public.suppliers(id),
  supplier_reference  text NOT NULL,
  product_id          uuid REFERENCES public.products(id) ON DELETE SET NULL,  -- vínculo após promoção

  -- ── NÚCLEO DE INGESTÃO (já padronizado; mesmos nomes/tipos de products) ──
  name                text,
  description         text,
  short_description   varchar,
  cost_price          numeric,
  suggested_price     numeric,
  stock_quantity      integer,
  primary_image_url   text,
  images              jsonb,
  ncm_code            varchar,          -- já normalizado (8 dígitos, sem ponto)
  weight_g            integer,
  height_cm           numeric,
  width_cm            numeric,
  length_cm           numeric,
  dimensions_display  varchar,
  box_length_cm       numeric,
  box_width_cm        numeric,
  box_height_cm       numeric,
  box_weight_kg       numeric,
  box_volume_cm3      numeric,
  box_quantity        integer,
  box_inner_quantity  integer,
  brand               varchar,
  packing_type        varchar,
  repacking_type      varchar,
  capacities          varchar,
  capacity_ml         integer,
  min_quantity        integer,
  warranty_months     integer,
  ipi_rate            numeric,
  engraving_type      text,
  is_active           boolean,

  -- ── Equivalências resolvidas (resultado da padronização de cor) ──
  colors              jsonb,            -- cores canônicas resolvidas via supplier_colors

  -- ── Controle do fluxo bronze→silver→gold ──
  status              produtos_padronizacao_status NOT NULL DEFAULT 'pending',
  validation_errors   jsonb,            -- por que foi 'rejected' (ex.: ncm inválido)
  standardized_at     timestamptz,
  promoted_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_pad_supplier_reference UNIQUE (supplier_id, supplier_reference)
);

-- Índices de fila/promoção (parciais — só o que está quente)
CREATE INDEX idx_pad_to_standardize ON public.produtos_padronizacao (supplier_id) WHERE status='pending';
CREATE INDEX idx_pad_to_promote     ON public.produtos_padronizacao (supplier_id) WHERE status='standardized';
CREATE INDEX idx_pad_rejected       ON public.produtos_padronizacao (supplier_id) WHERE status='rejected';
CREATE INDEX idx_pad_product        ON public.produtos_padronizacao (product_id) WHERE product_id IS NOT NULL;

-- updated_at automático (reusa a função existente do projeto)
CREATE TRIGGER set_updated_at_trigger
  BEFORE UPDATE ON public.produtos_padronizacao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.produtos_padronizacao IS
  'SILVER: produtos padronizados (equivalências de cor/NCM/unidade resolvidas) prontos para promoção a products. Bronze=supplier_products_raw, Gold=products.';
