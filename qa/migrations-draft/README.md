# qa/migrations-draft — Guia de uso

Este diretório guarda **rascunhos de migração** propostos pela auditoria/PO,
**ainda não aplicados no banco** e **não versionados** como migração canônica.
Ele NÃO substitui `supabase/migrations/` — é uma antessala revisável.

## Relação com `supabase/migrations/`

| Aspecto              | `qa/migrations-draft/`                            | `supabase/migrations/`                                  |
| -------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| Papel                | Rascunho revisável (proposta)                     | SSOT das migrações versionadas                          |
| Nomeação             | `YYYY-MM-DD_descricao.sql`                        | `YYYYMMDDHHMMSS_descricao.sql` (timestamp Supabase CLI) |
| Aplicado no banco?   | Não (até PO aprovar)                              | Sim — via `supabase db push` / Studio / CI              |
| Rastreado pelo CLI?  | Não (fora do path do Supabase)                    | Sim — em `supabase_migrations.schema_migrations`        |
| Alvo                 | **Sempre** `doufsxqlfjyuvxuezpln` (Gold canônico) | `doufsxqlfjyuvxuezpln`                                  |
| Auto-executado?      | Nunca                                             | Sim, na esteira de deploy                               |
| Pode conter `DO $$`? | Sim (backfills, checks)                           | Preferir SQL declarativo idempotente                    |

## Fluxo canônico (draft → migration)

```text
1. Auditoria/PO cria rascunho em qa/migrations-draft/YYYY-MM-DD_slug.sql
   ├── cabeçalho explicando OBJETIVO, RISCO, VALIDAÇÃO
   └── SQL em transação (BEGIN; ... COMMIT;) sempre que possível

2. PO revisa e aprova o rascunho (PR review)

3. Renomear/copiar para supabase/migrations/<timestamp>_<slug>.sql
   timestamp no formato UTC: `date -u +%Y%m%d%H%M%S`

4. Rodar localmente:  supabase db diff --linked --schema public
   → esperado: nenhum drift após aplicar a nova migration

5. Commit + PR → CI (db-schema-drift-check) valida drift = 0

6. Após merge, deletar o rascunho de qa/migrations-draft/ (fonte única = migrations/)
```

## Rascunhos vigentes

<!-- BEGIN:DRAFT-INDEX (gerado por scripts/list-migration-drafts.mjs) -->
_Atualizado em 2026-07-01T10:53:52.205Z · 5 rascunho(s)._

| Arquivo | Objetivo | Alvo | Risco | Validação |
| --- | --- | --- | --- | --- |
| `2026-06-18_security_definer_acl.sql` | 10 funções SECURITY DEFINER no schema public estão com EXECUTE concedido a PUBLIC/anon/authenticated | canônico | zero | — |
| `2026-06-19_kit_dimensions_backfill.sql` | backfill de dimensões dos 301 kits incompletos Alvo: SSOT externo (doufsxqlfjyuvxuezpln) Autor: PromoGifts · 2026-06-19 ==================== | canônico | — | — |
| `2026-06-19_reposicao_variants_summary.sql` | Cria RPC `fn_get_reposicao_variants_summary(p_product_ids | canônico | — | 📎 `.VALIDATION.md` |
| `2026-06-20_revoke_secdef_from_authenticated.sql` | SECURITY DEFINER ACL — Revogação de authenticated/anon/public | canônico | zero | — |
| `2026-06-27_quotes_status_allow_cancelled.sql` | liberar `cancelled` no CHECK `valid_quote_status` de `public | canônico | — | — |
<!-- END:DRAFT-INDEX -->

## Regras

- **Nunca aplicar** um arquivo daqui em produção sem antes promovê-lo a
  `supabase/migrations/`. O CI de drift acusa qualquer objeto criado só via draft.
- **Alvo é sempre o projeto canônico** `doufsxqlfjyuvxuezpln`. NUNCA
  `pqpdolkaeqlyzpdpbizo` (Lovable Cloud interno, sem dados reais).
- **Rascunho aprovado e promovido é apagado deste diretório.** Se ficar aqui
  depois de aplicado, gera confusão (dupla verdade) — o script de listagem
  abaixo é a fonte da lista viva.
- **Arquivos `.VALIDATION.md`** acompanham `.sql` de mesmo prefixo e contêm
  o roteiro de validação pós-aplicação. Devem ser lidos antes de promover.

## Regeneração automática da tabela acima

```bash
node scripts/list-migration-drafts.mjs
```

O script lê `qa/migrations-draft/*.sql`, extrai o cabeçalho de cada um e
reescreve o bloco `DRAFT-INDEX` deste README.
