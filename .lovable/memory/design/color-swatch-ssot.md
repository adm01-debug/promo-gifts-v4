---
name: ColorSwatch SSOT
description: src/components/shared/ColorSwatch.tsx é o ÚNICO ponto de alteração visual para bolinhas de cor em toda a plataforma (catálogo, novidades, reposição, estoque, filtros)
type: design
---

**Regra:** Qualquer mudança visual em bolinhas de cor (borda, ring de seleção,
slash diagonal de esgotado, grayscale, opacidade idle/hover, scale, gradiente
de cor mista, badge de reposição prevista) DEVE ser feita exclusivamente em
`src/components/shared/ColorSwatch.tsx`.

**API pública (SSOT):**
- `getColorSwatchClasses({ isActive, isOutOfStock, isUpcoming, isInteractive })` — classes Tailwind sem tamanho.
- `resolveSwatchBackground(hex, name)` — hex sólido | conic-gradient (Colorido/Sortido/Multi) | undefined.
- `<ColorSwatch hex name sizePx isActive isOutOfStock isUpcoming />` — primitiva span não-interativa.
- `MIXED_COLOR_RE` / `MIXED_COLOR_GRADIENT` — exportadas como tokens.

**Precedência de estados:**
1. `isOutOfStock` vence `isUpcoming` (slash + grayscale, suprime opacity-70).
2. `isActive` vence hover idle (`opacity-90` é omitido quando active=true).
3. `isInteractive` apenas adiciona hover/focus — não conflita com active/out.

**Consumidores autorizados (somente estes dois):**
- `src/components/products/ProductColorSwatches.tsx` — botões interativos (Catálogo, Super Filtro, Novidades, Reposição).
- `src/components/inventory/VariantStockVisuals.tsx` — `RichColorSwatch` (tabela de estoque).

**PROIBIDO** reimplementar localmente: `ring-primary` + `border-border/40`,
`before:bg-[linear-gradient(45deg…)]` (slash), `conic-gradient` para cor
mista, `opacity-40 grayscale` (esgotado) em qualquer outro arquivo. Revisor
deve rejeitar PR que violar.

**Testes:** `src/components/shared/__tests__/ColorSwatch.test.tsx` cobre
active, upcoming, out-of-stock, out+upcoming, interactive, interactive+active,
hex sólido, conic-gradient, fallback "Sem cor" + border-dashed, sizePx custom.

**Docs:** `docs/COLOR_SWATCH_SSOT.md` — API + lista de arquivos que não
podem conter regras visuais duplicadas.

**Validação visual:** rota `/estoque` é auth-gated; validação manual via
`/__test/color-swatches` (harness público) + screenshots em PR quando
mudar visuais.
