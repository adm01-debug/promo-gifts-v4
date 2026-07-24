# Numeração de Orçamentos (`quote_number`) — Arquitetura

> **SSOT:** banco externo `doufsxqlfjyuvxuezpln`, trigger `generate_quote_number`
> **Formato canônico:** `NNNNN/YY` (3–6 dígitos / 2 dígitos do ano)
> **Última auditoria:** 2026-06-25 — leitura ao vivo do `pg_get_functiondef`

---

## 1. Camadas

### 1.1. Frontend — prévia otimista (`~NNNNN/YY`)
Arquivo: [`src/utils/quote-number.ts`](../src/utils/quote-number.ts)

```ts
computeNextQuoteNumberPreview(existing, year) → "~10012/26" | null
```

- Lê os `quote_number` do ano corrente que o vendedor consegue ver (RLS já filtra).
- Calcula `max(seq) + 1`.
- **Prefixo `~` é contrato de UX:** “é estimativa, o número real sai ao salvar”.
- Label da UI: `Próx. ~10012/26 (gerado ao salvar)`.

**Se dois vendedores abrem o wizard ao mesmo tempo, ambos veem `~10012/26`.** Isso é esperado — quem persistir primeiro fica com `10012/26`, o segundo passa a `10013/26`.

### 1.2. Backend — número real (autoridade)
Trigger `BEFORE INSERT ON public.quotes` chamando `generate_quote_number()`:

```sql
year_short := to_char(now(), 'YY');
SELECT COALESCE(MAX(seq), 10000) + 1
  FROM public.quotes
 WHERE quote_number LIKE '%/' || year_short;
NEW.quote_number := (max+1) || '/' || year_short;
```

| Propriedade | Valor atual |
|---|---|
| Estratégia | **MAX+1** (não usa sequence PG) |
| Lock | ❌ **Sem `FOR UPDATE`** |
| Unique index | ❌ **Não existe `UNIQUE` em `quote_number`** |
| Escopo de unicidade | **Global por ano** (não por `org_id` nem por `seller_id`) |
| Reset anual | Automático (filtro por `YY` no `WHERE`) |
| Rascunho consome número? | Sim — o trigger dispara em todo `INSERT`. Confirmar com PO se isso é desejado. |

### 1.3. Validação client-side (defesa)
- `formatQuoteNumberLabel()` saneia espaços e rejeita não-canônico.
- `QUOTE_NUMBER_REGEX = /^\d{3,6}\/\d{2}$/` — coberto por 91 testes unitários + 100k entradas fuzz.

---

## 2. Cenários de concorrência multi-vendedor

| Cenário | Comportamento esperado | Comportamento atual |
|---|---|---|
| Vendedores A e B salvam com diferença > ~10ms | A=`10012/26`, B=`10013/26` | ✅ OK (B já enxerga o INSERT de A) |
| A e B `INSERT` no **mesmo bloco transacional concorrente** | Um deve falhar ou serializar | ⚠️ **RISCO:** sem lock e sem unique index, ambos podem gravar `10012/26` |
| Wizard aberto às 23:59:59 de 31/dez, salvo às 00:00:01 de 01/jan | Gera `00001/27` (não `13/26`) | ✅ OK (`to_char(now(),'YY')` no momento do INSERT) |
| Rollback no meio da transação | Número não é “queimado” | ✅ OK (MAX+1 reconsulta) |

---

## 3. 🚨 Gaps identificados (requerem aprovação do PO)

> Não foram aplicadas alterações no banco externo — toda mudança em
> `doufsxqlfjyuvxuezpln` exige autorização explícita (regra do projeto).

1. **Adicionar `UNIQUE INDEX` em `quote_number`** — defesa final contra duplicidade. Custo: detecta colisão via `23505`, o app retenta.
2. **Adicionar `FOR UPDATE` no `SELECT MAX(...)`** dentro do trigger — serializa inserções do mesmo ano. Custo: leve degradação sob alta concorrência (aceitável).
   - Alternativa mais barata: `pg_advisory_xact_lock(hashtext('quote_number:'||year_short))`.
3. **Decidir escopo:** se houver multi-tenant (`organizations`), unicidade deveria ser `(org_id, quote_number)` e o filtro do `MAX` também.
4. **Rascunhos:** se rascunho não deve consumir número, gate por `WHEN (NEW.status <> 'draft')` na trigger.

Script SQL pronto para revisão (não aplicado): [`docs/sql/quote-number-hardening.sql`](./sql/quote-number-hardening.sql).

---

## 4. Como auditar a divergência prévia × salvo

- **Em runtime:** `createQuote` loga `quote_create_ok` com `{ quote_number, seller_id, org_id, year_yy, status, request_id }` via `structuredLogger`. Filtrar por `quote_number` revela qualquer caso em que dois `quote_create_ok` distintos retornem o mesmo número.
- **Inspeção do trigger:** rodar `node scripts/inspect-quote-number-strategy.mjs` (read-only).
- **Teste sintético de concorrência:** `npm test -- quoteNumberConcurrency`.

---

## 5. Referências
- Trigger: `public.generate_quote_number()` (DB externo)
- Util frontend: `src/utils/quote-number.ts`
- RPC de criação: `public.create_quote_transactional`
- Service: `src/services/quoteService.ts → createQuote`
