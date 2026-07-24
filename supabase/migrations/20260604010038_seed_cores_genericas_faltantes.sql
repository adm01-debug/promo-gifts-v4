
-- Adiciona os 7 genéricos de cor que faltavam em color_variations.
-- color_groups já existem; inserimos a cor-base de cada grupo.
-- Eleva o casamento canônico de cores básicas (Só Marcas, XBZ, Asia, Spot).
INSERT INTO public.color_variations (organization_id, group_id, name, slug, hex_code, sort_order, is_active)
SELECT '5db5aee1-064b-4ef4-9193-345dcd8274ea'::uuid, g.gid, g.nm, g.sl, g.hx, 1, true
FROM (VALUES
  ('338990e8-ba94-49f7-a6f5-2894d9dd9e46'::uuid, 'Vermelho', 'vermelho', '#FF0000'),
  ('8a1228e6-cc13-409f-b198-a69759030991'::uuid, 'Verde',    'verde',    '#008000'),
  ('0d73b500-f376-46b5-9810-f1205f69c1c3'::uuid, 'Amarelo',  'amarelo',  '#FFD400'),
  ('ce4c9f22-d0aa-4661-9cce-faa8264b583a'::uuid, 'Rosa',     'rosa',     '#FF80AB'),
  ('419ad481-cb82-49df-9e2e-9b1ab262c831'::uuid, 'Marrom',   'marrom',   '#795548'),
  ('d5ac13dc-8554-4ee2-845b-b7d5a084a42c'::uuid, 'Roxo',     'roxo',     '#7B1FA2'),
  ('338990e8-ba94-49f7-a6f5-2894d9dd9e46'::uuid, 'Vinho',    'vinho',    '#722F37')
) AS g(gid, nm, sl, hx)
WHERE NOT EXISTS (
  SELECT 1 FROM public.color_variations cv
  WHERE upper(trim(cv.name)) = upper(g.nm) AND cv.is_active
);
