-- FIX #4: Remove função morta calculate_personalization_price
-- Referencia tabela product_personalization_options que nunca foi criada.
-- Zero callers confirmados (2026-06-23). Substituída por fn_simular_combo_gravacao_v12.
DROP FUNCTION IF EXISTS public.calculate_personalization_price CASCADE;
