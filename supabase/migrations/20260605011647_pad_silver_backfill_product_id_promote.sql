UPDATE public.produtos_padronizacao p
SET product_id  = g.id,
    status      = 'promoted',
    promoted_at = COALESCE(p.promoted_at, now())
FROM public.products g
WHERE g.supplier_id        = p.supplier_id
  AND g.supplier_reference = p.supplier_reference
  AND p.product_id IS NULL;