# Migrations do Supabase — SSOT de Schema

## Diretório canônico

**`supabase/migrations/`** é o único diretório que contém as migrations
versionadas do projeto. É o path padrão do Supabase CLI (não há override
`[db.migrations_path]` em `supabase/config.toml`), então:

- `supabase migration up` / `supabase db push` lê **apenas** este diretório.
- O CI (`.github/workflows/db-schema-drift-check.yml`) roda
  `supabase db diff --linked --schema public` contra este mesmo diretório.
- Qualquer objeto DDL que exista no banco vivo e **não** esteja aqui é
  considerado **drift** e falha o gate.

### Convenção de nomeação

`YYYYMMDDHHMMSS_descricao.sql` (timestamp UTC gerado por
`supabase migration new <slug>`). Ordem alfabética = ordem de execução.

### O que **não** é migration canônica

| Path                          | Papel                                                            |
| ----------------------------- | ---------------------------------------------------------------- |
| `qa/migrations-draft/`        | Rascunhos revisáveis, **não aplicados**. Ver README local.       |
| `supabase/migrations-snapshot/` | Snapshots consolidados read-only (auditoria). Gerado por script. |
| `medallion/**/*.sql`          | Documentação de arquitetura Bronze/Silver/Gold, não executável.  |
| `scripts/faxina-*.sql`        | Utilitários pontuais de rollback/limpeza, aplicação manual.      |

---

## Status atual (2026-07-01)

- **1.564 arquivos** em `supabase/migrations/`
- Alvo de deploy: projeto canônico **`doufsxqlfjyuvxuezpln`** (Gold/Medallion)
- Snapshot vivo: [`supabase/migrations-snapshot/`](migrations-snapshot/)
  (regenerar com `npm run schema:snapshot`)

## Histórico da reconciliação (mai/2026)

Estado inicial: DB = repo = 760 versões (23/mai/2026).

- 37 arquivos órfãos adicionados ao repo (versões aplicadas no DB sem arquivo)
- 1 duplicata de versão `20260515120000` removida
- 40 marker rows inseridos em `schema_migrations` para versões repo-only já aplicadas
- `20260522001000` (add_contract_version) aplicada via workflow

Ver commit `308b82e0` para detalhes.

## Regras operacionais

1. **Nunca** editar arquivos existentes em `supabase/migrations/` — sempre
   criar uma nova migration acima na linha do tempo.
2. **Nunca** apontar migrations para `pqpdolkaeqlyzpdpbizo` (Lovable Cloud
   interno, sem dados reais). Alvo é sempre `doufsxqlfjyuvxuezpln`.
3. Rascunhos em `qa/migrations-draft/` só viram migration canônica **após**
   aprovação do PO, sendo copiados para `supabase/migrations/` com
   timestamp e removidos do draft.
