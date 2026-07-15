# A11Y Clickable — SSOT de divs clicáveis

**Regra:** todo elemento não-nativo (`<div>`, `<span>`, `motion.div`) que reage a clique DEVE usar `<Clickable>` de `@/components/shared/Clickable` em vez de duplicar `role`/`tabIndex`/`onKeyDown` inline.

## Por quê

- WCAG 2.1.1 (Keyboard) — usuário de teclado precisa acionar por Enter/Space.
- Consistência do foco visível (mesmo ring `ring-primary/60` em todo o app).
- Um único ponto para corrigir bugs de a11y (evita 68 locais duplicados).

## Uso básico

```tsx
import { Clickable } from '@/components/shared/Clickable';

<Clickable onClick={onNavigate} aria-label="Abrir coleção">
  Card conteúdo
</Clickable>
```

### API

| Prop | Default | Descrição |
|---|---|---|
| `onClick` | — | Handler unificado (mouse + Enter/Space). Recebe `MouseEvent \| KeyboardEvent`. |
| `as` | `div` | Elemento renderizado. Aceita `motion.div`, `span`, `article`, componente forwardRef (`Card`, etc.). |
| `disabled` | `false` | Bloqueia click + teclado; aplica `cursor-not-allowed`, `opacity-60`, `pointer-events-none`, `tabIndex=-1`, `aria-disabled`. |
| `strictTarget` | `false` | Teclado só dispara quando `e.target === e.currentTarget`. Use quando houver filhos focáveis (inputs, links, `SelectionCheckbox`) para evitar duplo trigger em Enter/Space. |
| `role` | `button` | Override para `link`, `menuitem`, `tab`, `option`, etc. |
| `isPressed` / `isSelected` / `isExpanded` | — | Reflete estado via `aria-pressed` / `aria-selected` / `aria-expanded`. |
| `showFocusRing` | `true` | Aplica ring padrão (`ring-primary/60`). Passe `false` se o `className` já tem ring custom para evitar dupla borda. |
| `tabIndex` | `0` (ou `-1` se `disabled`) | Override para foco programático. |
| Props `data-*`, `aria-*`, HTML nativos, motion (`layout`, `initial`, `animate`, `transition`), `style` | — | Encaminhados ao elemento renderizado. |

## Exemplos reais (SSOT do padrão)

### 1. Card animado com seleção (`motion.div` + `isPressed` + `strictTarget`)

Usado em `CollectionGridCard`, `CollectionListItem`, `ProductCard`. `strictTarget` evita que o Enter num filho focável (menu, checkbox) redispare a navegação.

```tsx
import { m as motion } from 'framer-motion';

<Clickable
  as={motion.div}
  layout
  initial={{ opacity: 0, y: 16 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.03, type: 'spring', stiffness: 380, damping: 28 }}
  strictTarget
  isPressed={isSelected}
  showFocusRing={false}                          // ring custom no className
  aria-label={`Coleção ${collection.name}`}
  data-testid="collection-card"
  className={cn(
    'group rounded-2xl border bg-card transition-all focus-visible:ring-2 focus-visible:ring-primary/60',
    isSelected && 'border-primary ring-2 ring-primary/25',
  )}
  onClick={onNavigate}
>
  {/* filhos com stopPropagation isolam ações internas */}
  <div onClick={(e) => e.stopPropagation()}>
    <SelectionCheckbox checked={isSelected} onChange={onToggle} />
  </div>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button aria-label="Mais opções" onClick={(e) => e.stopPropagation()}>…</Button>
    </DropdownMenuTrigger>
    …
  </DropdownMenu>
</Clickable>
```

**Regras aplicadas:**
- `strictTarget` — Enter/Space dentro do dropdown ou checkbox NÃO dispara `onNavigate`.
- `onClick={(e) => e.stopPropagation()}` em filhos com ação própria — bloqueia bubbling de **mouse**.
- Um `aria-label` descritivo — a ação semântica é única.

### 2. Elemento semântico customizado (`as="article"`)

