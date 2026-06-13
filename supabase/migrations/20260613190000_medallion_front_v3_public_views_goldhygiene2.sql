-- ============================================================================
-- Migration: 20260611170000_medallion_front_v3_tags_techniques_nuances_kitprintareas_goldhygiene2
-- Contexto : Integração FRONT ↔ Medallion (Bronze→Prata→Ouro), rodada v3.
--            Continuação de 20260611160000 (v2). SSOT doufsxqlfjyuvxuezpln.
-- Idempotente: CREATE OR REPLACE / REVOKE / loop to_regclass.
--
-- O que esta migração versiona (já aplicada ao vivo — suíte anon 31/31):
--   F6  CORREÇÃO DE BUG: v_tags_public + v_product_tags_public.
--       A policy de SELECT de tags/product_tags chama user_belongs_to_org(),
--       função SEM grant EXECUTE p/ anon → QUALQUER página que carregasse tags
--       quebrava com erro 42501 (não degradava vazio: estourava exceção).
--       49.442 vínculos tag↔produto destravados.
--   F7  3 views p/ tabelas RLS-vazio que a UI consome:
--       v_personalization_techniques_public (11 técnicas de gravação),
--       v_color_nuances_public (7 acabamentos),
--       v_kit_component_print_areas_public (1.018 áreas de impressão de kit).
--   F8  Higiene Gold round 2: revoga escrita anon órfã em +10 tabelas de
--       referência/catálogo (bases das views novas). RLS já bloqueava.
--
-- Projeções omitem deliberadamente campos internos:
--   tags/color_nuances → organization_id, bitrix_id
--   personalization_techniques → prompt_suffix (IA), base_cost_multiplier (custo)
--   kit_component_print_areas → tabela_preco_id (liga a custo de gravação)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- F6.a — v_tags_public (labels de vitrine: "Mais Vendido", "Biodegradável"…)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_tags_public AS
SELECT t.id,
       t.name,
       t.slug,
       t.color_hex,
       t.description,
       t.usage_count
FROM public.tags t
WHERE t.is_active = true;
ALTER VIEW public.v_tags_public SET (security_invoker = false);
GRANT SELECT ON public.v_tags_public TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- F6.b — v_product_tags_public (ponte produto↔tag; só produto ativo + tag ativa)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_product_tags_public AS
SELECT pt.id,
       pt.product_id,
       pt.tag_id
FROM public.product_tags pt
JOIN public.products p ON p.id = pt.product_id
   AND p.is_active = true AND p.is_deleted IS NOT TRUE
JOIN public.tags t ON t.id = pt.tag_id AND t.is_active = true;
ALTER VIEW public.v_product_tags_public SET (security_invoker = false);
GRANT SELECT ON public.v_product_tags_public TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- F7.a — v_personalization_techniques_public (Bordado, Silk, Laser, DTF…)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_personalization_techniques_public AS
SELECT pt.id,
       pt.name,
       pt.code,
       pt.description,
       pt.requires_color_count
FROM public.personalization_techniques pt
WHERE pt.is_active = true;
ALTER VIEW public.v_personalization_techniques_public SET (security_invoker = false);
GRANT SELECT ON public.v_personalization_techniques_public TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- F7.b — v_color_nuances_public (Fosco, Metalizado, Perolizado, Neon…)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_color_nuances_public AS
SELECT cn.id,
       cn.name,
       cn.slug,
       cn.description,
       cn.sort_order
FROM public.color_nuances cn
WHERE cn.is_active = true;
ALTER VIEW public.v_color_nuances_public SET (security_invoker = false);
GRANT SELECT ON public.v_color_nuances_public TO anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- F7.c — v_kit_component_print_areas_public (áreas de impressão de kits ativos)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_kit_component_print_areas_public AS
SELECT kpa.id,
       kpa.kit_component_id,
       kpa.location_code,
       kpa.location_name,
       kpa.location_order,
       kpa.max_width,
       kpa.max_height,
       kpa.shape,
       kpa.is_curved,
       kpa.technique_order
FROM public.kit_component_print_areas kpa
JOIN public.product_kit_components pkc ON pkc.id = kpa.kit_component_id
JOIN public.products p ON p.id = pkc.kit_product_id
   AND p.is_active = true AND p.is_deleted IS NOT TRUE
WHERE kpa.is_active = true;
ALTER VIEW public.v_kit_component_print_areas_public SET (security_invoker = false);
GRANT SELECT ON public.v_kit_component_print_areas_public TO anon, authenticated, service_role;

COMMIT;

-- ----------------------------------------------------------------------------
-- F8 — Higiene Gold round 2 (FORA de transação). Remove escrita anon órfã em
-- +10 tabelas de referência/catálogo. RLS já bloqueia (condições auth.uid()/
-- is_admin_or_above, falsas p/ anon). SELECT preservado.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  alvos text[] := ARRAY[
    'tags','product_tags','personalization_techniques','color_nuances','kit_component_print_areas',
    'kit_component_types','kit_variants','supplier_colors','supplier_branches','supplier_property_mappings',
    'product_groups','product_group_members'
  ];
BEGIN
  FOREACH t IN ARRAY alvos LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM anon', t);
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- FIM — pós-condições (validadas como role anon, suíte 31/31):
--   * v_tags_public 79 · v_product_tags_public 49.442
--   * v_personalization_techniques_public 11 · v_color_nuances_public 7
--   * v_kit_component_print_areas_public 1.018
--   * join produto×tag×nome 49.442 (cenário que quebrava com 42501 → OK)
--   * base tags/product_tags continuam negadas p/ anon (segurança preservada)
--   * 0 tabelas de referência/catálogo com escrita anon (42 no total c/ v2)
-- ============================================================================
