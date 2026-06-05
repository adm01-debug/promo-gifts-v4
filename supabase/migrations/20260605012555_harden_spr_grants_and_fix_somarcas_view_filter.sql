-- 1) Remover privilegios perigosos (TRUNCATE ignora RLS; DELETE/TRIGGER sem uso para anon/authenticated)
REVOKE DELETE, TRIGGER, TRUNCATE ON public.supplier_products_raw FROM anon;
REVOKE DELETE, TRIGGER, TRUNCATE ON public.supplier_products_raw FROM authenticated;

-- 2) Corrigir filtro da view publica (estava 'true', dados usam 'sim' => view retornava 0 linhas)
--    Mantidas as MESMAS colunas/ordem para o CREATE OR REPLACE aceitar.
CREATE OR REPLACE VIEW public.somarcas_catalogo_publico AS
SELECT id,
    raw_data ->> 'codigo'                            AS codigo,
    raw_data ->> 'titulo'                            AS titulo,
    raw_data ->> 'descricao'                         AS descricao,
    raw_data ->> 'url_foto'                          AS url_foto,
    raw_data -> 'matriz_de_fotos_adicionais'         AS fotos_adicionais,
    raw_data -> 'matriz_de_categorias'               AS categorias,
    raw_data -> 'produtos_similares'                 AS produtos_similares,
    raw_data ->> 'dimensoes_do_produto'              AS dimensoes_produto,
    raw_data ->> 'dimensoes_da_embalagem'            AS dimensoes_embalagem,
    raw_data ->> 'peso_da_embalagem'                 AS peso_embalagem,
    raw_data ->> 'embalagem_do_produto'              AS embalagem,
    raw_data ->> 'garantia_do_produto'               AS garantia,
    raw_data ->> 'tipo_gravacao'                     AS tipo_gravacao,
    raw_data ->> 'quantidade_minima_sugerida'        AS quantidade_minima,
    raw_data ->> 'preco_com_gravacao_com_impostos'   AS preco_com_gravacao,
    raw_data ->> 'preco_sem_gravacao_com_impostos'   AS preco_sem_gravacao,
    COALESCE((raw_data ->> 'estoque')::numeric, 0::numeric) > 0::numeric AS disponivel,
    raw_data ->> 'data_ultima_atualizacao'           AS atualizado_em,
    variant_id,
    product_id
FROM supplier_products_raw r
WHERE supplier_id = '841cd690-210a-422a-908c-7676828db272'::uuid
  AND COALESCE(lower(raw_data ->> 'produto_ativo'), 'sim') NOT IN ('nao','não','false','0','f','inativo','no');

COMMENT ON VIEW public.somarcas_catalogo_publico IS
  'Catalogo publico So Marcas (role anon). So vitrine + precos COM impostos; estoque vira boolean disponivel. NUNCA expor precos sem impostos/ipi/ncm/estoque numerico. Filtro corrigido 2026-06: produto_ativo usa valor sim.';

-- 3) Garantir leitura da VIEW pelo anon (idempotente)
GRANT SELECT ON public.somarcas_catalogo_publico TO anon;