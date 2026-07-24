-- PASSO 45: Remover duplicata de process_spot_products no pg_cron (T44)
-- O job aparece com jobid 2 e 3 com comando idêntico — duplicata não intencional

DO $$
DECLARE
  v_count int;
  v_min_id bigint;
  v_max_id bigint;
BEGIN
  SELECT COUNT(*), MIN(jobid), MAX(jobid)
  INTO v_count, v_min_id, v_max_id
  FROM cron.job
  WHERE command LIKE '%process_spot_products%';

  IF v_count > 1 THEN
    -- Mantém o job mais antigo (menor ID), remove os duplicados
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE command LIKE '%process_spot_products%'
      AND jobid != v_min_id;

    RAISE NOTICE 'Removida(s) % duplicata(s) de process_spot_products', v_count - 1;
  ELSE
    RAISE NOTICE 'Nenhuma duplicata encontrada para process_spot_products';
  END IF;
END $$;
