# Validação exaustiva — `PdfGenerationDialog`

## Escopo do que foi alterado nas últimas iterações

1. Aviso "Confira as informações antes de enviar" movido do footer para o header, com `role="status"`, `aria-live="polite"`, `aria-label`, responsividade (`hidden sm:inline-flex`, texto curto/longo), efeito shimmer + glow via `<style>` inline, respeito a `prefers-reduced-motion`.
2. Botão "Gerar PDF" reduzido ~20% (`size="default"`, `text-sm`, `h-3.5 ícone`), com `min-h-11`, padding responsivo (`px-5 sm:px-6 md:px-7`), estados `hover:brightness-110`, `active:scale-[0.98]`, `focus-visible:ring-2 ring-offset-card`, e tooltip shadcn.
3. Footer com padding responsivo (`px-4 py-3 sm:px-6 sm:py-4`).

## Objetivo

Rodar uma bateria de checagens estática + runtime + snapshot + a11y + fuzz visual para caçar regressões, colisões, contraste ruim, leaks de animação e falhas de acessibilidade.

## Plano de validação (10 blocos)

### 1. Estática — TypeScript & lint
- `tsgo` sobre `src/components/quotes/PdfGenerationDialog.tsx` para garantir 0 erros de tipagem após import do `Tooltip*`.
- ESLint gate (baseline não pode subir).

### 2. Import health
- Confirmar que `Tooltip`, `TooltipContent`, `TooltipProvider`, `TooltipTrigger` existem em `@/components/ui/tooltip` e que `TooltipTrigger asChild` aceita `<Button>` sem quebrar a11y do Radix.
- Verificar que `Info` e `cn` continuam usados após diffs.

### 3. Testes unitários novos (Vitest + RTL)
Criar `PdfGenerationDialog.header-warning.test.tsx` cobrindo:
- Aviso renderiza somente quando `stage === 'preview'`.
- `role="status"` + `aria-label` presentes.
- Texto longo em `md+`, curto em `sm..md`, oculto em `<sm` (via `matchMedia` mock).
- Truncamento do título quando `quoteNumber` gigante (fuzz 30 strings 5–300 chars) não empurra a pílula (checar `min-w-0` + `truncate`).
- `pdfVersion > 1` e `isDraft` juntos não colidem com a pílula.

Criar `PdfGenerationDialog.footer-button.test.tsx` cobrindo:
- Botão tem `min-h-11` classe aplicada.
- Tooltip aparece em `hover`/`focus` com texto "Gera e baixa o PDF final da proposta".
- Click dispara `handleGenerate` (mockado via prop `onGenerate` — ver se existe injeção; se não, mock em `generateProposalPDFv2`).
- `aria-label` presente para leitores de tela.

### 4. Snapshot de contraste (reuso do `pdfContrastReport`)
- Rodar `src/components/pdf/proposal/__tests__/pdfContrastReport.test.ts` — o aviso não vai para o PDF exportado, mas garante que `--warning` continua ≥ AA sobre `--card`/`--background`.
- Adicionar caso: token `hsl(var(--warning))` sobre `hsl(var(--warning)/0.1)` (fundo da pílula) precisa passar AA (relação ≥ 4.5:1 para texto pequeno) — se falhar, subir opacidade da borda/texto.

### 5. A11y automatizada (jest-axe)
- Renderizar o dialog nas 3 stages (`preview`, `generating`, `ready`) e rodar `axe` esperando 0 violações.
- Especial atenção a: `aria-hidden` no ícone, contraste do tooltip, foco visível.

### 6. Fuzz de layout (Playwright headless)
- Roteiro `/tmp/browser/pdf-dialog/` que:
  1. Loga com sessão gerenciada.
  2. Navega para `/orcamentos/<id>` já usado (`573a7657-...`).
  3. Abre dialog, captura screenshots em 4 viewports: 360x640, 640x900, 1024x800, 1440x900.
  4. Verifica bounding box: pílula não sobrepõe close-button `×` (gap ≥ 8px), não sobrepõe título, botão footer não encosta na borda (margem ≥ 12px).
  5. Repete com 20 `quoteNumber` sintéticos (via `page.evaluate` mutando o `<DialogTitle>`) para simular strings longas.

### 7. Motion & reduced-motion
- Playwright com `context = browser.new_context(reduced_motion="reduce")` — screenshot da pílula: shimmer/glow devem estar ausentes (regra CSS já implementada).
- Sem `reduced_motion`: capturar 3 frames com intervalo 700ms e conferir que o pseudo-elemento se move (via `getComputedStyle` + `animationName === 'pdfWarnShimmer'`).

### 8. Interação do botão
- Playwright: `hover` → screenshot compara `box-shadow` mais forte que estado idle.
- `focus` via `Tab` → screenshot mostra `ring-2 ring-ring ring-offset-2`.
- `active` (mousedown) → screenshot mostra `scale(0.98)`.
- `Enter` no botão dispara download (`page.expect_download`).

### 9. Testes de regressão em snapshots existentes
- Rodar toda a suite `src/components/pdf/**` (131 testes) — deve continuar 131/131.
- Rodar suite `src/components/quotes/**` — não deve regredir.

### 10. Cenários adversariais
- `stage` alterna rápido `preview → generating → preview` (10x em 2s) via `act()` — não pode vazar timers do `<style>` nem duplicar `<style>` no `<head>` (efeito colateral de `<style>` inline em React: aceitável pois é subárvore, mas confirmar via `document.querySelectorAll('style').length` estável).
- Dialog abre/fecha 50x — memory leak de `blobUrlRef` (já mitigado pelo Bug #2), mas revalidar via `performance.memory.usedJSHeapSize` no console.
- `pdfVersion` sobe até 99, `isDraft=true`, `quoteNumber` = 100 chars: garantir wrap correto do header, sem overflow horizontal do dialog (`max-w-4xl`).

## Entregáveis
- 2 novos arquivos de teste em `src/components/quotes/__tests__/`.
- 1 script Playwright em `/tmp/browser/pdf-dialog/run.py` com 4 screenshots por viewport = 16 imagens de referência.
- Relatório consolidado em `qa/reports/pdf-dialog-validation.md` com contagem de checks, falhas encontradas, correções sugeridas.

## Detalhes técnicos

- Mocks necessários: `generateProposalPDFv2`, `downloadPDF`, `toast` (sonner), `matchMedia` (já em `src/test/setup.ts`).
- Contraste calculado via helper existente `getContrastRatio` em `src/components/pdf/proposal/__tests__/pdfContrastReport.test.ts`.
- Session Playwright: usar `LOVABLE_BROWSER_SUPABASE_*` (auth já injetada segundo padrão do projeto).
- Não modificar produção sem falha comprovada — este plano é **read + test**; qualquer fix vira commit separado.

## Fora de escopo

- Não alterar `PropostaComercialTailwind` (renderização do PDF em si).
- Não tocar em backend / RLS / migrations.
- Não subir baseline de ESLint nem `.toast-leaks-baseline.json`.
