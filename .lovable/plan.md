# Auditoria DB ↔ Frontend (coluna a coluna)

## Objetivo

Para cada **coluna** dos 3 bancos (Interno, Externo de produtos, CRM), determinar:

1. **É usada no front?** (lida/escrita por algum componente, hook, edge function consumida no front)
2. Se não → **coluna órfã** (candidata a deprecar ou expor)
3. O inverso: **estado/UI no front que não é persistido** em nenhum dos bancos

Cobertura limitada a **tabelas com linhas > 0** (ignora `*_old`, partições `_y2026m*`, tabelas vazias).

---

## Entregáveis

1. **`scripts/audit-db-frontend-coverage.mjs`** — script Node reutilizável que:
   - Conecta no BD interno via `psql` (vars `PG*`) e introspecciona schema completo.
   - Para BD externo e CRM: lê schema a partir de fontes já presentes no repo (`src/types/external-db*.ts`, código das edges `external-db-bridge` / `crm-db-bridge`, e — se possível — chama o bridge com uma operação `introspect` (adicionada se não existir, read-only).
   - Filtra tabelas vazias (`SELECT n_live_tup FROM pg_stat_user_tables`).
   - Roda `rg` sobre `src/`, `supabase/functions/`, `api/` procurando ocorrências de cada `tabela` e `coluna` (heurística: `.from('tabela')`, `.select('col,...')`, `tabela.col`, snake↔camel, JSON destructuring).
   - Classifica cada coluna: `READ`, `WRITE`, `READ+WRITE`, `ORPHAN`, `SYSTEM` (id/created_at/updated_at — ignoradas).
   - Detecta candidatos a "front sem persistência": busca `useState`/`useReducer` com nomes de domínio que não casam com nenhuma coluna conhecida (heurística best-effort, marcada como sugestão).
   - Gera `docs/DB_FRONTEND_COVERAGE.md` e um JSON `audit/db-frontend-coverage.json` para diffs futuros.

2. **`docs/DB_FRONTEND_COVERAGE.md`** — relatório legível:
   - Sumário executivo (totais, % cobertura por banco, top 20 tabelas com mais órfãs).
   - Por **módulo funcional** (Quotes, Favoritos, Coleções, Kits, MCP, Auditoria, Magic Up, Produtos, CRM, etc.): tabelas envolvidas + lista de colunas órfãs com recomendação (Expor / Deprecar / Confirmar).
   - Seção "Front sem persistência" (lista de candidatos, marcados como hipótese a validar).
   - Apêndice: tabelas excluídas (vazias/legadas/particionadas) com motivo.

3. **`package.json` script**: `"audit:db-frontend": "node scripts/audit-db-frontend-coverage.mjs"`.

---

## Detalhes técnicos

### Introspecção

```text
BD Interno    → information_schema.columns + pg_stat_user_tables (psql direto)
BD Externo    → src/types/external-db*.ts + supabase/functions/external-db-bridge/**
                + (opcional) operação introspect read-only no bridge
BD CRM        → supabase/functions/crm-db-bridge/** + tipos já existentes
```

### Heurística de uso no front

Para coluna `foo_bar` da tabela `quotes`:

```text
Sinais READ:
  - .select('...foo_bar...')   em src/ ou edges
  - .foo_bar                   acessor em arquivos .ts/.tsx
  - "foo_bar":                 destructuring JSON

Sinais WRITE:
  - .insert({...foo_bar...})
  - .update({...foo_bar...})
  - .upsert(...)

Camel-case: também procura fooBar (Supabase types já entregam camel em alguns hooks).
```

### Falsos-positivos esperados

- Colunas usadas só por **triggers/RPCs** aparecem como órfãs (relatório marca como "possivelmente usada por trigger" se nome bate com função SQL).
- Edge functions internas (cron, webhooks) que escrevem mas nunca expõem — relatório separa "usado em edge mas não no front" como categoria distinta.

### Exclusões automáticas

- Tabelas com `n_live_tup = 0`.
- Sufixos: `_old`, `_y\d{4}m\d{2}`, `_backup`, `_tmp`.
- Tabelas em schemas `auth.*`, `storage.*`, `realtime.*`.
- Colunas sistêmicas: `id`, `created_at`, `updated_at`, `deleted_at`, `tenant_id` (não geram ruído).

---

## Plano de execução

```text
1. Levantar schema completo dos 3 bancos
   - Interno: psql information_schema
   - Externo: ler tipos do repo + (se necessário) acrescentar op introspect no bridge
   - CRM: idem
2. Levantar contagem de linhas (filtro "com dados")
3. Escrever scripts/audit-db-frontend-coverage.mjs
4. Rodar localmente, validar amostra (10 tabelas) manualmente
5. Gerar docs/DB_FRONTEND_COVERAGE.md
6. Adicionar npm script
7. Resumo final no chat: total de órfãs, top achados, recomendações imediatas
```

## Fora de escopo

- Refatoração de código (só relatório).
- Migrations para remover colunas órfãs (ficam como recomendação).
- Cobertura de schemas internos do Supabase (`auth`, `storage`).
- Validação semântica (se a coluna é usada **corretamente** — só presença).