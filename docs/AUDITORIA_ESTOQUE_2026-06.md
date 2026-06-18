# Auditoria do Módulo "Estoque" — 2026-06-18

Auditoria exaustiva do módulo de Estoque (rota `/estoque` + `/reposicao`),
cobrindo camada de dados (`stockFetcher`), lógica pura (`src/lib/inventory/*`),
tipos (`src/types/stock.ts`), hooks e componentes (`src/components/inventory/*`).

Baseline: **1.438 testes passando** no módulo antes e depois das correções.
Typecheck (`tsc -p tsconfig.app.json`): **0 erros**. ESLint nos arquivos
tocados: **0 warnings**.

---

## Mapa do módulo

| Camada | Arquivos-chave |
|---|---|
| Rotas | `src/routes/tools-routes.tsx` (`/estoque`), `src/routes/product-routes.tsx` (`/reposicao`) |
| Página | `src/pages/admin/StockDashboardPage.tsx` → `StockDashboard` |
| Dados | `src/hooks/stock/stockFetcher.ts`, `src/integrations/supabase/gold-relations.ts` |
| Lógica pura (SSOT) | `stock-filter.ts`, `rupture-risk.ts`, `health-score.ts`, `future-stock-stats.ts`, `catalog-stock-status.ts` |
| Hooks | `useVariantStock`, `useReplenishments`, `useFutureStockPreference` |
| UI | `VariantStockTable`, `StockFilterToolbar`, `FutureStockDialog`, `StockAlertsIndicator`, `SupplierRiskPanel` |

Fonte de dados (Medallion Ouro, via `GOLD_READ_ALIASES`): `products`,
`product_variants`, `variant_supplier_sources`, `categories`, `suppliers`,
`product_images`.

---

## Achados e correções

### ✅ CORRIGIDO — F1 (Alta): janela de "Estoque Futuro" super/subestimava quantidades

**Sintoma:** O filtro "Preciso de X un · incluir Estoque Futuro" somava ao pool
o **total** de reposições futuras (`next_quantity_1+2+3`) atrelado a **uma única
data** (`next_date_1`). Consequências:

- **Superestimava:** uma chegada distante (ex.: 60 dias) entrava na janela de
  7 dias só porque `next_date_1` (chegada próxima) estava na janela.
- **Subestimava:** se `next_date_1` estava fora da janela mas `next_date_2`
  estava dentro, a contribuição era **zero**.

**Causa raiz:** `stockFetcher` colapsava 3 (na verdade até 6 — ver F2) chegadas
com datas distintas num único par `futureStock`/`futureStockDate`. A lógica de
janela em `stock-filter.futureWithinWindow` estava correta para o seu contrato
de **data única**, mas os dados de entrada violavam esse contrato.

**Correção:**
- Novo campo opcional `VariantStock.futureSegments: { quantity, date }[]`
  (`src/types/stock.ts`) — preserva a data de **cada** chegada.
- `futureWithinWindow` (`stock-filter.ts`) passa a somar **apenas segmentos com
  `date ≤ corte`** quando há segmentos; mantém o fallback de data única quando
  ausentes (contrato legado preservado — fuzz suites intactas).
- `stockFetcher` popula `futureSegments` a partir dos slots `next_*`.
- Nova suíte: `stock-filter.future-segments.test.ts` (super/subestimação,
  quantidades inválidas, inércia do sub-toggle, fallback de data única).

### ✅ CORRIGIDO — F2 (Média): chegadas futuras 4–6 eram descartadas silenciosamente

**Sintoma:** A tabela Ouro `variant_supplier_sources` expõe **seis** slots de
reposição (`next_quantity_1..6` / `next_date_1..6`, ver `gold-relations.ts`),
mas o `stockFetcher` lia somente os slots **1–3**. Variações com mais de 3
chegadas programadas tinham `inTransitStock`, `futureStock` e as entradas do
diálogo de Estoque Futuro **subdimensionados**.

**Correção:** Helper único `nextStockPairs()` em `stockFetcher` cobre os 6 slots
e é reutilizado por `buildFutureEntries` (lista global) **e** pela montagem de
`futureSegments` (por variação) — fim da divergência. `SELECT` ampliado para
buscar `next_quantity_4..6` / `next_date_4..6`. Como bônus, a soma de
`inTransitStock` passou de checagem _truthy_ (`if (q)`) para `q > 0`, evitando
que quantidades negativas anômalas subtraíssem do trânsito.

