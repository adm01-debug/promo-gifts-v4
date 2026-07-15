-- ============================================================================
-- Draft Migration — Trigger fn_magazine_public_token
-- Alvo: BD canônico Gold `doufsxqlfjyuvxuezpln` (Supabase Gestão de Produtos)
-- NÃO rodar no Lovable Cloud interno (pqpdolkaeqlyzpdpbizo) — proibido pela
-- REGRA #1 do CLAUDE.md. Executar via painel Supabase → SQL Editor no Gold.
--
-- Objetivo: gerar `public_token` automaticamente quando uma revista muda
-- para `status = 'published'`, removendo a necessidade do fallback
-- client-side em src/services/magazineService.ts (publish()).
--
-- Contrato:
--   • BEFORE INSERT OR UPDATE OF status ON public.magazines
--   • Se NEW.status = 'published' e NEW.public_token IS NULL → gera token
--     de 32 hex chars via gen_random_bytes(16); retentar até 5x em colisão.
--   • Se NEW.status <> 'published' → mantém public_token intacto
--     (permite despublicar/republicar sem trocar o link).
--   • SECURITY DEFINER + SET search_path = public
--   • REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated
--     (política mem://security/security-definer-acl-policy — trigger só é
--     invocada pelo BD, não pelo cliente).
--
-- Idempotente: pode rodar N vezes sem efeitos colaterais.
-- ============================================================================

-- 0) Pré-requisitos ----------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) Função ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_magazine_public_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  candidate TEXT;
  attempts  INTEGER := 0;
BEGIN
  -- Só gera token na transição para 'published'. Fora disso, preserva o
  -- valor atual — inclusive quando a revista volta para 'draft' e depois
  -- é republicada (link estável entre publicações).
  IF NEW.status IS DISTINCT FROM 'published' THEN
    RETURN NEW;
  END IF;

  IF NEW.public_token IS NOT NULL AND length(NEW.public_token) > 0 THEN
    RETURN NEW;
  END IF;

  LOOP
    attempts := attempts + 1;
    candidate := encode(gen_random_bytes(16), 'hex');

    IF NOT EXISTS (
      SELECT 1
      FROM public.magazines
      WHERE public_token = candidate
        AND id IS DISTINCT FROM NEW.id
    ) THEN
      NEW.public_token := candidate;
      EXIT;
    END IF;

    IF attempts >= 5 THEN
      RAISE EXCEPTION
        'fn_magazine_public_token: falha ao gerar token único após % tentativas',
        attempts;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$fn$;

-- ACL: bloqueia execução direta por qualquer role cliente. A trigger é
-- disparada pelo BD, portanto EXECUTE em PUBLIC/anon/authenticated é
-- desnecessário e viola a política SECURITY DEFINER ACL do projeto.
REVOKE EXECUTE ON FUNCTION public.fn_magazine_public_token() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_magazine_public_token() FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_magazine_public_token() FROM authenticated;

-- 2) Trigger -----------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_magazine_public_token ON public.magazines;

CREATE TRIGGER trg_magazine_public_token
BEFORE INSERT OR UPDATE OF status ON public.magazines
FOR EACH ROW
EXECUTE FUNCTION public.fn_magazine_public_token();

-- 3) Backfill idempotente ----------------------------------------------------
-- Popula tokens em revistas já publicadas que ficaram sem link porque a
-- trigger nunca existiu até agora. Não sobrescreve tokens já emitidos.
UPDATE public.magazines
SET public_token = encode(gen_random_bytes(16), 'hex')
WHERE status = 'published'
  AND (public_token IS NULL OR length(public_token) = 0);

-- 4) Verificação (falha alto se algo ficou pendente) -------------------------
DO $verify$
DECLARE
  missing_count INTEGER;
  trg_count     INTEGER;
BEGIN
  SELECT count(*) INTO missing_count
  FROM public.magazines
  WHERE status = 'published'
    AND (public_token IS NULL OR length(public_token) = 0);

  IF missing_count > 0 THEN
    RAISE EXCEPTION
      'fn_magazine_public_token: % revistas publicadas ainda estão sem token após backfill',
      missing_count;
  END IF;

  SELECT count(*) INTO trg_count
  FROM pg_trigger
  WHERE tgrelid = 'public.magazines'::regclass
    AND tgname = 'trg_magazine_public_token'
    AND NOT tgisinternal;

  IF trg_count <> 1 THEN
    RAISE EXCEPTION
      'fn_magazine_public_token: trigger trg_magazine_public_token não foi criada (encontradas %)',
      trg_count;
  END IF;

  RAISE NOTICE 'fn_magazine_public_token: OK — trigger ativa, 0 revistas publicadas sem token.';
END;
$verify$;

-- ============================================================================
-- Rollback (executar manualmente se necessário):
--   DROP TRIGGER IF EXISTS trg_magazine_public_token ON public.magazines;
--   DROP FUNCTION IF EXISTS public.fn_magazine_public_token();
-- Tokens já emitidos permanecem na coluna public_token — nenhum link quebra.
-- ============================================================================
