# docs/migrations — histórico

## 20260625120000_align_quote_status_check — RESOLVIDO (não aplicar)

**Status:** RESOLVIDO em 2026-06-25. Nenhuma migration necessária.
**Banco verificado:** `doufsxqlfjyuvxuezpln` (Supabase Gold do PO — fonte da verdade).

### Resumo

Foi proposta uma migration `align_quote_status_check.{sql,down.sql}` sob a
premissa de que o CHECK `valid_quote_status` em `public.quotes` aceitava apenas
7 status, faltando `pending_approval`, `viewed` e `cancelled`.

**Essa premissa era FALSA.** Verificação direta via `pg_constraint` em
2026-06-25 mostrou que o CHECK já aceita EXATAMENTE os 10 status do FE
(`src/types/quote.ts -> QUOTE_STATUSES`):

    draft, pending, pending_approval, sent, viewed,
    approved, converted, rejected, expired, cancelled

Prova reproduzível:

    SELECT pg_get_constraintdef(oid)
    FROM pg_constraint
    WHERE conrelid = 'public.quotes'::regclass
      AND conname  = 'valid_quote_status';

FE e DB estão ALINHADOS. O fluxo de aprovação de desconto persiste
`pending_approval` em produção sem erro, confirmando o alinhamento na prática.

### Por que os arquivos foram removidos

- O `*.sql` (UP) apenas recriava a constraint IDÊNTICA -> no-op desnecessário.
- O `*.down.sql` (DOWN) era **LOSSY e perigoso**: coagia
  `pending_approval`/`viewed` -> `pending` e `cancelled` -> `rejected` antes de
  reduzir a constraint para 7. Executá-lo destruiria dados reais (inclusive os
  orçamentos em aprovação de desconto). Mantê-lo no repositório era um risco
  latente de perda de dados.

`src/services/quoteService.ts` mantém um tratamento defensivo de SQLSTATE 23514
na `valid_quote_status` como defesa-em-profundidade (para flagrar um futuro 11º
status adicionado no FE sem migration), mas hoje esse ramo não dispara.
