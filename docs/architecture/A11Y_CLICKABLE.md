# A11Y Clickable — SSOT de divs clicáveis

**Regra:** todo elemento não-nativo (`<div>`, `<span>`, `motion.div`) que reage a clique DEVE usar `<Clickable>` de `@/components/shared/Clickable` em vez de duplicar `role`/`tabIndex`/`onKeyDown` inline.

## Por quê

- WCAG 2.1.1 (Keyboard) — usuário de teclado precisa acionar por Enter/Space.
- Consistência do foco visível (mesmo ring `ring-primary/60` em todo o app).
- Um único ponto para corrigir bugs de a11y (evita 68 locais duplicados).

## Uso

```tsx
import { Clickable } from '@/components/shared/Clickable';

<Clickable onClick={onNavigate} isSelected={selected}>
  Card conteúdo
</Clickable>
```

### API

| Prop | Default | Descrição |
|---|---|---|
| `onClick` | — | Handler unificado (mouse + Enter/Space). |
| `as` | `div` | Elemento renderizado (aceita `motion.div`, `span`, etc.). |
| `disabled` | `false` | Bloqueia click + teclado + aplica `cursor-not-allowed` + `tabIndex=-1`. |
| `strictTarget` | `false` | Só dispara teclado quando `e.target === e.currentTarget` (útil quando há elementos focáveis internos). |
| `role` | `button` | Override para `link`, `menuitem`, `tab`, etc. |
| `isPressed` / `isSelected` / `isExpanded` | — | Reflete estado via `aria-pressed`/`aria-selected`/`aria-expanded`. |
| `showFocusRing` | `true` | Aplica ring padrão; passe `false` se já houver ring custom. |

## O que NÃO usar

```tsx
// ❌ Duplicação — vira dívida de a11y
<div role="button" tabIndex={0} onClick={fn} onKeyDown={(e) => {...}}>

// ❌ Elemento nativo perdido — use <button> se for realmente um botão
<div onClick={fn}>
```

## Gate

Toda nova PR que introduzir `<div ... onClick={...}>` fora de `Clickable` DEVE:
1. Trocar por `<button>` nativo (preferido); OU
2. Usar `<Clickable>`.

Auditoria estática identificou **68 ocorrências** legadas — refatorar em ondas conforme os arquivos forem tocados. Módulos priorizados: `categories/`, `collections/`, `products/customization/`.

## Referências

- WCAG 2.1.1: https://www.w3.org/WAI/WCAG21/Understanding/keyboard.html
- Rule ARIA button: https://www.w3.org/TR/wai-aria-practices/#button

## Histórico de refatorações

- **Onda 1 (2026-07-15)** — Baseline 30 → 26. Refatorados: `pages/magazine/MagazineListPage.tsx`, `pages/products/CartsListPage.tsx`, `pages/quotes/QuotesDashboardPage.tsx`, `pages/trends/TrendsCharts.tsx`. Extensão paralela em `Clickable` para encaminhar atributos `data-*` extras (preserva hooks E2E como `data-selected`).
- **Onda 2 (2026-07-15)** — Baseline 26 → 22. Refatorados: `components/collections/CollectionGridCard.tsx` (motion.div + strictTarget + aria-pressed), `components/products/ProductCard.tsx` (thumbnail QuickView), `components/products/ProductListItem.tsx` (thumbnail QuickView), `components/products/table-view/ProductTableRow.tsx` (thumbnail QuickView). Extensão adicional em `Clickable` para encaminhar atributos `aria-*` arbitrários (preserva `aria-haspopup`).
