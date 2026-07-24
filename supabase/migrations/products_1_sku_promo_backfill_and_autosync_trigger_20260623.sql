-- M1: sku_promo backfill 449 NULLs + trigger auto-sync
SELECT set_config('app.write_source','pipeline',true);
UPDATE public.products SET sku_promo=sku WHERE sku_promo IS NULL;
SELECT set_config('app.write_source','ui',true);
CREATE OR REPLACE FUNCTION public.fn_sync_sku_promo() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$BEGIN NEW.sku_promo:=NEW.sku;RETURN NEW;END;$$;
DROP TRIGGER IF EXISTS trg_sync_sku_promo ON public.products;
CREATE TRIGGER trg_sync_sku_promo BEFORE INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.fn_sync_sku_promo();
