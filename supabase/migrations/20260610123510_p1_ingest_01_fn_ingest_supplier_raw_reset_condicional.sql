-- P1: fn_ingest_supplier_raw resetava status='pending' INCONDICIONALMENTE em
-- todo upsert (mesma família do carrossel XBZ): cada rodada do loader re-pendurava
-- o feed inteiro mesmo sem mudança (evidência: 300 raws SOMARCAS já processados
-- voltando a pending, payload idêntico). Passa a usar o mesmo contrato de
-- insert_supplier_product_raw: re-dispara só quando o content_hash canônico muda.
CREATE OR REPLACE FUNCTION public.fn_ingest_supplier_raw(
  p_supplier_id uuid, p_reference text, p_raw jsonb,
  p_sku text DEFAULT NULL::text, p_source text DEFAULT 'n8n'::text)
RETURNS TABLE(acao text, raw_id uuid, content_hash text)
LANGUAGE plpgsql
SET search_path = public
AS $$
declare
  v_ref     text := btrim(p_reference);
  v_existed boolean;
  v_id      uuid;
  v_hash    text;
begin
  if p_supplier_id is null or v_ref is null or v_ref = '' then
    raise exception 'fn_ingest_supplier_raw: supplier_id e reference sao obrigatorios';
  end if;
  if p_raw is null or jsonb_typeof(p_raw) <> 'object' then
    raise exception 'fn_ingest_supplier_raw: raw deve ser um objeto jsonb';
  end if;

  v_existed := exists (
    select 1 from public.supplier_products_raw
     where supplier_id = p_supplier_id and supplier_reference = v_ref
  );

  insert into public.supplier_products_raw
    (supplier_id, supplier_reference, supplier_sku, raw_data, source_channel)
  values
    (p_supplier_id, v_ref, coalesce(nullif(btrim(p_sku), ''), v_ref), p_raw, coalesce(p_source, 'n8n'))
  on conflict (supplier_id, supplier_reference) do update
     set raw_data       = excluded.raw_data,
         supplier_sku   = excluded.supplier_sku,
         source_channel = excluded.source_channel,
         status         = case
                            when supplier_products_raw.content_hash is distinct from excluded.content_hash
                            then 'pending'::supplier_raw_status
                            else supplier_products_raw.status
                          end,
         updated_at     = now()
  returning id, supplier_products_raw.content_hash into v_id, v_hash;

  return query select case when v_existed then 'updated' else 'inserted' end, v_id, v_hash;
end;
$$;
