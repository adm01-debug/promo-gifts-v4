-- ============================================================
-- Paridade Spot → fn_process_raw_v2 : correções CRÍTICAS (config-only)
-- Projeto pqpdolkaeqlyzpdpbizo · Spot supplier_id bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0
-- ============================================================

-- G1) De-para de products morto: os 7 mappings ativos guardavam source_path em
--     JSONPath ('$.Name'), mas a v2 (e o motor genérico) resolvem source_path
--     como caminho separado por ponto via #>> → '$.Name' = {'$','Name'} → NULL,
--     então name/description/brand/origin/box_* nunca eram gravados.
--     source_field já está correto ('Name', ...). Zerando source_path, a v2 passa
--     a usar ->> source_field. (Cobertura no raw: 100%, origin 97,5%.)
UPDATE supplier_field_mappings
   SET source_path = NULL, updated_at = now()
 WHERE supplier_id = 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0'
   AND target_table = 'products'
   AND source_path LIKE '$.%';

-- G2) Custo nunca gravado: a v2 só grava variant_supplier_sources se houver
--     mapping para essa tabela, e não havia nenhum. Recria o vínculo da legada
--     (cost_price = Price1). O trigger AFTER INSERT trg_supplier_source_price
--     propaga o custo para products.sale_price (markup do fornecedor).
INSERT INTO supplier_field_mappings
   (supplier_id, source_field, source_path, target_table, target_field,
    transform_type, is_active, priority, created_at, updated_at)
VALUES
   ('bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0', 'Price1', NULL,
    'variant_supplier_sources', 'cost_price', 'direct', true, 10, now(), now());

-- ============================================================
-- ROLLBACK (manual):
--   UPDATE supplier_field_mappings SET source_path = '$.' || source_field
--    WHERE supplier_id='bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0' AND target_table='products'
--      AND source_path IS NULL
--      AND source_field IN ('Name','Description','Brand','BoxWeightKG','BoxQuantity','CountryOfOrigin','ProdReference');
--   DELETE FROM supplier_field_mappings
--    WHERE supplier_id='bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0'
--      AND target_table='variant_supplier_sources' AND target_field='cost_price' AND source_field='Price1';
-- ============================================================