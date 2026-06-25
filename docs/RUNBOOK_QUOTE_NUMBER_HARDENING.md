# Runbook — Hardening do `generate_quote_number`

**Banco-alvo:** `doufsxqlfjyuvxuezpln` (Gold/Medallion — produção)
**Aprovado pelo PO:** sim — decisões fixadas em 2026-06-25
**Tempo estimado de execução:** 2–5 min (depende do tamanho de `quotes`)
**Janela recomendada:** baixa concorrência (≠ horário de pico de vendas)

---

## 0. Decisões fixadas (não alterar sem nova aprovação)

| Item | Decisão |
|---|---|
| Escopo de unicidade | **Global por ano** (`yy`) — sem `org_id`, sem `seller_id` |
| Rascunhos consomem número | **Sim** (mantém comportamento atual) |
| Prévia frontend | **Permanece estimativa `~NNNNN/YY`** (sem round-trip) |

→ Os trechos `(Opcional)` no `quote-number-hardening.sql` **NÃO devem ser aplicados** nesta janela.

---

## 1. Pré-deploy (rodar antes)

```bash
# 1.1 — snapshot do trigger atual
psql "$DATABASE_URL" -c \
  "SELECT pg_get_functiondef('public.generate_quote_number'::regproc)" \
  > /tmp/trigger-before.sql

# 1.2 — verificar se já existem duplicidades (precisam ser resolvidas ANTES
# do índice unique, ou o CREATE INDEX falha)
psql "$DATABASE_URL" -c "
  SELECT quote_number, COUNT(*) AS qtd
    FROM public.quotes
   WHERE quote_number IS NOT NULL
   GROUP BY quote_number
  HAVING COUNT(*) > 1
   ORDER BY qtd DESC;"
```

- Se a query 1.2 retornar **0 linhas** → seguir para o passo 2.
- Se retornar **N > 0 linhas** → **PARAR**. Cada duplicidade precisa ser renumerada manualmente. Renumerar a duplicata mais nova: `UPDATE public.quotes SET quote_number = '<próximo livre>/<yy>' WHERE id = '<uuid>';` Depois reexecutar a query.

---

## 2. Deploy (rodar nesta ordem)

### 2.1. Criar o índice UNIQUE — **FORA de transação**

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
     uniq_quotes_quote_number
     ON public.quotes (quote_number)
     WHERE quote_number IS NOT NULL;"
```

> `CONCURRENTLY` é obrigatório para não bloquear `INSERT` durante a criação.
> Se falhar a meio caminho, o índice fica como `INVALID`. Diagnóstico:
> `SELECT indexname, indexdef FROM pg_indexes WHERE indexname='uniq_quotes_quote_number';`
> Se inválido: `DROP INDEX CONCURRENTLY uniq_quotes_quote_number;` e reexecutar.

### 2.2. Substituir a função do trigger — **dentro de transação**

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 \
  -f docs/sql/quote-number-hardening.sql
```

> A trigger `trigger_generate_quote_number` continua referenciando a função
> (mesmo nome) — `CREATE OR REPLACE` substitui o corpo atomicamente.

---

## 3. Verificação pós-deploy (rodar imediatamente)

```bash
node scripts/verify-quote-number-hardening.mjs
```

Saída esperada (todos OK):

```
✔ trigger contém advisory_xact_lock
✔ UNIQUE INDEX uniq_quotes_quote_number presente e válido
✔ 0 duplicidades em quote_number
✔ sequência por ano sem gaps suspeitos
```

Smoke manual adicional (opcional):

```sql
-- 50 inserts paralelos no mesmo ano (idealmente em staging primeiro!)
-- Em produção, validar criando 2 orçamentos reais em janelas adjacentes
-- e conferindo que vieram 10012/26 e 10013/26.
```

---

## 4. Monitoramento pós-deploy (24h)

- Filtrar `quote_create_ok` no log estruturado por `quote_number` duplicado:
  `quote_number=10012/26 | count > 1` → **alerta P0**, executar rollback.
- Métrica de latência da RPC `create_quote_transactional` — esperado: +1–3 ms
  no p95 (advisory_lock é barato). Aumento > 50 ms = investigar contenção.

---

## 5. Rollback

Se houver contenção ou comportamento inesperado:

```bash
# 5.1 — restaurar a função sem lock
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -1 \
  -f docs/sql/quote-number-hardening-rollback.sql

# 5.2 — remover o índice unique (fora de transação)
psql "$DATABASE_URL" -c \
  "DROP INDEX CONCURRENTLY IF EXISTS public.uniq_quotes_quote_number;"
```

Após rollback, abrir issue para discutir estratégia alternativa
(ex.: sequence PG dedicada por ano).

---

## 6. Comunicação

- ✅ Notificar time de vendas: nenhuma mudança visível na UI.
- ✅ Notificar suporte: se algum cliente reportar erro `23505` ao criar
  orçamento (improvável, < 1 em 1M), pedir para tentar novamente —
  o app já trata via `sanitizeMessage`.

---

## 7. Referências
- SQL aplicar: `docs/sql/quote-number-hardening.sql`
- SQL reverter: `docs/sql/quote-number-hardening-rollback.sql`
- Verificação: `scripts/verify-quote-number-hardening.mjs`
- Documentação: `docs/QUOTE_NUMBERING.md`
- Teste de regressão: `src/services/__tests__/quoteNumberConcurrency.test.ts`
