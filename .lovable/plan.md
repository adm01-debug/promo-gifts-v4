Plano já aprovado e implementado na rodada anterior em `src/pages/quotes/QuotesListPage.tsx`:

- Header consolidado em uma única flex row: `[Título + contagem] [Buscar | Ordenar] [+ Novo Orçamento]`.
- Bloco separado de filtros removido (absorvido pelo header).
- Responsivo: empilha em mobile (`<sm`), alinhado horizontalmente em `≥sm`; `flex-wrap` + `min-w-0` evitam aperto em ~640px.
- `data-testid="page-title-orcamentos"` e `data-testid="quote-new-button"` preservados.
- `aria-label="Buscar orçamentos"` adicionado ao Input.
- Banners (pending / erro) e Status Chips permanecem abaixo do header sem alteração.
- Sem mudanças em hooks, tipos, lógica ou testes.

Reaplicar este plano não exige edições adicionais — basta aprovar para confirmar o estado atual.
