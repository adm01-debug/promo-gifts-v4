
-- Retenção: o que cresce no tempo é o HISTÓRICO (1 versão por mudança, a cada sync).
-- Esta função purga histórico antigo PRESERVANDO sempre a versão mais recente de cada variante.
-- A tabela bronze (estado atual) não é purgada — reflete o catálogo vivo.
CREATE OR REPLACE FUNCTION public.fn_spr_history_purge(p_keep_months int DEFAULT 24)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE v int;
BEGIN
  WITH latest AS (
    SELECT DISTINCT ON (raw_id) id FROM public.supplier_products_raw_history
    ORDER BY raw_id, captured_at DESC
  ), del AS (
    DELETE FROM public.supplier_products_raw_history h
    WHERE h.captured_at < now() - make_interval(months => p_keep_months)
      AND h.id NOT IN (SELECT id FROM latest)
    RETURNING 1
  ) SELECT count(*) INTO v FROM del;
  RETURN v;
END;
$$;
COMMENT ON FUNCTION public.fn_spr_history_purge(int) IS
  'Retenção do histórico: remove versões mais antigas que N meses, sempre mantendo a versão mais recente de cada variante. Rodar sob demanda ou agendar (ex. mensal). ESTRATÉGIA DE ESCALA: particionamento da history por mês de captured_at (ou da bronze por supplier_id) só se justifica a partir de ~milhões de linhas — hoje 16k é trivial e particionar seria contraproducente.';