Usado em `NoveltyGridCard`. Mantém a semântica de "artigo" para leitores de tela e ganha comportamento de botão.

```tsx
<Clickable
  as="article"
  data-testid="novelty-grid-card"
  aria-label={`Novidade: ${product.name}`}
  isPressed={isSelected}
  className={cn('group flex flex-col rounded-xl border bg-card p-3', isSelected && 'ring-2 ring-primary/20')}
  onClick={() => onSelect(product.id)}
>
  {…}
</Clickable>
```

### 3. Wrapper de shadcn (`as={Card}`)

Usado em `NoveltiesSection`. Componentes shadcn com `forwardRef` funcionam sem alteração — o ref e `className` são encaminhados.

```tsx
import { Card, CardContent } from '@/components/ui/card';

<Clickable
  as={Card}
  aria-label={`Ver ${item.name}`}
  className="group overflow-hidden hover:-translate-y-1"
  onClick={() => navigate(`/produto/${item.id}`)}
>
  <CardContent className="p-0">{…}</CardContent>
</Clickable>
```

### 4. Ação com `stopPropagation` (thumb dentro de card)

Usado em `QuickViewThumb`. O thumb abre um QuickView e NÃO deve disparar a navegação do card pai. Como `Clickable` invoca o `onClick` para mouse **e** teclado, basta chamar `e.stopPropagation()` uma vez:

```tsx
<Clickable
  aria-label={`Visualização rápida de ${name}`}
  data-testid={testId}
  showFocusRing={false}
  className={cn('cursor-zoom-in', className)}
  onClick={(e) => {
    e.stopPropagation();               // bloqueia mouse E teclado
    openQuickView();
  }}
>
  {children}
</Clickable>
```

### 5. `role` semântico (`link`, `menuitem`, `tab`)

```tsx
<Clickable role="link" onClick={() => navigate('/produtos')} aria-label="Ver produtos">…</Clickable>
<Clickable role="tab" isSelected={activeTab === 'geral'} onClick={() => setTab('geral')}>Geral</Clickable>
```

### 6. Radix `asChild` — **NÃO** envolver com `<Clickable>`

Radix (`DropdownMenuTrigger`, `TooltipTrigger`, `PopoverTrigger`, `SelectTrigger` etc.) já injeta `role`, `aria-*`, `data-state` e handlers de teclado no filho via `asChild`. Envolver com `Clickable` **duplica** a11y e pode quebrar o merge de refs.

```tsx
// ✅ Padrão Radix
<DropdownMenuTrigger asChild>
  <Button variant="ghost" size="icon" aria-label="Mais opções">
    <MoreVertical className="h-4 w-4" />
  </Button>
</DropdownMenuTrigger>

// ✅ Se o filho precisa ser um span (regra do memory Radix Ref Standard):
<TooltipTrigger asChild>
  <span className="inline-flex" tabIndex={0}>
    <Icon />
  </span>
</TooltipTrigger>

// ❌ NÃO faça isso — Radix já cuida da a11y
<DropdownMenuTrigger asChild>
  <Clickable onClick={…}>…</Clickable>
</DropdownMenuTrigger>
```

## Regras de uso — evitar gaps

1. **Uma ação semântica por Clickable.** Se o mesmo elemento tem duas ações (ex.: "abrir card" + "abrir menu"), a segunda vira `<button>` filho com `stopPropagation`, não outro Clickable aninhado.
2. **Filhos focáveis** (inputs, links, botões, checkboxes) → sempre combinar `strictTarget` no pai + `stopPropagation` nos filhos. Sem `strictTarget`, Enter dentro do checkbox dispara o card.
3. **`aria-label` obrigatório** quando o conteúdo visível não descreve a ação (ex.: só imagem, só ícone).
4. **`showFocusRing={false}`** quando o `className` já define `focus-visible:ring-*`. Evita duplo ring.
5. **Não use `<Clickable>` como `<button>` real** — se é um botão puro sem layout/motion, use `<Button>` (shadcn) ou `<button>`.
6. **Não aninhe Clickables interativos.** Um Clickable dentro de outro Clickable = dois `role="button"` sobrepostos, leitor de tela quebra. Use `<button>` filho + `stopPropagation`.
7. **Motion props** (`layout`, `initial`, `animate`, `transition`, `whileHover`, `variants`) — passam direto quando `as={motion.div}`.
8. **Componentes com `forwardRef`** (shadcn `Card`, `Alert`, etc.) funcionam como `as={Componente}`. Componentes function sem forwardRef **não** — aparece warning `Function components cannot be given refs`.
9. **`disabled` desativa tudo** — não precisa duplicar `aria-disabled` ou `pointer-events-none` no className.
10. **Testes E2E** — preserve `data-testid` no `Clickable` (não em filho), porque o `role="button"` fica no wrapper.

