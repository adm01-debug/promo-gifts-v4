-- =====================================================================
-- DATA MIGRATION: Migrar dados de contatos e PIX de campos legados
-- para as novas colunas/tabelas criadas pela migration de schema.
--
-- PRÉ-REQUISITOS: Executar 20260526_fix_cadastro_produtos_fornecedores.sql primeiro
-- BANCO: doufsxqlfjyuvxuezpln (Produtos)
-- Data: 2026-05-26
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- PARTE 1: Migrar contacts JSON → tabela supplier_contacts
-- O campo suppliers.contacts continha JSON no formato:
-- '[{"id":"uuid","name":"João","role":"Compras","email":"...","phone":"..."}]'
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  rec RECORD;
  contacts_arr JSONB;
  contact_item JSONB;
  i INTEGER;
  is_primary BOOLEAN;
BEGIN
  FOR rec IN
    SELECT id, contacts, contact_name, contact_person, email, phone
    FROM suppliers
    WHERE contacts IS NOT NULL AND contacts != '' AND contacts != '[]'
  LOOP
    BEGIN
      contacts_arr := rec.contacts::JSONB;

      IF jsonb_typeof(contacts_arr) = 'array' AND jsonb_array_length(contacts_arr) > 0 THEN
        FOR i IN 0..jsonb_array_length(contacts_arr)-1 LOOP
          contact_item := contacts_arr->i;
          is_primary := (i = 0);

          -- Skip if already migrated
          IF NOT EXISTS (
            SELECT 1 FROM supplier_contacts
            WHERE supplier_id = rec.id
              AND name = COALESCE(contact_item->>'name', '')
              AND COALESCE(email, '') = COALESCE(contact_item->>'email', '')
          ) THEN
            INSERT INTO supplier_contacts (
              supplier_id, name, role, email, phone,
              is_primary, signature, nickname
            ) VALUES (
              rec.id,
              COALESCE(contact_item->>'name', ''),
              contact_item->>'role',
              NULLIF(contact_item->>'email', ''),
              NULLIF(contact_item->>'phone', ''),
              is_primary,
              NULLIF(contact_item->>'signature', ''),
              NULLIF(contact_item->>'nickname', '')
            );
          END IF;
        END LOOP;
      ELSE
        -- Legacy: single contact from dedicated columns
        IF rec.contact_name IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM supplier_contacts WHERE supplier_id = rec.id
        ) THEN
          INSERT INTO supplier_contacts (
            supplier_id, name, role, email, phone, is_primary
          ) VALUES (
            rec.id,
            rec.contact_name,
            rec.contact_person,
            NULLIF(rec.email, ''),
            NULLIF(rec.phone, ''),
            TRUE
          );
        END IF;
      END IF;

    EXCEPTION WHEN others THEN
      RAISE WARNING 'Falha ao migrar contatos do fornecedor %: %', rec.id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '[Migration] Contatos migrados para supplier_contacts.';
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- PARTE 2: Migrar PIX e formas de pagamento de notes → colunas dedicadas
-- Padrão serializado (novo): [Financeiro: Forma: Boleto,PIX, PIX: CPF|11122233344|João|1, PIX Atualizado: 2026-01-01]
-- Padrão serializado (legado): [Financeiro: Forma: Boleto, PIX Tipo: CPF, PIX Número: 11122233344, PIX Favorecido: João, PIX Atualizado: 2026-01-01]
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  rec RECORD;
  notes_str TEXT;
  fin_match TEXT[];
  fin_match_legacy TEXT[];
  pix_data_str TEXT;
  pix_entries TEXT[];
  pix_entry TEXT;
  pix_parts TEXT[];
  pix_keys_arr JSONB := '[]'::JSONB;
  payment_methods_arr TEXT[] := '{}';
  chave TEXT;
  tipo TEXT;
  favorecido TEXT;
  principal BOOLEAN;
