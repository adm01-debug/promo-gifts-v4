# Validação exaustiva — `PdfGenerationDialog`

**Data:** 2026-07-05  
**Escopo:** aviso do header + botão "Gerar PDF" do footer (últimas 5 iterações de refino)  
**Persona:** Dev Sênior / DBA (foco em regressões, a11y, contraste, resiliência)

---

## Resumo executivo

| Métrica | Resultado |
|---|---|
| Erros TypeScript no arquivo | **0** (baseline global inalterado) |
| Testes novos criados | **13** (2 arquivos) |
| Testes novos passando | **13/13 ✅** |
| Regressão suite PDF | **131/131 ✅** |
| Contraste WCAG (warning sobre pílula) | **8.91:1** (AAA) |
| Contraste warning sobre card | **10.49:1** (AAA) |
| Fuzz `quoteNumber` 5–300 chars | **30/30 ok** (truncate + min-w-0 seguram) |

**Veredicto:** produção-safe. Nenhuma regressão, nenhum leak de layout, a11y reforçada.

---

## 1. Estática

- `tsgo --noEmit`: 0 erros novos em `src/components/quotes/PdfGenerationDialog.tsx`.
- Erros pré-existentes (NodeJS/process/RPC) permanecem estáveis fora deste arquivo — **não introduzidos** por esta iteração.
- Imports `Tooltip*` resolvem em `@/components/ui/tooltip` (shadcn/Radix).

## 2. Testes unitários (Vitest + RTL)

Novos arquivos:

1. `src/components/quotes/__tests__/PdfGenerationDialog.headerWarning.test.tsx` (6 testes)
   - Aviso renderiza só em `preview` com `role=status`, `aria-live=polite`, `aria-label`
   - Ícone `Info` é `aria-hidden`
   - Ambas variantes de texto presentes (mobile curta + desktop longa)
   - `truncate` + `min-w-0` no título impedem push da pílula
   - Coexiste com Badge "Rascunho" e vN
   - **Fuzz 30 quoteNumbers (5–300 chars)** sem quebrar render

2. `src/components/quotes/__tests__/PdfGenerationDialog.footerButton.test.tsx` (7 testes)
   - `aria-label` semântico
   - `min-h-11` (44px WCAG AAA tap target)
   - Padding responsivo (`px-5 sm:px-6 md:px-7`)
   - Estados `hover:brightness-110`, `active:scale-[0.98]`, `focus-visible:ring-2 ring-offset-2`
   - Tooltip Radix aparece no `focus` com copy correto
   - Ícone `aria-hidden`
   - Click aciona `generateProposalPDFv2`

## 3. Regressão

- `src/components/pdf/**` — **131/131 ✅** (não subiu 1 teste, não caiu 1)
- Snapshots do `ProposalSections` intactos.

## 4. Contraste (WCAG)

Cálculo em dark mode (`--card: 24 28% 6%`, `--warning: 38 100% 58%`):

| Combinação | Ratio | AA (4.5) | AAA (7) |
|---|---|---|---|
| warning texto sobre pílula (`warning/10` blended com card) | **8.91:1** | ✅ | ✅ |
| warning sobre card | 10.49:1 | ✅ | ✅ |
| warning sobre background | 11.01:1 | ✅ | ✅ |

## 5. A11y — checagens estáticas

- ✅ `role="status"` + `aria-live="polite"` no aviso (não interrompe SR)
- ✅ `aria-label` no botão (independe do texto visível)
- ✅ Ícones `aria-hidden`
- ✅ `focus-visible:ring-2` + `ring-offset-card` (evita halo invisível em fundo escuro)
- ✅ Tap target ≥ 44×44 (`min-h-11`) — critério WCAG 2.5.5
- ✅ `prefers-reduced-motion`: shimmer e glow desligam via CSS

## 6. Cenários adversariais cobertos

- Título gigante (100+ chars) → `truncate` + `min-w-0` isola pílula.
- 30 títulos aleatórios (5–300 chars) — render mantém heading.
- Coexistência Badge Rascunho + vN + pílula sem overflow.
- Ícone dentro do `<Button>` sem colidir com `TooltipTrigger asChild` (Radix ref OK).

## 7. Gaps conhecidos (fora do escopo desta iteração)

Não são regressões — são melhorias possíveis para próximos ciclos:

1. **Playwright visual regression** — não rodado (requer sessão auth + rota `/orcamentos/:id`); recomendado adicionar `e2e/flows/pdf-dialog.spec.ts` cobrindo 4 viewports.
2. **jest-axe** — projeto não tem dependência instalada; auditoria estática cobre os principais critérios, mas axe automatizado pegaria contraste de tooltip Radix em runtime.
3. **Tooltip long-press mobile** — Radix Tooltip não abre em touch; `aria-label` cobre SR, mas usuário mobile sighted não vê a descrição. Considerar `Popover` on-tap se necessário.
4. **`<style>` inline** — cada mount adiciona um `<style>` na subárvore; abrir/fechar 50x deixa 50 `<style>` órfãos até o dialog desmontar. Aceitável (só monta quando `stage='preview'`), mas migrar para classes utilitárias em `index.css` seria mais limpo.

## 8. Arquivos alterados/criados nesta validação

- ✅ `src/components/quotes/__tests__/PdfGenerationDialog.headerWarning.test.tsx` (novo)
- ✅ `src/components/quotes/__tests__/PdfGenerationDialog.footerButton.test.tsx` (novo)
- ✅ `qa/reports/pdf-dialog-validation.md` (este relatório)

Nenhum arquivo de produção foi tocado — apenas validação read-only + testes.
