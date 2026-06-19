-- Fix: fn_set_product_as_new — adiciona tratamento de UPDATE para is_new false→true
--
-- Problema (auditoria Novidades 2026-06-19):
-- O trigger trg_set_product_as_new disparava apenas em INSERT. Quando um produto
-- era re-ingerido ou atualizado manualmente com is_new = true (ex: via webhook
-- product-webhook, que só escreve is_new sem tocar as datas), o trigger NÃO
-- preenchia novelty_detected_at / novelty_expires_at — os campos ficavam NULL,
-- fazendo o produto desaparecer do predicado `novelty_expires_at > now()`.
--
-- Correção:
-- 1. Altera o trigger para disparar em INSERT e UPDATE
-- 2. Na transição false→true (UPDATE) com campos nulos ou já expirados, preenche
--    novelty_detected_at = NOW() e novelty_expires_at = NOW() + 30 dias
-- 3. Preserva valores existentes quando a expiração ainda é futura (idempotente)

-- ─── Passo 1: substituir a função ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_product_as_new()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Só age quando is_new é TRUE no registro final
  IF NEW.is_new IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- INSERT: preenche sempre (produto novo)
  IF TG_OP = 'INSERT' THEN
    IF NEW.novelty_detected_at IS NULL THEN
      NEW.novelty_detected_at := NOW();
    END IF;
    IF NEW.novelty_expires_at IS NULL THEN
      NEW.novelty_expires_at := NEW.novelty_detected_at + INTERVAL '30 days';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: transição false→true OU reativação de flag já expirado
  IF TG_OP = 'UPDATE' THEN
    DECLARE
      was_new BOOLEAN := COALESCE(OLD.is_new, FALSE);
      already_active BOOLEAN := (
        NEW.novelty_expires_at IS NOT NULL AND
        NEW.novelty_expires_at > NOW()
      );
    BEGIN
      -- Se is_new estava FALSE e virou TRUE (ou expiração nula/expirada): reinicia
      IF (was_new = FALSE OR NOT already_active) THEN
        NEW.novelty_detected_at := NOW();
        NEW.novelty_expires_at  := NOW() + INTERVAL '30 days';
      END IF;
      -- Caso contrário (is_new=true antes E expiração ainda futura): não toca
      RETURN NEW;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── Passo 2: recriar o trigger incluindo UPDATE ─────────────────────────────
DROP TRIGGER IF EXISTS trg_set_product_as_new ON products;

CREATE TRIGGER trg_set_product_as_new
  BEFORE INSERT OR UPDATE OF is_new
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION fn_set_product_as_new();

COMMENT ON FUNCTION fn_set_product_as_new() IS
  'Preenche novelty_detected_at e novelty_expires_at quando is_new=true é definido/reativado. '
  'Dispara em INSERT e UPDATE(is_new). '
  'Idempotente: preserva expiração futura existente.';