## O que NÃO usar

```tsx
// ❌ Duplicação — vira dívida de a11y
<div role="button" tabIndex={0} onClick={fn} onKeyDown={(e) => { if (e.key === 'Enter') fn(); }}>

// ❌ Elemento nativo perdido — use <button> se for realmente um botão sem layout custom
<div onClick={fn}>

// ❌ Clickable aninhado
<Clickable onClick={outer}>
  <Clickable onClick={inner}>…</Clickable>
</Clickable>

// ❌ Clickable como trigger de Radix asChild
<PopoverTrigger asChild>
  <Clickable>…</Clickable>
</PopoverTrigger>

// ❌ Sem aria-label em conteúdo não-textual
<Clickable onClick={openImage}>
  <img src={thumb} alt="" />
</Clickable>
```

## Gate

Toda PR que introduzir `<div|span|article|... role="button">` fora de `<Clickable>` falha no CI (`scripts/check-clickable-drift.mjs`). Alternativas aceitas:
1. Trocar por `<button>` nativo (preferido para ações puras); OU
2. Usar `<Clickable>` (para elementos com layout/motion/semântica não-botão).

Baseline atual: **18 legados** — refatorar em ondas conforme os arquivos forem tocados.

## Referências

- WCAG 2.1.1: https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html
- WAI-ARIA Authoring Practices — Button: https://www.w3.org/WAI/ARIA/apg/patterns/button/
- Radix `asChild`: https://www.radix-ui.com/primitives/docs/guides/composition
- Memory `mem://ui/radix-nesting-ref-standard` — Radix `asChild` + span inline-flex.

## Histórico de refatorações

- **Onda 1 (2026-07-15)** — Baseline 30 → 26. Refatorados: `pages/magazine/MagazineListPage.tsx`, `pages/products/CartsListPage.tsx`, `pages/quotes/QuotesDashboardPage.tsx`, `pages/trends/TrendsCharts.tsx`. Extensão paralela em `Clickable` para encaminhar atributos `data-*` extras (preserva hooks E2E como `data-selected`).
- **Onda 2 (2026-07-15)** — Baseline 26 → 22. Refatorados: `components/collections/CollectionGridCard.tsx` (motion.div + strictTarget + aria-pressed), `components/products/ProductCard.tsx` (thumbnail QuickView), `components/products/ProductListItem.tsx` (thumbnail QuickView), `components/products/table-view/ProductTableRow.tsx` (thumbnail QuickView). Extensão adicional em `Clickable` para encaminhar atributos `aria-*` arbitrários (preserva `aria-haspopup`).
- **Onda 3 (2026-07-15)** — Baseline 22 → 18. Refatorados: `components/collections/CollectionListItem.tsx` (motion.div + strictTarget + isPressed), `components/novelties/NoveltyCards.tsx` (article via `as="article"`), `components/novelties/NoveltiesSection.tsx` (Card shadcn via `as={Card}`), `components/products/QuickViewThumb.tsx` (div com stopPropagation preservada). Ampliação em `Clickable` para encaminhar props arbitrárias (motion `layout`/`initial`/`animate`/`transition`, HTML attrs), corrigindo perda silenciosa de animações em call-sites `as={motion.div}`.
