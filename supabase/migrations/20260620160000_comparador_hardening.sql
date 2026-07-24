-- Comparador de Produtos — hardening de banco (constraints + RPC)
-- Data: 2026-06-20
--
-- Contexto: auditoria exaustiva do módulo "Comparador de Produtos". Três defeitos
-- de schema impediam funcionalidades de funcionarem corretamente. Todas as
-- alterações são aditivas e idempotentes; verificadas contra dados de produção
-- (user_preferences vazia, 1 slot "current", sem duplicatas).

-- 1) user_preferences.comparison_weights: o hook useComparisonWeights salva via
--    upsert(onConflict: 'user_id'), mas a tabela só tinha PRIMARY KEY (id) — sem
--    constraint UNIQUE em user_id, o ON CONFLICT não tinha alvo e TODO save de
--    pesos falhava ("no unique or exclusion constraint matching the ON CONFLICT").
--    O modelo é 1 linha por usuário; adiciona a UNIQUE que faltava.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_preferences'::regclass
      AND conname = 'user_preferences_user_id_key'
  ) THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- 2) user_comparisons: o sync cross-device grava um único slot "current" por
--    usuário (client_name='current', share_token IS NULL). Sem unicidade, uma
--    corrida entre abas/dispositivos criava slots duplicados, e o maybeSingle()
--    subsequente passava a lançar — travando o sync. Garante um slot por usuário.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_current_comparison
  ON public.user_comparisons (user_id)
  WHERE client_name = 'current' AND share_token IS NULL;

-- 3) get_user_recent_comparisons: não deve expor o slot interno "current" (ele
--    vazava na lista "Recentes" como um item intitulado "current"). Filtra o slot.
CREATE OR REPLACE FUNCTION public.get_user_recent_comparisons(p_limit integer DEFAULT 5)
 RETURNS TABLE(
   id uuid,
   name text,
   client_name text,
   items jsonb,
   item_count integer,
   updated_at timestamp with time zone
 )
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT uc.id, uc.name, uc.client_name, uc.items,
         jsonb_array_length(uc.items) AS item_count, uc.updated_at
  FROM public.user_comparisons uc
  WHERE uc.user_id = auth.uid()
    AND NOT (uc.client_name = 'current' AND uc.share_token IS NULL)
  ORDER BY uc.updated_at DESC
  LIMIT p_limit;
$function$;
