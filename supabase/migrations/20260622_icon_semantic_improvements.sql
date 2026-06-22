-- APLICADO: 2026-06-22 (sessões de auditoria)
-- Autor: Claude AI (dev senior audit)
-- Descrição: Migração completa do sistema de ícones de categorias
--             de emojis para nomes PascalCase do Lucide React.
--             Inclui 48+ correções semânticas em 3 fases.

-- =============================================================
-- FASE 1: MIGRAÇÃO EMOJI -> LUCIDE (412 registros)
-- Commit: f425e552
-- =============================================================
-- Todos os 412 registros em category_icons foram migrados
-- de emojis/texto legado para nomes PascalCase Lucide.
-- Aplicação inicial via UPDATE em lote (ver sessão anterior).

-- =============================================================
-- FASE 2: 17 NOVOS ÍCONES + 32 CORREÇÕES SEMÂNTICAS
-- Commit: 0519c137 (build FALHOU) / f49d0360 (bugfix)
-- =============================================================

-- Novos ícones adicionados ao ICON_MAP:
-- AlarmClock, Calculator, Car, CircleDot, Clock, Cpu,
-- Glasses, Image, Lamp, Laptop, Lock, Luggage, Pill, Pin,
-- Sprout, Thermometer, Umbrella

-- 32 correções semânticas - Fase 2:
UPDATE category_icons SET icon = CASE category_name
  WHEN 'Lanternas'              THEN 'Flashlight'
  WHEN 'Luminárias'             THEN 'Lamp'
  WHEN 'Calculadoras'           THEN 'Calculator'
  WHEN 'Porta Comprimido'       THEN 'Pill'
  WHEN 'Malas'                  THEN 'Luggage'
  WHEN 'Óculos de Sol'           THEN 'Glasses'
  WHEN 'Futebol'                THEN 'CircleDot'
  WHEN 'Vôlei'                  THEN 'CircleDot'
  WHEN 'Veículos'               THEN 'Car'
  WHEN 'Mochila Anti Furto'     THEN 'Lock'
  WHEN 'Guarda Chuva'           THEN 'Umbrella'
  WHEN 'Guarda Sol'             THEN 'Umbrella'
  WHEN 'Garrafa Térmica'        THEN 'Thermometer'
  WHEN 'Garrafas | Isotérmica'  THEN 'Thermometer'
  WHEN 'Bolsa Térmica'          THEN 'Thermometer'
  WHEN 'Caixa | Térmica'        THEN 'Thermometer'
  WHEN 'Coolers'                THEN 'Thermometer'
  WHEN 'Agro'                   THEN 'Sprout'
  WHEN 'Kit Cultivo'            THEN 'Sprout'
  WHEN 'Lápis Semente'          THEN 'Sprout'
  WHEN 'Tecnologia | Eletrônicos' THEN 'Cpu'
  WHEN 'Mochila Notebook'       THEN 'Laptop'
  WHEN 'Porta | Retrato'        THEN 'Image'
  WHEN 'Relógios | Mesa'        THEN 'AlarmClock'
  WHEN 'Relógio | Parede | Plástico' THEN 'Clock'
  WHEN 'Relógios | Parede'      THEN 'Clock'
  WHEN 'Viseiras'               THEN 'Sun'
  WHEN 'Acessórios'             THEN 'Tag'
  WHEN 'Chaveiros | Premium'    THEN 'Crown'
  WHEN 'Motivacional | Premiações' THEN 'Trophy'
  WHEN 'Mochila Executiva'      THEN 'Backpack'
  WHEN 'Manta | Mini Cobertor'  THEN 'Layers'
  ELSE icon
