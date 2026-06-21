# ColorSwatch — SSOT de bolinhas de cor

> **Decisão de design (memorizada em `mem://design/color-swatch-ssot`)**
> O arquivo `src/components/shared/ColorSwatch.tsx` é o **único** ponto de
> alteração visual para bolinhas de cor em toda a plataforma. Qualquer
> mudança em borda, anel, slash de esgotado, grayscale, hover scale,
> gradiente de cor mista, etc. **deve ser feita exclusivamente lá**.

---

## API pública

```ts
import {
  ColorSwatch,
  getColorSwatchClasses,
  resolveSwatchBackground,
  MIXED_COLOR_RE,
  MIXED_COLOR_GRADIENT,
} from '@/components/shared/ColorSwatch';
```

### `getColorSwatchClasses(options)`

Retorna a string de classes Tailwind padronizada. **Não inclui tamanho** —
o caller aplica `h-* w-*` (presets do catálogo) ou `style={{ width, height }}`.

| Prop            | Default | Efeito visual                                                                 |
| --------------- | ------- | ----------------------------------------------------------------------------- |
| `isActive`      | `false` | `ring-primary` + glow + scale + z-10 (tem precedência sobre hover idle).      |
| `isOutOfStock`  | `false` | Slash diagonal via `::before` + `grayscale` + `opacity-40`.                   |
| `isUpcoming`    | `false` | `opacity-70` (sem slash). Suprimido quando `isOutOfStock=true`.               |
| `isInteractive` | `false` | Habilita `hover:scale` + `focus-visible:ring-ring` (uso em `<button>`).       |

### `resolveSwatchBackground(hex, name)`

- `hex` válido → cor sólida (string para `background-color`).
- Sem hex + nome casando `MIXED_COLOR_RE` (`color(ido)?|sortido|multi`) → `conic-gradient`.
- Caso contrário → `undefined` (caller aplica `border-dashed`).

### `<ColorSwatch />`

Primitiva **não-interativa** (`<span role="img">`) para legendas, chips e
células de tabela. Para botões clicáveis, use `ProductColorSwatches`
(catálogo/super filtro/novidades/reposição) ou monte seu próprio `<button>`
com `getColorSwatchClasses({ isInteractive: true })`.

```tsx
<ColorSwatch hex="#FFFFFF" name="Branco" isOutOfStock sizePx={28} />
```

---

## Consumidores autorizados

| Arquivo                                              | Uso                                                |
| ---------------------------------------------------- | -------------------------------------------------- |
| `src/components/products/ProductColorSwatches.tsx`   | Botões interativos (catálogo, novidades, reposição). |
| `src/components/inventory/VariantStockVisuals.tsx`   | `RichColorSwatch` — célula de tabela de estoque.   |

## Arquivos que **NÃO** devem conter regras visuais duplicadas

Os arquivos abaixo importam `ProductColorSwatches` ou `ColorSwatch` e
**não** podem reimplementar classes de borda, ring, slash, grayscale ou
gradiente de cor mista localmente:

- `src/components/replenishments/ReplenishmentCards.tsx`
- `src/components/replenishments/ReplenishmentProductGrid.tsx`
- `src/components/replenishments/VirtualizedReplenishmentGrid.tsx`
- `src/components/novelties/NoveltyCards.tsx`
- `src/components/novelties/VirtualizedNoveltyGrid.tsx`
- `src/components/products/ProductCard.tsx`
- `src/components/products/ProductListItem.tsx`
- `src/components/products/ProductTableView.tsx`
- `src/components/products/BaseProductGridCard.tsx`
- `src/components/inventory/VariantStockTable.tsx`
- `src/components/filters/ColorGroupFilter.tsx`
- `src/components/filters/InlineColorGroupFilter.tsx`

> **Revisor:** se um PR adicionar classes de swatch (`ring-primary`,
> `before:bg-[linear-gradient(45deg`, `grayscale`, `conic-gradient`) fora
> dos dois consumidores autorizados, **rejeite** e peça para usar o SSOT.

---

## Testes

Cobertura mínima em `src/components/shared/__tests__/ColorSwatch.test.tsx`:

- `resolveSwatchBackground`: hex válido, cor mista (Colorido/Sortido/Multi), fallback.
- `getColorSwatchClasses`: default, active, out-of-stock, upcoming, out+upcoming
  (out vence), interactive, interactive+active.
- `<ColorSwatch />`: backgroundColor, backgroundImage (conic), data-stock-state
  (in-stock/out/upcoming), fallback "Sem cor" + border-dashed, sizePx custom.
