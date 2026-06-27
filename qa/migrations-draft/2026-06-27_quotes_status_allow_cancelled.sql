-- =====================================================================
-- Draft migration — DESTINO: banco canônico `doufsxqlfjyuvxuezpln`
-- (NÃO aplicar no projeto Lovable Cloud `pqpdolkaeqlyzpdpbizo`).
--
-- Objetivo: liberar `cancelled` no CHECK `valid_quote_status` de
-- `public.quotes` para fechar o 14º caso do SSOT `QUOTE_ROW_BADGE_STYLES`
-- (chip + badge "cancelled"). Funções como `notify_quote_status_change`
-- e `audit_novo_orcamento_batch2` já referenciam o valor, então este é
-- o último ponto que ainda bloqueia o INSERT/UPDATE.
--
-- Conjunto canônico FE (10): draft, pending, sent, approved, rejected,
-- expired, pending_approval, converted, viewed, cancelled. O CHECK
-- abaixo replica essa lista (espelho de `src/types/quote.ts`).
--
-- Como aplicar (PO):
--   1. Conferir produção: SELECT pg_get_constraintdef(oid)
--        FROM pg_constraint
--        WHERE conrelid='public.quotes'::regclass
--          AND conname='valid_quote_status';
--   2. Rodar este script em uma transação (`BEGIN; ... COMMIT;`).
--   3. Validar pós-aplicação:
--        - O bloco DO no fim do script deve sair sem RAISE.
--        - `bunx playwright test e2e/flows/04m-quotes-status-tooltips-a11y.spec.ts`
--          deve passar com 14 badges (zerar `unreachable`).
--   4. Após o sucesso, remover o `unseedable_reason` do alvo `cancelled`
--      em `e2e/helpers/quotes-status-seed.ts` (passo manual — não está
--      neste arquivo para evitar dessincronia se a migration falhar).
-- =====================================================================

BEGIN;

ALTER TABLE public.quotes
  DROP CONSTRAINT IF EXISTS valid_quote_status;

ALTER TABLE public.quotes
  ADD CONSTRAINT valid_quote_status CHECK (
    status IN (
      'draft',
      'pending',
      'sent',
      'viewed',
      'pending_approval',
      'approved',
      'rejected',
      'expired',
      'converted',
      'cancelled'
    )
  );

-- Verificação automática: garante que o novo CHECK aceita 'cancelled'
-- sem precisar mexer em nenhuma linha real.
DO $$
BEGIN
  PERFORM 1
  FROM pg_constraint
  WHERE conrelid = 'public.quotes'::regclass
    AND conname  = 'valid_quote_status'
    AND pg_get_constraintdef(oid) ILIKE '%cancelled%';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'valid_quote_status sem cancelled apos ALTER';
  END IF;
END $$;

COMMIT;

-- Pós-migração recomendado (em PR separado, fora desta transação):
--   * Atualizar `e2e/helpers/quotes-status-seed.ts` removendo
--     `unseedable_reason` do alvo `cancelled`.
--   * Atualizar `e2e/flows/04m-quotes-status-tooltips-a11y.spec.ts`
--     trocando a asserção `expect(unreachable).toEqual(['cancelled'])`
--     por `expect(unreachable).toEqual([])` e `reachable` por 14.
--   * Atualizar `docs/QUOTES_STATUS_TOOLTIPS.md` marcando `cancelled`
--     como inserível.