END
WHERE category_name IN (
  'Lanternas','Luminárias','Calculadoras','Porta Comprimido','Malas',
  'Óculos de Sol','Futebol','Vôlei','Veículos','Mochila Anti Furto',
  'Guarda Chuva','Guarda Sol','Garrafa Térmica','Garrafas | Isotérmica',
  'Bolsa Térmica','Caixa | Térmica','Coolers','Agro','Kit Cultivo',
  'Lápis Semente','Tecnologia | Eletrônicos','Mochila Notebook',
  'Porta | Retrato','Relógios | Mesa','Relógio | Parede | Plástico',
  'Relógios | Parede','Viseiras','Acessórios','Chaveiros | Premium',
  'Motivacional | Premiações','Mochila Executiva','Manta | Mini Cobertor'
);

-- =============================================================
-- FASE 3: CORREÇÕES ADICIONAIS DETECTADAS EM AUDITORIA PROFUNDA
-- Commit: [sessão 2026-06-22]
-- =============================================================

-- 16 correções adicionais - Fase 3:
UPDATE category_icons SET icon = CASE category_name

  -- PET (3 categorias pet com ícone errado)
  WHEN 'Bebedouro | Pet'         THEN 'PawPrint'
  WHEN 'Comedouros | Pet'        THEN 'PawPrint'
  WHEN 'Kit Higiene | Pet'       THEN 'PawPrint'

  -- ÁUDIO (caixa de som ≠ fone)
  WHEN 'Caixa de Som'            THEN 'Speaker'

  -- TECLADO (apoio de teclado ≠ mouse)
  WHEN 'Apoio Teclado'           THEN 'Keyboard'

  -- MOCHILA (mochila esportiva é backpack)
  WHEN 'Mochila Esportiva'       THEN 'Backpack'

  -- TÉRMICOS (sacola e térmicos costáveis devem ser Thermometer)
  WHEN 'Sacola Térmica'          THEN 'Thermometer'
  WHEN 'Térmicos | Costúraveis'  THEN 'Thermometer'

  -- LAZER (é esporte, não água)
  WHEN 'Lazer'                   THEN 'Dumbbell'

  -- ECO MATERIAL (bambu/cortiça não é caderno)
  WHEN 'Bambu | Cortiça'         THEN 'TreePine'

  -- MALETA DE MAQUIAGEM (≠ pasta executiva)
  WHEN 'Maleta | Maquiagem'      THEN 'Sparkles'

  -- TOALHAS (produto em camadas = Layers)
  WHEN 'Kit Toalha'              THEN 'Layers'
  WHEN 'Roupão | Atoalhado'      THEN 'Layers'
  WHEN 'Roupão | Microfibra'     THEN 'Layers'
  WHEN 'Toalha | Banho'          THEN 'Layers'
  WHEN 'Toalha | Rosto'          THEN 'Layers'
  WHEN 'Toalhas | Praia'         THEN 'Layers'

  ELSE icon
END
WHERE category_name IN (
  'Bebedouro | Pet','Comedouros | Pet','Kit Higiene | Pet',
  'Caixa de Som','Apoio Teclado','Mochila Esportiva',
  'Sacola Térmica','Térmicos | Costúraveis','Lazer',
  'Bambu | Cortiça','Maleta | Maquiagem',
  'Kit Toalha','Roupão | Atoalhado','Roupão | Microfibra',
  'Toalha | Banho','Toalha | Rosto','Toalhas | Praia'
);

-- Sync categories.icon após cada fase
UPDATE categories c
SET icon = ci.icon
FROM category_icons ci
WHERE lower(trim(ci.category_name)) = lower(trim(c.name))
  AND ci.icon IS NOT NULL
  AND ci.icon != COALESCE(c.icon, '');

-- =============================================================
-- VALIDAÇÃO FINAL ESPERADA
-- =============================================================
-- SELECT COUNT(*) FROM category_icons;                              -- 412
-- SELECT COUNT(*) FROM category_icons WHERE icon !~ '^[A-Z][a-zA-Z0-9]+$'; -- 0
-- SELECT COUNT(*) FROM category_icons WHERE icon IS NULL;           -- 0
-- SELECT COUNT(*) FROM fn_run_smoke_tests() WHERE result NOT LIKE '%PASS%'; -- 0
