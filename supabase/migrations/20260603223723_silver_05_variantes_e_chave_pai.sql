
-- ════════════════════════════════════════════════════════════════
-- SILVER nível-2: variantes padronizadas + derivação da chave-pai
-- Cada linha raw é uma variante; o produto-pai agrupa pelo código-base.
-- ════════════════════════════════════════════════════════════════

-- Deriva a referência do PRODUTO-PAI a partir do ref da variante, por fornecedor.
-- Regra geral: parte antes do último hífen. Spot: usa ProdReference explícito do raw.
CREATE OR REPLACE FUNCTION public.fn_derive_parent_ref(p_supplier_id uuid, p_variant_ref text, p_raw jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  v_parent text;
BEGIN
  IF p_variant_ref IS NULL OR TRIM(p_variant_ref) = '' THEN
    RETURN NULL;
  END IF;

  -- Spot: o raw já traz a referência-pai explícita
  IF p_supplier_id = 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0' THEN
    v_parent := COALESCE(NULLIF(TRIM(p_raw->>'ProdReference'), ''), p_variant_ref);
    RETURN v_parent;
  END IF;

  -- XBZ / Asia / Só Marcas / outros: parte antes do ÚLTIMO hífen.
  -- Se não há hífen, a própria ref é o pai (produto sem variação de cor).
  IF position('-' IN p_variant_ref) > 0 THEN
    v_parent := regexp_replace(p_variant_ref, '-[^-]*$', '');
  ELSE
    v_parent := p_variant_ref;
  END IF;

  RETURN v_parent;
END;
$$;

-- Silver de variantes (espelha o núcleo de product_variants)
CREATE TABLE public.produtos_padronizacao_variantes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_id              uuid REFERENCES public.supplier_products_raw(id) ON DELETE SET NULL,
  supplier_id         uuid NOT NULL REFERENCES public.suppliers(id),
  parent_reference    text NOT NULL,          -- chave do produto-pai (agrupador)
  variant_reference   text NOT NULL,          -- ref da variante (= supplier_reference da raw)

  -- núcleo da variante (já padronizado)
  sku                 text,                   -- com prefixo do fornecedor (ex. XBZ-08268A-AZU)
  supplier_sku        text,
  color_name          text,                   -- nome canônico resolvido
  color_code          text,
  color_hex           text,
  color_id            uuid,                    -- equivalência via supplier_colors (se houver)
  stock_quantity      integer,
  capacity_ml         integer,
  cost_price          numeric,                 -- custo por variante (vai p/ variant_supplier_sources)
  is_active           boolean DEFAULT true,

  -- vínculo após promoção
  pad_id              uuid REFERENCES public.produtos_padronizacao(id) ON DELETE SET NULL,
  variant_id          uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,

  status              public.produtos_padronizacao_status NOT NULL DEFAULT 'pending',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_padvar_supplier_variant UNIQUE (supplier_id, variant_reference)
);

CREATE INDEX idx_padvar_parent ON public.produtos_padronizacao_variantes (supplier_id, parent_reference);
CREATE INDEX idx_padvar_status ON public.produtos_padronizacao_variantes (supplier_id) WHERE status='pending';
CREATE INDEX idx_padvar_pad    ON public.produtos_padronizacao_variantes (pad_id) WHERE pad_id IS NOT NULL;

CREATE TRIGGER set_updated_at_trigger
  BEFORE UPDATE ON public.produtos_padronizacao_variantes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.produtos_padronizacao_variantes IS
  'SILVER nível-2: variantes padronizadas (cor resolvida). Agrupadas em produtos_padronizacao pelo parent_reference.';
