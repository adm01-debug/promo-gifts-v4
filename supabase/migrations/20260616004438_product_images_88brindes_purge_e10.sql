-- ============================================================================
-- E10: Purge 88BRINDES — Chapéu ecoflex (produto_ativo=false)
-- ----------------------------------------------------------------------------
-- 88BRINDES foi fornecedor piloto descontinuado. 1 produto importado
-- (Chapéu ecoflex, is_active=false). Das 14 imagens: 13 já inativas, 1 ativa.
-- Ação: inativar a última imagem ativa + desmarcar is_primary.
-- Não deletar: preservar trilha de auditoria.
-- Triggers AFTER UPDATE sincronizam products.primary_image_url et al.
-- ============================================================================

UPDATE public.product_images
SET
  is_active  = false,
  is_primary = false
WHERE source_supplier = '88BRINDES'
  AND is_active = true;

DO $$
DECLARE
  v_active_remaining int;
BEGIN
  SELECT COUNT(*) INTO v_active_remaining
    FROM public.product_images
   WHERE source_supplier = '88BRINDES' AND is_active = true;
  RAISE NOTICE 'E10: Purge 88BRINDES concluído. Imagens ativas restantes: %', v_active_remaining;
END $$;

COMMENT ON TABLE public.product_images IS
'Tabela-fato de mídia do catálogo (camada Gold). 1 linha = 1 imagem física de produto
hospedada no Cloudflare Images. É a fonte da verdade de imagens; os campos
desnormalizados em products (images, primary_image_url, og_image_url, set_image_url,
primary_image_fallback_url) são MANTIDOS pelos triggers desta tabela.
RLS ativo (leitura pública só de ativas; escrita restrita a org owner/admin).
Fornecedores ativos: SPOT, XBZ, SOMARCAS, ASIA.
88BRINDES: piloto descontinuado (14 imagens inativas, produto Chapéu ecoflex arquivado).';
