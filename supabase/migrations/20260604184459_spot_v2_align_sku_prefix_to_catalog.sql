-- ============================================================
-- Decisão de arquitetura — sku_prefix do Spot
-- Os 1.200 produtos Spot existentes usam sku = ProdReference PURO (0 com 'SPOT-').
-- supplier_settings.sku_prefix estava 'SPOT-', logo PRODUTOS NOVOS via v2 sairiam
-- com formato divergente do catálogo. products.sku é UNIQUE e chave natural
-- amplamente referenciada (contrato v_products_public, pedidos, URLs); reescrever
-- 1.200 skus seria arriscado. Alinhamos os NOVOS ao padrão vigente (sem prefixo),
-- mantendo o catálogo uniforme sem tocar nas chaves existentes.
-- (Alternativa futura: padronizar tudo em 'SPOT-' via migração dedicada que
--  atualize os 1.200 + todas as linhas que referenciam esses skus.)
UPDATE supplier_settings
   SET sku_prefix = '', updated_at = now()
 WHERE supplier_id = 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0';

-- ROLLBACK: UPDATE supplier_settings SET sku_prefix='SPOT-' WHERE supplier_id='bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0';
-- ============================================================