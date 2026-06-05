-- ============================================================================
-- Fix de paridade crítico: fn_process_raw_v2 vs. process_spot_products (legada)
-- Projeto: doufsxqlfjyuvxuezpln  | Fornecedor SPOT: bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0
-- Ref.: docs/AUDITORIA_GAPS_CRITICOS_fn_process_raw_v2_2026-06-04.md
--
-- CONTEXTO
--   A legada gravava product_type='product' (hardcoded). A v2 ativou o mapping
--   Type -> products.product_type (transform 'direct'), que injeta as CATEGORIAS
--   da SPOT (SUCO, Escrita, Tecnologia, ...). Isso viola a CHECK
--   products_product_type_check (product|packaging|accessory|kit|component),
--   fazendo o UPDATE do produto abortar. Como INSERT e UPDATE do produto correm no
--   mesmo bloco BEGIN/EXCEPTION por parent, o rollback ao savepoint desfaz o INSERT:
--   o produto NUNCA é criado e a raw permanece 'pending' (retry infinito). Medido:
--   1200/1200 ProdReferences (100%) afetados.
--
--   Adicionalmente, dois campos texto da v2 estouram o tamanho da coluna com dados
--   reais da SPOT: ShortDescription (969) > short_description varchar(500) e
--   Taric (11) > ncm_code varchar(10).
-- ============================================================================

BEGIN;

-- 1) CRÍTICO — restaura paridade com a legada: product_type volta ao default 'product'.
--    Desativa o mapping envenenado (Type é categoria, não product_type).
UPDATE public.supplier_field_mappings
   SET is_active = false,
       updated_at = now()
 WHERE supplier_id = 'bcfc0d02-44c6-48ae-8472-12b1a3f3d8e0'::uuid
   AND target_table = 'products'
   AND target_field = 'product_type'
   AND is_active = true;

-- 2) Overflow — short_description: varchar(500) -> text (sem rewrite, sem perda).
ALTER TABLE public.products
  ALTER COLUMN short_description TYPE text;

-- 3) Overflow — ncm_code: varchar(10) -> varchar(20) (aumento de tamanho = metadata-only).
ALTER TABLE public.products
  ALTER COLUMN ncm_code TYPE varchar(20);

COMMIT;

-- Validação sugerida (dry-run transacional, reverter com ROLLBACK):
--   inserir raw com Type='SUCO' e Taric/ShortDescription longos, chamar
--   fn_process_raw_v2(...,100,true) e conferir: produto criado com
--   product_type='product', ncm_code e short_description gravados, raw 'processed'.
