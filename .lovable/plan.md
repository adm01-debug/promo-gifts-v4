## Objetivo
Mover os campos **Buscar** e **Ordenar** para a mesma linha do título "Orçamentos", alinhados horizontalmente com o título à esquerda e o botão "Novo Orçamento" à direita.

## Mudança (1 arquivo: `src/pages/quotes/QuotesListPage.tsx`)

Reestruturar o header (linhas 86–111) para conter 3 zonas em uma única flex row em telas ≥ sm:

```text
[ Título + contagem ]   [ Buscar  |  Ordenar ]   [ + Novo Orçamento ]
```

### Detalhes técnicos

1. **Remover** o bloco separado de filtros (linhas 140–164) — ele é absorvido pelo header.
2. **Novo header** com layout responsivo:
   - Mobile (`<sm`): empilhado em coluna (título → filtros → botão), preservando UX atual.
   - Desktop (`≥sm`): `flex-row items-center justify-between` com 3 grupos.
   - Grupo central (filtros) usa `flex gap-2` com Input `w-[260px] lg:w-[320px]` (largura fixa para não competir com o título) e Select `w-[170px]`.
3. **Banner pending** e **Error banner** permanecem entre o header e os Status Chips — sem alteração.
4. **Manter** todos os `data-testid` existentes (`page-title-orcamentos`, `quote-new-button`) — gates de E2E dependem deles.
5. **Sem mudanças** em `useQuotesListPage`, tipos, lógica, ou Status Chips. Mudança puramente de layout/presentation.

### Acessibilidade
- Input mantém `placeholder` descritivo; adicionar `aria-label="Buscar orçamentos"` para leitor de tela já que o label visual sai.
- Select já tem ícone + texto descritivo.

### Riscos
- Em viewports `sm` estreitos (~640–768px), os 3 grupos podem ficar apertados. Mitigação: `flex-wrap` no container e `min-w-0` no grupo título para permitir truncamento gracioso.
- Nenhum teste E2E referencia a estrutura DOM dos filtros por posição — apenas por testid/placeholder, ambos preservados.

## Fora de escopo
- Banco de dados, hooks, lógica de filtros, telemetria, testes.
- Redesign visual além do reposicionamento solicitado.
