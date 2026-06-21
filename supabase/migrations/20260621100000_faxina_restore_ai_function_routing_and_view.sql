-- FAXINA ROLLBACK: restore ai_function_routing to public + recreate v_ai_function_routing_effective
-- Reason: ai_function_routing was incorrectly moved to archive schema.
-- The table is actively used by the ai-router edge function via the view.
-- The view v_ai_function_routing_effective was also missing (dropped by tier3 migration).

-- Step 1: restore the table
ALTER TABLE archive.ai_function_routing SET SCHEMA public;

-- Step 2: recreate the view
CREATE OR REPLACE VIEW public.v_ai_function_routing_effective AS
SELECT
  r.id                        AS routing_id,
  r.function_name,
  r.is_active,
  r.required_capabilities,
  r.request_overrides,
  r.primary_model_id,
  pm.model_id                 AS primary_model,
  pm.capabilities             AS primary_capabilities,
  pm.provider_id              AS primary_provider_id,
  pp.slug                     AS primary_provider_slug,
  pm.is_active                AS primary_active,
  pp.is_active                AS primary_provider_active,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'model_id',        fm.id,
          'model',           fm.model_id,
          'provider_slug',   fp.slug,
          'capabilities',    fm.capabilities,
          'cost_input',      fm.cost_input_per_1m,
          'cost_output',     fm.cost_output_per_1m,
          'model_active',    fm.is_active,
          'provider_active', fp.is_active,
          'order_index',     ord.idx
        )
        ORDER BY ord.idx
      )
      FROM unnest(r.fallback_model_ids) WITH ORDINALITY AS ord(fallback_model_id, idx)
      JOIN public.ai_models fm ON fm.id = ord.fallback_model_id
      JOIN public.ai_providers fp ON fp.id = fm.provider_id
    ),
    '[]'::jsonb
  )                           AS fallbacks
FROM public.ai_function_routing r
JOIN public.ai_models pm ON pm.id = r.primary_model_id
JOIN public.ai_providers pp ON pp.id = pm.provider_id;

-- Step 3: restore grants
GRANT SELECT ON public.v_ai_function_routing_effective TO authenticated;
GRANT SELECT ON public.v_ai_function_routing_effective TO service_role;

-- Step 4: restore table grants
REVOKE ALL ON public.ai_function_routing FROM anon;
GRANT SELECT ON public.ai_function_routing TO authenticated;
GRANT ALL   ON public.ai_function_routing TO service_role;
