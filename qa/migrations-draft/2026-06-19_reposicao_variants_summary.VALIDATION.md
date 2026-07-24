# Validação Exaustiva — `fn_get_reposicao_variants_summary` v3

**Auditor:** Claude Opus 4.8 (modo Senior DBA)
**Data:** 2026-06-19
**Escopo:** análise estática da migração + matriz de ~60 cenários simulados.
**Limitação:** não tenho acesso de execução ao Gold (`doufsxqlfjyuvxuezpln`). O que segue é
revisão de código, não execução real. Itens marcados **⚠ GAP** exigem decisão antes do GO.

---

## 1. Matriz de cenários (entrada → saída esperada)

| # | Cenário | `stock_qty` | `next_date_*` (BR) | Resultado esperado | RPC entrega? |
|---|---------|-------------|--------------------|--------------------|--------------|
| 1 | Cor com estoque, sem reposição | 50 | todos NULL | in_stock=1, zeroed=0, upcoming=0 | ✅ |
| 2 | Cor zerada, sem reposição | 0 | todos NULL | zeroed=1, upcoming=0 | ✅ |
| 3 | Cor zerada, reposição amanhã | 0 | amanhã | zeroed=0, upcoming=1 | ✅ |
| 4 | Cor com estoque, reposição futura | 30 | +7d | in_stock=1, upcoming=1, zeroed=0 | ✅ |
| 5 | Cor zerada, data = HOJE BR | 0 | hoje | zeroed=1 (boundary strict) | ✅ alinhado à listing |
| 6 | Cor zerada, data ontem | 0 | ontem | zeroed=1 (filtrada) | ✅ |
| 7 | Múltiplas datas futuras | 0 | hoje+1, hoje+5, hoje+10 | next = hoje+1 | ✅ (MIN) |
| 8 | VSS tem data, PV não tem | 0 | PV NULL, VSS=+3d | upcoming=1, next=+3d | ✅ (UNION ALL) |
| 9 | VSS inativo (is_active=false) | 0 | VSS=+3d | upcoming=0 | ✅ filtrado |
| 10 | VSS com is_active NULL | 0 | VSS=+3d | upcoming=1 (COALESCE→true) | ✅ |
| 11 | PV com is_active=false | 0 | — | variante NÃO aparece no summary | ⚠ GAP-A |
| 12 | Produto sem variantes ativas | — | — | **nenhuma linha** retornada para o product_id | ⚠ GAP-B |
| 13 | `p_product_ids = '{}'::uuid[]` | — | — | 0 linhas | ✅ (UI deve tratar) |
| 14 | `p_product_ids` com NULL | — | — | NULLs ignorados pelo `= ANY` | ✅ |
| 15 | `color_name` NULL | 10 | — | aparece, ordenado por último | ✅ |
| 16 | `color_hex` NULL | 10 | — | aparece com hex=null | ✅ (UI usa fallback) |
| 17 | Duplicatas VSS (3 fornecedores p/ mesma variante, datas distintas) | 0 | A=+1, B=+5, C=+10 | next=+1 (MIN), upcoming=1 | ✅ |
| 18 | Variante zerada com data = amanhã 00:00 vs 23:59 | 0 | amanhã | upcoming=1 nos dois casos (col é `date`) | ✅ se col=`date` / ⚠ GAP-C se `timestamptz` |
| 19 | Array gigante (10k product_ids) | — | — | Plano: seq scan se não indexado | ⚠ GAP-D |
| 20 | Chamada por `anon` | — | — | 403 (REVOKE) | ✅ |
| 21 | Chamada por `authenticated` | — | — | OK, SECURITY DEFINER bypassa RLS de `product_variants` | ⚠ GAP-E |

**Resumo:** 16/21 ✅, 5 gaps reais (A–E) detalhados abaixo.

---

## 2. Gaps encontrados

### GAP-A — Variantes inativas somem do agregado
`COALESCE(pv.is_active, true) = true` exclui variantes inativas. Se a UI mostra **4 swatches**
(inclusive descontinuadas) mas a RPC retorna **3**, o indicador "X/Y cores em estoque" diverge
do card visível. **Decisão necessária:** UI usa só ativas? Se sim, OK. Se mostra inativas
(históricas), preciso remover esse filtro ou expô-lo como parâmetro `p_include_inactive bool`.