### ✅ CORRIGIDO — F3 (Média): testes de `FutureStockModal` quebrados

**Sintoma:** `tests/components/products/FutureStockModal.test.tsx` falhava em
**todos** os 5 casos com `"Tooltip must be used within TooltipProvider"` — o
crash de render mascarava as asserções reais.

**Correção:**
- Render dos testes envolto em `TooltipProvider` (fornecido globalmente em
  `App.tsx`, ausente no teste isolado).
- Botões de filtro de cor do modal ganharam `title`, `aria-label`
  (`Filtrar por cor <X>`), `aria-pressed` e `type="button"` — **melhoria de
  acessibilidade** (o _accessible name_ antes era ruído: estoque + alt + nome) e
  alvo estável para testes. 5/5 casos passam.

### ⚠️ DOCUMENTADO — F4 (Alta): "Risco de Ruptura" preditivo está inerte em produção

**Sintoma:** A reclassificação preditiva em `VariantStockTable` chama
`computeRuptureRisk({ avgDailyDepletion: variant.avgDailySales, ... })`, mas
**`variant.avgDailySales` nunca é populado** em nenhum ponto do pipeline de
dados (`stockFetcher` não o define; não há coluna de velocidade/baixa diária no
layer Ouro — ver `gold-relations.ts`). Resultado:

- A fórmula sempre retorna `atRisk: false` (exceto `current === 0`, caminho que
  não passa pelo gate `in_stock | overstocked`).
- O chip/filtro **"Estoque Baixo" (low_stock)** e o seletor de **horizonte
  (3/7/15/30 dias)** + **quantidade-alvo** não têm efeito prático.

**Por que NÃO foi "corrigido" via código:** A única fonte de velocidade no repo
é **mock** (`src/lib/stock-chart-utils.ts` → `generateMockVelocity`,
`avg_daily_depletion_*`). Injetar dados sintéticos de baixa diária numa
ferramenta de decisão de **estoque de produção** produziria previsões de ruptura
falsas — risco operacional maior do que o recurso inerte.

**Ação recomendada (fora do escopo desta auditoria, requer dado real):**
expor no layer Ouro uma média de baixa diária por variação (ex.: view materializada
de `stock_movements`/vendas dos últimos 30 dias) e mapeá-la para
`variant.avgDailySales` no `stockFetcher`. A camada de UI e a lógica
(`rupture-risk.ts`) já estão prontas e testadas para consumir o sinal assim que
existir. `lead_time_days` já disponível em `variant_supplier_sources` pode
informar o horizonte default por fornecedor.

---

## Verificações que passaram (sem defeito encontrado)

- `calcHealthScore` / `getHealthBand` / `getDaysCoverBand` — guardas contra
  `NaN`/`Infinity`/negativos corretos; thresholds consistentes com os testes.
- `computeFutureStockStats` — dedupe por `id` e fechamento de somas por status
  (invariantes I1–I6) íntegros.
- `applyStockFilters` — interseção por índices, normalização de acentos/caixa,
  projeção de variações e ordenação validadas por fuzz/stress/perf.
- `getCatalogStockStatus` (catálogo público) — fallback seguro para
  `out-of-stock` em entradas inválidas.
- KPI "Estoque Baixo" ↔ chip de status: consistência travada por
  `VariantStockTable.kpi-consistency.test.tsx`.
- Paginação/clamp de página e deep-link `?product=` em `VariantStockTable`.

---

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/types/stock.ts` | + campo `futureSegments` em `VariantStock` |
| `src/lib/inventory/stock-filter.ts` | `futureWithinWindow` soma por segmento dentro da janela |
| `src/hooks/stock/stockFetcher.ts` | `nextStockPairs` (slots 1–6), popula `futureSegments`, soma `inTransit` robusta |
| `src/components/products/FutureStockModal.tsx` | a11y nos botões de filtro de cor |
| `tests/components/products/FutureStockModal.test.tsx` | render com `TooltipProvider` |
| `src/lib/inventory/__tests__/stock-filter.future-segments.test.ts` | nova suíte (F1) |
