-- ================================================================
-- Migration: fix_generated_always_columns_batch
-- Date: 2026-06-23
--
-- PostgREST v12 (Supabase) exclui GENERATED ALWAYS STORED do schema cache.
-- 3 tabelas afetadas causando 400 ou dados incorretos via REST API:
--
-- 1. product_variants: next_entry_date, next_entry_quantity → 400 em páginas de produto
-- 2. workspace_notifications: search_vector → 400 na busca de notificações
-- 3. ai_usage_logs: total_tokens → NaN no painel AI (select('*') retorna undefined)
--
-- Fix: DROP GENERATED ALWAYS → ADD regular column + populate + BEFORE INSERT OR UPDATE trigger
-- ================================================================

-- ① product_variants
ALTER TABLE public.product_variants DROP COLUMN IF EXISTS next_entry_date;
ALTER TABLE public.product_variants DROP COLUMN IF EXISTS next_entry_quantity;
ALTER TABLE public.product_variants ADD COLUMN next_entry_date date;
ALTER TABLE public.product_variants ADD COLUMN next_entry_quantity integer;
UPDATE public.product_variants SET next_entry_date = next_date_1, next_entry_quantity = next_quantity_1;
CREATE INDEX IF NOT EXISTS idx_pv_next_entry_date_nonnull ON public.product_variants USING btree (next_entry_date) WHERE next_entry_date IS NOT NULL;
CREATE OR REPLACE FUNCTION public.fn_sync_product_variants_next_entry() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN NEW.next_entry_date := NEW.next_date_1; NEW.next_entry_quantity := NEW.next_quantity_1; RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_zzz_sync_next_entry_cols ON public.product_variants;
CREATE TRIGGER trg_zzz_sync_next_entry_cols BEFORE INSERT OR UPDATE ON public.product_variants FOR EACH ROW EXECUTE FUNCTION public.fn_sync_product_variants_next_entry();

-- ② workspace_notifications
ALTER TABLE public.workspace_notifications DROP COLUMN IF EXISTS search_vector;
ALTER TABLE public.workspace_notifications ADD COLUMN search_vector tsvector;
UPDATE public.workspace_notifications SET search_vector = to_tsvector('portuguese', COALESCE(title, '') || ' ' || COALESCE(message, ''));
CREATE INDEX IF NOT EXISTS idx_workspace_notifications_search_vector ON public.workspace_notifications USING gin (search_vector);
CREATE OR REPLACE FUNCTION public.fn_sync_workspace_notifications_search_vector() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$ BEGIN NEW.search_vector := to_tsvector('portuguese', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.message, '')); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_sync_workspace_notifications_search_vector ON public.workspace_notifications;
CREATE TRIGGER trg_sync_workspace_notifications_search_vector BEFORE INSERT OR UPDATE OF title, message ON public.workspace_notifications FOR EACH ROW EXECUTE FUNCTION public.fn_sync_workspace_notifications_search_vector();

-- ③ ai_usage_logs
ALTER TABLE public.ai_usage_logs DROP COLUMN IF EXISTS total_tokens;
ALTER TABLE public.ai_usage_logs ADD COLUMN total_tokens integer;
UPDATE public.ai_usage_logs SET total_tokens = COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0);
CREATE OR REPLACE FUNCTION public.fn_sync_ai_usage_logs_total_tokens() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN NEW.total_tokens := COALESCE(NEW.input_tokens, 0) + COALESCE(NEW.output_tokens, 0); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_sync_ai_usage_logs_total_tokens ON public.ai_usage_logs;
CREATE TRIGGER trg_sync_ai_usage_logs_total_tokens BEFORE INSERT OR UPDATE OF input_tokens, output_tokens ON public.ai_usage_logs FOR EACH ROW EXECUTE FUNCTION public.fn_sync_ai_usage_logs_total_tokens();

NOTIFY pgrst, 'reload schema';