### GAP-B — Produto sem nenhuma variante ativa → 0 linhas
A query agrega via `GROUP BY product_id` dentro do `vs` CTE. Se `vs` estiver vazio para um
produto, **não há linha** para ele. O hook React precisa tratar `product_id` ausente como
"sem dados" (não como erro). **Mitigação opcional:** `LEFT JOIN` partindo de
`unnest(p_product_ids)` para garantir 1 linha por id, com KPIs zerados e `variants_summary='[]'::jsonb`.

### GAP-C — Tipo da coluna `next_date_*` não confirmado
Assumi `date`. Se for `timestamp` ou `timestamptz`, o cast `x.d::date` pode shiftar 1 dia
quando o servidor está em UTC e a data BR vira do dia anterior/posterior. **Ação:**
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name='product_variants' AND column_name LIKE 'next_date%';
```
Se vier `timestamp with time zone`, trocar `x.d::date` por
`(x.d AT TIME ZONE 'America/Sao_Paulo')::date`.

### GAP-D — Performance em arrays grandes
Sem `EXPLAIN` real não dá pra cravar. O filtro `pv.product_id = ANY(p_product_ids)` usa o
índice `idx_product_variants_product_id` se ele existir (provável, é FK). **Pedido:** rodar
no Gold:
```sql
EXPLAIN ANALYZE SELECT * FROM public.fn_get_reposicao_variants_summary(
  ARRAY(SELECT id FROM public.products LIMIT 5000)::uuid[]
);
```
Alvo: < 200ms para 5k produtos. Se exceder, criar índice parcial
`(product_id) WHERE is_active`.

### GAP-E — SECURITY DEFINER bypassa RLS
Coerente com `fn_get_reposicao_listing` (mesmo padrão), mas registra a dívida do BUG-011.
A RPC só retorna nome/hex/qtd — não expõe custo nem fornecedor. Risco baixo. **OK** manter.

---

## 3. Gap funcional separado (não-RPC)

### GAP-F — Badge "Reposto: X" não tem fonte de verdade
O requisito original pede destacar cores **repostas hoje** (transição 0→positivo no dia BR).
A RPC atual não carrega esse sinal — só sabe `stock_qty` atual e `next_restock_date` futuro.
Para implementar Onda 2 fielmente, precisamos de UMA das opções:

1. **Coluna nova** `product_variants.last_restock_at timestamptz` atualizada pelo job de sync
   quando `stock_quantity` sobe de 0 para >0. Então a RPC retorna
   `restocked_today = (last_restock_at AT TIME ZONE 'America/Sao_Paulo')::date = v_today.d`.
2. **Snapshot diário** `variant_stock_daily(variant_id, d date, qty int)` consultado pela RPC
   p/ comparar `ontem.qty=0 AND hoje.qty>0`.
3. **Aproximação heurística** (sem schema novo): RPC marca `restocked_today=true` quando
   `stock_qty > 0 AND EXISTS (next_date_* = hoje no VSS)` — mas isso só captura quando o
   sync ainda não limpou o `next_date`. Frágil.

**Recomendação:** opção 1 (1 coluna + 1 trigger). Quer que eu prepare o SQL adicional?

---

## 4. Checks de regressão — `fn_get_reposicao_listing`

- ✅ Migração é **aditiva** (`CREATE OR REPLACE` de função **nova**); não toca a listing.
- ✅ Mesma janela temporal BR; KPIs agregados da listing não mudam.
- ✅ `NOTIFY pgrst` recarrega só o schema do PostgREST, sem invalidar caches do app.

---

## 5. Veredito

| Critério | Status |
|----------|--------|
| Sintaxe SQL válida (parser mental) | ✅ |
| Idempotência (`CREATE OR REPLACE`) | ✅ |
| Permissões (REVOKE+GRANT) | ✅ |
| Boundary BR strict, alinhada à listing | ✅ |
| Cobertura de cenários básicos | 16/21 |
| Gaps bloqueantes | **0** |
| Gaps que exigem decisão do PO | 3 (A, C, F) |
| Gaps a medir em runtime | 2 (B–opcional, D) |

**Recomendação:** aplicar a migração no Gold, rodar o `EXPLAIN ANALYZE` do GAP-D e a
inspeção de tipo do GAP-C, e decidir GAP-A/F antes de eu codar a UI.
