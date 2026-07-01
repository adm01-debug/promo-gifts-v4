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
_Atualizado em 2026-07-01T11:02:38.982Z · 5 rascunho(s)._

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

## Promoção automatizada — `npm run draft:promote -- <file> --apply --pr`

O comando `draft:promote --pr` executa o fluxo completo:
copia o SQL para `supabase/migrations/<timestamp>_<slug>.sql`, remove o
rascunho, cria a branch `promote/<slug>-<timestamp>`, commita, faz push,
abre o PR via `gh pr create` **já rotulado com `db-migration`** e anexa o
resultado de `supabase db diff --linked --schema public` como comentário
inicial (com fallback quando o CLI falhar).

### Flags do PR

| Flag | Valor | Descrição |
| --- | --- | --- |
| `--pr` | — | Ativa a automação (só faz sentido junto com `--apply`). |
| `--base=<branch>` | `main` (default) | Branch alvo do PR. |
| `--draft-pr` | — | Abre o PR como **draft** no GitHub. |
| `--labels=<a,b,c>` | csv | Labels **extras** — a label `db-migration` é sempre adicionada. |
| `--reviewers=<a,b>` | csv/espaço | Handles (`user`, `org/time`, `bot[bot]`). Validado antes de rodar `gh`. |
| `--assignees=<a,b>` | csv/espaço | Idem `--reviewers`. Não use `@` no início. |
| `--skip-db-diff` | — | Não coleta nem anexa o `supabase db diff --linked`. |
| `--db-diff-max-bytes=<n>` | `60000` (default) | Limite de bytes do comentário do diff (evita corte silencioso em migrações grandes). |

### Exemplos

```bash
# Fluxo padrão: label db-migration + diff no comentário
npm run draft:promote -- 2026-06-27_quotes_status_allow_cancelled.sql --apply --pr

# Com revisores, assignee e labels extras
npm run draft:promote -- 2026-06-27_quotes_status_allow_cancelled.sql --apply --pr \
  --reviewers='alice,bob,org/time-db' \
  --assignees='carla' \
  --labels='needs-dba,priority:p1'

# Draft PR + diff maior que 60 KB
npm run draft:promote -- 2026-06-19_kit_dimensions_backfill.sql --apply --pr \
  --draft-pr --db-diff-max-bytes=250000

# Sem coletar o diff (ex.: CLI supabase indisponível localmente)
npm run draft:promote -- 2026-06-27_quotes_status_allow_cancelled.sql --apply --pr --skip-db-diff
```

### Comportamento em falha

- **`supabase db diff --linked` falha** → o PR é criado mesmo assim, e o
  comentário inicial contém as primeiras 20 linhas do erro + o comando
  `gh pr comment <url> --body-file /tmp/db-diff.md` para reanexar
  localmente. Causas comuns: `supabase link` não feito, credenciais
  expiradas ou CLI ausente.
- **Reviewers/assignees inválidos** → o script aborta **antes** do
  `git commit`, com mensagem indicando qual handle está mal formado.
  Aceita `user`, `org/team` e `nome[bot]`. Não use `@` como prefixo.
- **`gh pr comment` falha após o PR aberto** → o PR permanece criado; o
  script imprime a linha exata para reanexar o comentário manualmente.

