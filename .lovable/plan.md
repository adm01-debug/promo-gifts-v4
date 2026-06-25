## Auditoria das mudanças recentes em `QuotesListPage`

### Validações OK
1. **Imports** — todos os ícones e helpers removidos (`DollarSign`, `CheckCircle2`, `Clock`, `TrendingUp`, `TrendingDown`, `Card`, `CardContent`, `formatCurrency`) não têm mais uso na página.
2. **Destructuring** — `kpis` e `funnelData` removidos do `useQuotesListPage()` sem quebrar nada (TypeScript não exige consumir tudo).
3. **Layout** — header e filtros continuam encadeados; spacing `space-y-3/4` mantém ritmo.
4. **Botão "Novo Orçamento"** — `px-2` + `mr-1` reduz largura ~30% sem alterar altura/cor/tipografia. `data-testid="quote-new-button"` preservado (E2E continua passando).
5. **Tipos** — sem `any` introduzido; `QuoteStatus` ainda usado mais abaixo.

### Gaps encontrados (limpeza)

**Gap 1 — Linha em branco dupla**
`src/pages/quotes/QuotesListPage.tsx:109-110` ficou com 2 linhas vazias após a remoção do bloco KPI/Funil. Cosmético, mas o ESLint da casa marca.

**Gap 2 — Componente órfão**
`src/components/quotes/QuotesFunnelChart.tsx` não tem mais nenhum import no projeto (`rg` confirmou). Vira dead code se não for usado em outro lugar.

**Gap 3 — Hook ainda computa dados não usados**
`src/pages/quotes/useQuotesListPage.ts` continua calculando `kpis` (reduce sobre `filteredQuotes`) e `funnelData` (map de transições) a cada render. Sem consumidores, é trabalho desperdiçado em toda renderização da página de orçamentos.

### Plano de correção

1. **`src/pages/quotes/QuotesListPage.tsx`** — colapsar as 2 linhas em branco da linha 109-110 para uma única linha.
2. **`src/components/quotes/QuotesFunnelChart.tsx`** — deletar o arquivo (e qualquer teste/snapshot associado, se houver).
3. **`src/pages/quotes/useQuotesListPage.ts`** — remover o cálculo de `kpis` e `funnelData` (e os imports que ficarem órfãos), e remover ambos do objeto retornado.
4. **Verificação pós-edição** — `rg "QuotesFunnelChart|funnelData|kpis" src/pages/quotes src/components/quotes` deve voltar vazio.

### Não afetado (confirmado)
- E2E specs (`quote-new-button` continua).
- RLS / banco — nada toca em backend.
- Outros consumidores de `kpis` no projeto (intelligence, sales) são objetos diferentes, sem colisão de nome.

### Arquivos afetados
- `src/pages/quotes/QuotesListPage.tsx` (1 linha)
- `src/components/quotes/QuotesFunnelChart.tsx` (delete)
- `src/pages/quotes/useQuotesListPage.ts` (remover bloco kpis+funnelData + imports órfãos)