BEGIN
  FOR rec IN
    SELECT id, notes
    FROM suppliers
    WHERE notes IS NOT NULL
      AND notes LIKE '%[Financeiro:%'
      AND (pix_keys = '[]'::JSONB OR payment_methods = '{}')
  LOOP
    notes_str := rec.notes;
    pix_keys_arr := '[]'::JSONB;
    payment_methods_arr := '{}';

    -- Try new format: [Financeiro: Forma: X, PIX: tipo|chave|favorecido|principal, PIX Atualizado: date]
    fin_match := regexp_match(
      notes_str,
      '\[Financeiro: Forma: (.*?), PIX: (.*?), PIX Atualizado: .*?\]'
    );

    IF fin_match IS NOT NULL THEN
      -- Parse payment methods
      IF fin_match[1] != '-' THEN
        payment_methods_arr := string_to_array(fin_match[1], ',');
        payment_methods_arr := array(SELECT trim(unnest(payment_methods_arr)));
        payment_methods_arr := array(SELECT elem FROM unnest(payment_methods_arr) AS elem WHERE elem != '');
      END IF;

      -- Parse PIX keys
      IF fin_match[2] != '-' THEN
        pix_entries := string_to_array(fin_match[2], ';;');
        FOREACH pix_entry IN ARRAY pix_entries LOOP
          pix_parts := string_to_array(pix_entry, '|');
          IF array_length(pix_parts, 1) >= 2 THEN
            tipo := CASE WHEN pix_parts[1] = '-' THEN '' ELSE pix_parts[1] END;
            chave := pix_parts[2];
            favorecido := CASE WHEN array_length(pix_parts, 1) >= 3 AND pix_parts[3] != '-' THEN pix_parts[3] ELSE '' END;
            principal := (array_length(pix_parts, 1) >= 4 AND pix_parts[4] = '1');

            IF chave IS NOT NULL AND chave != '' THEN
              pix_keys_arr := pix_keys_arr || jsonb_build_object(
                'tipo', tipo,
                'chave', chave,
                'favorecido', favorecido,
                'principal', principal
              );
            END IF;
          END IF;
        END LOOP;
      END IF;

    ELSE
      -- Try legacy format: [Financeiro: Forma: X, PIX Tipo: Y, PIX Número: Z, PIX Favorecido: W, PIX Atualizado: date]
      fin_match_legacy := regexp_match(
        notes_str,
        '\[Financeiro: Forma: (.*?), PIX Tipo: (.*?), PIX Número: (.*?), PIX Favorecido: (.*?), PIX Atualizado: .*?\]'
      );

      IF fin_match_legacy IS NOT NULL THEN
        IF fin_match_legacy[1] != '-' THEN
          payment_methods_arr := string_to_array(fin_match_legacy[1], ',');
          payment_methods_arr := array(SELECT trim(unnest(payment_methods_arr)));
        END IF;

        chave := CASE WHEN fin_match_legacy[3] = '-' THEN '' ELSE fin_match_legacy[3] END;
        IF chave != '' THEN
          pix_keys_arr := jsonb_build_array(jsonb_build_object(
            'tipo', CASE WHEN fin_match_legacy[2] = '-' THEN '' ELSE fin_match_legacy[2] END,
            'chave', chave,
            'favorecido', CASE WHEN fin_match_legacy[4] = '-' THEN '' ELSE fin_match_legacy[4] END,
            'principal', TRUE
          ));
        END IF;
      END IF;
    END IF;

    -- Update only if we found something to migrate
    IF pix_keys_arr != '[]'::JSONB OR array_length(payment_methods_arr, 1) > 0 THEN
      UPDATE suppliers
      SET
        pix_keys = pix_keys_arr,
        payment_methods = payment_methods_arr
      WHERE id = rec.id;
    END IF;

  END LOOP;

  RAISE NOTICE '[Migration] PIX e formas de pagamento migrados de notes para pix_keys/payment_methods.';
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- PARTE 3: Migrar transportadora de notes → colunas dedicadas
-- Padrão: [Transportadora: Nome, ID: uuid_ou_traço]
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  rec RECORD;
  carrier_match TEXT[];
  carrier_name TEXT;
  carrier_id TEXT;
BEGIN
  FOR rec IN
    SELECT id, notes
    FROM suppliers
    WHERE notes LIKE '%[Transportadora:%'
      AND default_carrier_name IS NULL
  LOOP
    carrier_match := regexp_match(
      rec.notes,
      '\[Transportadora: (.*?), ID: (.*?)\]'
    );

    IF carrier_match IS NOT NULL THEN
      carrier_name := CASE WHEN carrier_match[1] = '-' THEN NULL ELSE carrier_match[1] END;
      carrier_id := CASE WHEN carrier_match[2] = '-' THEN NULL
                         WHEN carrier_match[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}' THEN carrier_match[2]
                         ELSE NULL END;

      IF carrier_name IS NOT NULL THEN
        UPDATE suppliers
        SET
          default_carrier_name = carrier_name,
          default_carrier_id = carrier_id::UUID
        WHERE id = rec.id;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE '[Migration] Transportadoras migradas de notes para default_carrier_name/id.';
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- VERIFICAÇÃO FINAL
-- ─────────────────────────────────────────────────────────────────────
SELECT
  'supplier_contacts total' AS metric,
  COUNT(*)::TEXT AS value
FROM supplier_contacts
UNION ALL
SELECT
  'suppliers com pix_keys',
  COUNT(*)::TEXT
FROM suppliers WHERE pix_keys != '[]'::JSONB
UNION ALL
SELECT
  'suppliers com payment_methods',
  COUNT(*)::TEXT
FROM suppliers WHERE array_length(payment_methods, 1) > 0
UNION ALL
SELECT
  'suppliers com transportadora',
  COUNT(*)::TEXT
FROM suppliers WHERE default_carrier_name IS NOT NULL;

-- =====================================================================
-- PRÓXIMOS PASSOS APÓS VALIDAR:
-- 1. Verificar dados acima parecem corretos
-- 2. Testar no frontend que contatos/PIX/transportadora aparecem normalmente
-- 3. Rodar nova migration para:
--    - ALTER TABLE suppliers DROP COLUMN contacts;
--    - Remover blocos [Financeiro:], [Transportadora:] do campo notes (opcional)
-- =====================================================================
