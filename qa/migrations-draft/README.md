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
_Atualizado em 2026-07-16T18:28:04.277Z · 8 rascunho(s)._

| Arquivo | Objetivo | Alvo | Risco | Validação |
| --- | --- | --- | --- | --- |
| `2026-06-18_security_definer_acl.sql` | 10 funções SECURITY DEFINER no schema public estão com EXECUTE concedido a PUBLIC/anon/authenticated | canônico | zero | — |
| `2026-06-19_kit_dimensions_backfill.sql` | backfill de dimensões dos 301 kits incompletos Alvo: SSOT externo (doufsxqlfjyuvxuezpln) Autor: PromoGifts · 2026-06-19 ==================== | canônico | — | — |
| `2026-06-19_reposicao_variants_summary.sql` | Cria RPC `fn_get_reposicao_variants_summary(p_product_ids | canônico | — | 📎 `.VALIDATION.md` |
| `2026-06-20_revoke_secdef_from_authenticated.sql` | SECURITY DEFINER ACL — Revogação de authenticated/anon/public | canônico | zero | — |
| `2026-06-27_quotes_status_allow_cancelled.sql` | liberar `cancelled` no CHECK `valid_quote_status` de `public | canônico | — | — |
| `2026-07-06_crm_callback_events.sql` | tabela de auditoria/idempotência para callbacks do CRM (Promo Champions V2) recebidos pela edge function `receive-crm-callback` | canônico | — | — |
| `2026-07-13_secdef_revoke_webhook_locks.sql` | Draft (NÃO executar sem aprovação do PO — CLAUDE.md #Comportamento obrigatório) | ? | — | — |
| `2026-07-13_secdef_revoke_webhook_locks_ROLLBACK.sql` | cria Antes | ? | — | — |
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
| `--db-diff-cache` | — | Cacheia o resultado de `supabase db diff --linked` em `$TMPDIR/promo-gifts/supabase-db-diff-cache/` (opt-in). Útil ao promover vários drafts em sequência. |
| `--db-diff-cache-ttl=<s>` | `900` (default) | TTL do cache em segundos. Chave inclui as migrations existentes, então aplicar uma nova invalida sozinho. |
| `--no-db-diff-cache` | — | Ignora o cache mesmo com `--db-diff-cache` (força regeneração). |

### Exemplos

```bash
# 1) Fluxo padrão: label db-migration + diff no comentário
npm run draft:promote -- 2026-06-27_quotes_status_allow_cancelled.sql --apply --pr

# 2) Com revisores (user + org/team), assignee e labels extras
npm run draft:promote -- 2026-06-27_quotes_status_allow_cancelled.sql --apply --pr \
  --reviewers='alice,bob,org/time-db' \
  --assignees='carla' \
  --labels='needs-dba,priority:p1'

# 3) Revisor bot + separadores mistos (vírgula E espaço são aceitos)
npm run draft:promote -- 2026-06-18_security_definer_acl.sql --apply --pr \
  --reviewers='alice bob renovate[bot]'

# 4) Draft PR + diff grande (aumenta o limite de bytes do comentário)
npm run draft:promote -- 2026-06-19_kit_dimensions_backfill.sql --apply --pr \
  --draft-pr --db-diff-max-bytes=250000

# 5) Sem coletar o diff (ex.: CLI supabase indisponível localmente)
npm run draft:promote -- 2026-06-27_quotes_status_allow_cancelled.sql --apply --pr --skip-db-diff

# 6) Cache ativo: promova vários drafts em sequência sem chamar
#    `supabase db diff` toda vez (default TTL 15 min).
npm run draft:promote -- 2026-06-18_security_definer_acl.sql       --apply --pr --db-diff-cache
npm run draft:promote -- 2026-06-19_reposicao_variants_summary.sql --apply --pr --db-diff-cache
npm run draft:promote -- 2026-06-20_revoke_secdef_from_authenticated.sql --apply --pr --db-diff-cache

# 7) Cache com TTL customizado (5 min) — útil se o schema muda com frequência
npm run draft:promote -- 2026-06-27_quotes_status_allow_cancelled.sql --apply --pr \
  --db-diff-cache --db-diff-cache-ttl=300

# 8) Forçar regeneração ignorando cache (útil quando outro dev aplicou algo)
npm run draft:promote -- 2026-06-27_quotes_status_allow_cancelled.sql --apply --pr \
  --db-diff-cache --no-db-diff-cache
```

### Comportamento em falha

- **`supabase db diff --linked` falha** → o PR é criado mesmo assim, e o
  comentário inicial contém as primeiras 20 linhas do erro + o comando
  de retry pronto para copiar/colar:

  ```bash
  supabase db diff --linked --schema public > /tmp/db-diff.md
  gh pr comment <url-do-pr> --body-file /tmp/db-diff.md
  ```

  Causas comuns: `supabase link` não feito, credenciais expiradas ou CLI
  ausente. O log do script imprime a mesma linha em `dim` para você
  reexecutar sem precisar abrir o PR.

- **Reviewers/assignees inválidos** → o script aborta **antes** do
  `git commit`, com mensagem indicando qual handle está mal formado.
  Aceita `user`, `org/team` e `nome[bot]`. Não use `@` como prefixo.
  Duplicatas na mesma flag também são bloqueadas.

- **`--db-diff-max-bytes` não numérico** → aborta antes do commit.

- **`gh pr comment` falha após o PR aberto** → o PR permanece criado; o
  script imprime a linha exata para reanexar o comentário manualmente.

- **Cache stale ou corrompido** → o script apenas ignora e regenera; o
  arquivo é sobrescrito atomicamente ao final. Para inspecionar/limpar:

  ```bash
  ls "$TMPDIR/promo-gifts/supabase-db-diff-cache/"
  rm -rf "$TMPDIR/promo-gifts/supabase-db-diff-cache/"
  ```


