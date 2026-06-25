## Mudança

Em `src/pages/quotes/QuotesListPage.tsx` (linhas 126–134), substituir o botão retangular "Novo Orçamento" por um **botão circular azul com ícone `+`** e tooltip ao hover, mantendo o `data-testid="quote-new-button"` e o destino `/orcamentos/novo`.

## Detalhes técnicos

- Usar `Tooltip`, `TooltipTrigger`, `TooltipContent` de `@/components/ui/tooltip` (adicionar import; `TooltipProvider` já está no app root).
- Botão: `Button` com `size="icon"`, `className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 hover:scale-105 transition-transform"`, contendo apenas `<Plus className="h-5 w-5" />`.
- `aria-label="Novo orçamento"` para acessibilidade.
- Tooltip copy curto/comercial: **"Criar novo orçamento em segundos"** (lado `left` para não cortar na borda direita).
- Nenhum outro arquivo alterado; sem mudança de lógica/dados.

## Validação

- Build + typecheck.
- Verificar visualmente em desktop e mobile (390px) que a bola fica alinhada com Buscar/Ordenar.
