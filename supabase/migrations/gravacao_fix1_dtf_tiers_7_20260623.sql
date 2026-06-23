-- FIX #1: Corrige preços DTF — substitui faixa única (R$86.21 flat) por 7 tiers escalonados
-- Afeta: DTF-TEX-CAM-01, DTF-TEX-MOC-01, DTF-TEX-NEC-01, DTF-TEX-SAC-01, DTF-TEX-SAE-01, DTF-UMB-01
-- Referência: DTF-TEX-01 (R$2.20→R$0.35/dm², formula área-based)
-- Data: 2026-06-23

BEGIN;

-- Ajusta preco_minimo_unitario para refletir tier mais baixo real (R$0.35/dm²)
UPDATE tabela_preco_gravacao_oficial
SET preco_minimo_unitario = 0.35, updated_at = NOW()
WHERE codigo_tabela IN ('DTF-TEX-MOC-01', 'DTF-TEX-01');

-- Remove faixas incorretas (1 faixa R$86.21 por tabela)
DELETE FROM tabela_preco_gravacao_oficial_faixa
WHERE id IN (
  '85df7f7d-ae8e-4159-af4e-196b88aaf44d',  -- DTF-TEX-CAM-01
  'e483f92e-ce29-487f-a4ad-5a718fa10d0f',  -- DTF-TEX-MOC-01
  '45c2ab24-e17f-4256-aa6d-a320a71a24f3',  -- DTF-TEX-NEC-01
  '06666318-1954-48f4-ae41-aa2b4c52e8a4',  -- DTF-TEX-SAC-01
  '04116f58-fcab-4afe-91e5-c3f0d31a7623',  -- DTF-TEX-SAE-01
  '44f22857-bee9-4ce5-a1af-26a4d09d0987'   -- DTF-UMB-01
);

-- Insere 7 tiers × 6 tabelas = 42 faixas corretas (R$2.20→R$0.35/dm²)
INSERT INTO tabela_preco_gravacao_oficial_faixa
  (tabela_preco_gravacao_id, quantidade_minima, quantidade_maxima, preco_unitario, prazo_dias, ordem)
VALUES
  ('a68f3f35-b59c-42cc-9a72-62ca3582f67d', 1, 24, 2.20, 2, 1),
  ('a68f3f35-b59c-42cc-9a72-62ca3582f67d', 25, 49, 1.43, 3, 2),
  ('a68f3f35-b59c-42cc-9a72-62ca3582f67d', 50, 99, 0.99, 5, 3),
  ('a68f3f35-b59c-42cc-9a72-62ca3582f67d', 100, 249, 0.70, 7, 4),
  ('a68f3f35-b59c-42cc-9a72-62ca3582f67d', 250, 499, 0.55, 10, 5),
  ('a68f3f35-b59c-42cc-9a72-62ca3582f67d', 500, 999, 0.44, 12, 6),
  ('a68f3f35-b59c-42cc-9a72-62ca3582f67d', 1000, NULL, 0.35, 15, 7),
  ('73afa4be-7dcc-488c-9712-89a32dba125a', 1, 24, 2.20, 2, 1),
  ('73afa4be-7dcc-488c-9712-89a32dba125a', 25, 49, 1.43, 3, 2),
  ('73afa4be-7dcc-488c-9712-89a32dba125a', 50, 99, 0.99, 5, 3),
  ('73afa4be-7dcc-488c-9712-89a32dba125a', 100, 249, 0.70, 7, 4),
  ('73afa4be-7dcc-488c-9712-89a32dba125a', 250, 499, 0.55, 10, 5),
  ('73afa4be-7dcc-488c-9712-89a32dba125a', 500, 999, 0.44, 12, 6),
  ('73afa4be-7dcc-488c-9712-89a32dba125a', 1000, NULL, 0.35, 15, 7),
  ('85f4f7f7-d157-4f0d-ba6f-e48517be193c', 1, 24, 2.20, 2, 1),
  ('85f4f7f7-d157-4f0d-ba6f-e48517be193c', 25, 49, 1.43, 3, 2),
  ('85f4f7f7-d157-4f0d-ba6f-e48517be193c', 50, 99, 0.99, 5, 3),
  ('85f4f7f7-d157-4f0d-ba6f-e48517be193c', 100, 249, 0.70, 7, 4),
  ('85f4f7f7-d157-4f0d-ba6f-e48517be193c', 250, 499, 0.55, 10, 5),
  ('85f4f7f7-d157-4f0d-ba6f-e48517be193c', 500, 999, 0.44, 12, 6),
  ('85f4f7f7-d157-4f0d-ba6f-e48517be193c', 1000, NULL, 0.35, 15, 7),
  ('542fdeff-3469-499f-ab5a-c47e73accdad', 1, 24, 2.20, 2, 1),
  ('542fdeff-3469-499f-ab5a-c47e73accdad', 25, 49, 1.43, 3, 2),
  ('542fdeff-3469-499f-ab5a-c47e73accdad', 50, 99, 0.99, 5, 3),
  ('542fdeff-3469-499f-ab5a-c47e73accdad', 100, 249, 0.70, 7, 4),
  ('542fdeff-3469-499f-ab5a-c47e73accdad', 250, 499, 0.55, 10, 5),
  ('542fdeff-3469-499f-ab5a-c47e73accdad', 500, 999, 0.44, 12, 6),
  ('542fdeff-3469-499f-ab5a-c47e73accdad', 1000, NULL, 0.35, 15, 7),
  ('59f0878c-4dd5-47e5-83e7-0d29034a1407', 1, 24, 2.20, 2, 1),
  ('59f0878c-4dd5-47e5-83e7-0d29034a1407', 25, 49, 1.43, 3, 2),
  ('59f0878c-4dd5-47e5-83e7-0d29034a1407', 50, 99, 0.99, 5, 3),
  ('59f0878c-4dd5-47e5-83e7-0d29034a1407', 100, 249, 0.70, 7, 4),
  ('59f0878c-4dd5-47e5-83e7-0d29034a1407', 250, 499, 0.55, 10, 5),
  ('59f0878c-4dd5-47e5-83e7-0d29034a1407', 500, 999, 0.44, 12, 6),
  ('59f0878c-4dd5-47e5-83e7-0d29034a1407', 1000, NULL, 0.35, 15, 7),
  ('31af35ce-07df-40ae-a22b-13859f2de97a', 1, 24, 2.20, 2, 1),
  ('31af35ce-07df-40ae-a22b-13859f2de97a', 25, 49, 1.43, 3, 2),
  ('31af35ce-07df-40ae-a22b-13859f2de97a', 50, 99, 0.99, 5, 3),
  ('31af35ce-07df-40ae-a22b-13859f2de97a', 100, 249, 0.70, 7, 4),
  ('31af35ce-07df-40ae-a22b-13859f2de97a', 250, 499, 0.55, 10, 5),
  ('31af35ce-07df-40ae-a22b-13859f2de97a', 500, 999, 0.44, 12, 6),
  ('31af35ce-07df-40ae-a22b-13859f2de97a', 1000, NULL, 0.35, 15, 7);

COMMIT;
