-- Higiene/consistência: fixa search_path=public nas últimas funções de pipeline (produto/estoque/cor/imagem)
-- que estavam sem search_path. Usamos ALTER FUNCTION (NÃO reescreve o corpo => risco zero de alterar lógica).
-- Todas verificadas: não usam objetos de 'extensions' (unaccent/pg_trgm), logo 'public' é suficiente e correto.
-- Isto torna as funções determinísticas quanto à resolução de nomes, independente do search_path do chamador,
-- alinhando ao padrão do restante do código (todas as DEFINER já têm search_path; 0 DEFINER sem search_path no banco).
ALTER FUNCTION public.fn_link_images_to_variants_by_synonym(boolean) SET search_path = public;
ALTER FUNCTION public.fn_resolve_color_for_variant(uuid, text) SET search_path = public;
ALTER FUNCTION public.fn_xbz_enrich_gold_extractors(uuid, integer) SET search_path = public;
ALTER FUNCTION public.fn_xbz_enrich_gold_extractors(uuid, integer, boolean) SET search_path = public;
ALTER FUNCTION public.fn_xbz_enrich_stock(uuid, text, numeric, numeric, boolean, numeric) SET search_path = public;
-- fn_silver_to_gold__deprecated_20260606: DEPRECATED e órfã (0 refs em cron/funções; superseded por fn_site_promote_to_gold).
-- Mantida e endurecida por segurança (não dropada: impacto alto caso algum n8n/edge function externo ainda a chame).
-- CANDIDATA A DROP após confirmação de ausência de chamadores externos.
ALTER FUNCTION public.fn_silver_to_gold__deprecated_20260606(uuid) SET search_path = public;
