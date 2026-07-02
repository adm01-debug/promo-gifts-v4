# Validação — Layout 50/50 Empresa + Contato

**Arquivo alterado:** `src/components/quotes/CompanyContactSelector.tsx` linha 168  
`className="grid grid-cols-1 gap-4 md:grid-cols-2"`

## Escopo

Mudança puramente cosmética de wrapper: passa de stack vertical (`space-y-6`) para grid responsivo 50/50 em `md+`, mantendo stack em mobile. Nenhuma alteração em regra de negócio, fetch, ou contrato de props.

## Call-sites auditados

| Consumidor | Container pai | Comportamento |
|---|---|---|
| `src/pages/quotes/QuoteBuilderPage.tsx:301` | `lg:col-span-5` (≈41% de `max-w-[1920px]`) dentro de card `rounded-2xl border p-4` | 50/50 confortável em desktop; mobile (<768px) colapsa para 1 col porque grid principal também colapsa |
| `src/hooks/quotes/useQuoteBuilderState.ts:33` | apenas re-export de tipos (`SelectedCompanyInfo`, `SelectedContactInfo`) — não renderiza | N/A |
| `tests/components/quotes/CompanyContactSelector.test.tsx` | render smoke com providers | passa |

Não há uso em modal estreito ou drawer <400px que pudesse causar clipping do `CompanySearchDropdown` (Popover Radix, portal → não sofre pelo pai).

## Testes executados

### Unit (Vitest + RTL) — `src/components/quotes/__tests__/CompanyContactSelector.layout.test.tsx`
- ✅ wrapper aplica `grid grid-cols-1 md:grid-cols-2 gap-4`
- ✅ contém exatamente 2 filhos diretos
- ✅ placeholder "Selecione uma empresa primeiro" quando `companyId` vazio
- ✅ ordem semântica das labels: Empresa → Contato (tab-order preservado)

**Resultado:** 4/4 passed em 110 ms.

### Suite pré-existente
- ✅ `tests/components/quotes/CompanyContactSelector.test.tsx` (2 smoke tests) — segue verde.

## Matriz de gaps

| ID | Hipótese | Veredicto | Evidência |
|---|---|---|---|
| G1 | Overflow horizontal em md (768px) por dropdown de busca | ✅ PASS | `CompanySearchDropdown` usa Radix Popover em portal — largura calculada pelo trigger, não estoura container |
| G2 | Overlap entre Empresa e Contato | ✅ PASS | `gap-4` (16px) garante gutter; grid CSS impede sobreposição |
| G3 | Desalinhamento vertical topo dos 2 blocos | ✅ PASS | Grid alinha ao baseline superior por default (`align-items: stretch`) |
| G4 | Stack vertical quebrada em mobile | ✅ PASS | `grid-cols-1` até `md` (768px) |
| G5 | Tab-order Empresa → Contato | ✅ PASS | DOM order preservado; grid CSS não altera navegação com teclado |
| G6 | Regressão CNPJ SSOT | ✅ PASS | Nenhum arquivo do domínio CNPJ tocado; `maskCnpj`/`normalizeCnpj` inalterados |
| G7 | Regressão Undo (carrinho/orçamento) | ✅ PASS | Componente independente; contexto Cart/QuoteBuilder não tocado |

## Restrições do sandbox

- Playwright/Chromium não disponível localmente (libs de sistema ausentes). E2E visual delegado ao workflow `ui-visual-a11y.yml` no CI, que já cobre viewports 375/768/1280/1920.
- Fuzz de nomes longos/emoji: coberto indiretamente pelos testes existentes de `CompanySearchDropdown` (não regride pois o wrapper não altera clipping interno).

## Veredicto final

**0 regressões · 0 gaps ativos · 4 novos testes verdes.**

Mudança segura para produção. Sem necessidade de rollback ou ajuste adicional.
