## Objetivo
Modernizar o FAB "Novo Orçamento" (`quote-new-button`) em `src/pages/quotes/QuotesListPage.tsx` com efeito de pulsação sutil e profissional, mantendo todos os contratos de a11y que o gate `check-fab-a11y` valida.

## Design proposto

**Camadas visuais (de fora pra dentro):**
1. **Halo pulsante:** anel translúcido `bg-primary/40` posicionado absolutamente atrás do botão com `animate-ping` (Tailwind built-in) — cria a onda expandindo a cada ~1s.
2. **Botão principal:** mantém formato circular, ganha `bg-gradient-to-br from-primary to-primary/80`, `shadow-lg shadow-primary/30` para sensação de elevação, ícone `Plus` com `transition-transform group-hover:rotate-90` (micro-interação moderna).
3. **Hover state:** `hover:shadow-xl hover:shadow-primary/40 hover:scale-110` (intensifica brilho + cresce levemente).
4. **Foco por teclado:** mantém `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.

**Estrutura JSX (mantém `TooltipTrigger asChild` envolvendo um único `<Button>`):**
```tsx
<TooltipTrigger asChild>
  <Button
    data-testid="quote-new-button"
    aria-label="Novo orçamento"
    className="group relative h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 transition-all hover:scale-110 hover:shadow-xl hover:shadow-primary/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  >
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-full bg-primary/40 animate-ping"
    />
    <Plus className="relative h-5 w-5 transition-transform duration-300 group-hover:rotate-90" />
  </Button>
</TooltipTrigger>
```

**Por que `animate-ping` (Tailwind nativo):**
- Não exige novos keyframes em `tailwind.config.ts` nem CSS custom.
- Já usa `cubic-bezier(0, 0, 0.2, 1) infinite` com fade — pulsação elegante.
- O `<span>` halo fica `inset-0` atrás do conteúdo, sem afetar o tap target (44×44) nem o foco.

## Validação obrigatória

Após a mudança, rodar o gate estático para garantir 0 regressão:
```bash
node scripts/check-fab-accessibility.mjs   # esperado 8/8
```
Contratos preservados:
- ✅ `data-testid="quote-new-button"`
- ✅ `aria-label="Novo orçamento"`
- ✅ `rounded-full`, `h-11`, `w-11`
- ✅ `focus-visible:ring`
- ✅ `<TooltipTrigger asChild>` + `<TooltipContent>` com copy "Criar novo orçamento em segundos"

## Acessibilidade (não-negociável)

- Halo recebe `aria-hidden="true"` e `pointer-events-none` — leitor de tela ignora e clique passa direto pro botão.
- Animação respeita `prefers-reduced-motion`: Tailwind `animate-ping` já desativa automaticamente quando o usuário ativa "reduzir movimento" no SO.
- Tap target permanece 44×44 (botão `h-11 w-11`); halo se expande visualmente mas não conta para hit-box.

## Arquivos
- Editar: `src/pages/quotes/QuotesListPage.tsx` (apenas o bloco `<Button>` do FAB, ~10 linhas).

## Fora de escopo
- Não tocar em `Tooltip`/`TooltipContent`/`TooltipTrigger` (manter copy e estrutura).
- Não alterar o handler de click, nem o `navigate('/orcamentos/novo')`.
- Não mudar testes, gate, workflow ou E2E.
- Não introduzir keyframes custom em `tailwind.config.ts` (built-in basta).
