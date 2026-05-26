# 🔍 Design System Audit — Promo Gifts v4
**Data:** 25/05/2026  
**Auditor:** TIPROMO (Claude Agent)  
**Escopo:** `src/index.css`, `tailwind.config.ts`, `src/styles/brand-tokens.css`, `src/styles/design-polish.css`, `src/lib/theme-presets.ts`

---

## Resumo Executivo

| Severidade | Qtd | Status |
|-----------|-----|--------|
| 🚨 Crítico | 4 | ✅ Corrigido |
| 🔴 Alto | 4 | ✅ Corrigido |
| 🟡 Médio | 7 | ✅ Corrigido |
| **Total** | **15** | **✅ 15/15** |

---

## 🚨 CRÍTICOS

### BUG-01 — `--orange` aponta para AZUL (hue 217°)
- **Onde:** `src/index.css` › `:root { --orange: 217 91% 60%; }`
- **Por quê é crítico:** O sistema foi migrado de laranja para azul como cor primária, mas o alias `--orange` não foi atualizado. Qualquer componente usando `bg-orange`, `text-orange` ou `hsl(var(--orange))` recebe **azul**, não laranja. Os comentários ainda dizem "Orange Premium" criando confusão para desenvolvedores.
- **Impacto:** Todo código que usa as classes Tailwind `orange.*` ou o CSS var `--orange` tem comportamento incorreto.
- **Fix aplicado:** Tokens `--orange-*` e `--primary` agora são explicitamente os mesmos (217°/azul) com comentário que documenta o alias legado. Comentários "Orange Premium" atualizados para "Blue Premium".

### BUG-02 — Variáveis CSS ausentes no `:root` (14 grupos de tokens)
- **Onde:** `src/index.css` › bloco `:root`
- **Por quê é crítico:** Tokens usados em componentes, Tailwind config e utilitários CSS não existem no `:root`. Resultado: **quebra silenciosa** — componentes renderizam sem cor/padding/sombra/easing corretos antes do primeiro `applyThemePreset()`.

**Tokens faltando e efeito:**
```
--glass-bg, --glass-border (e variantes)  →  .glass, .glass-strong, .glass-card quebrados
--accent, --accent-foreground             →  bg-accent transparente no light mode
--chart-1 ... --chart-5                   →  gráficos recharts/chart.js sem cor
--cart, --cart-hover, --cart-foreground   →  botões do carrinho sem cor
--spacing-card, --spacing-card-sm, etc.   →  .card-base / .card-elevated SEM PADDING
--shadow-lg, --shadow-xl, --shadow-header →  Tailwind shadow-lg/xl e .card-lift:hover quebrados
--text-secondary, --interactive           →  variáveis sem valor default
--ease-smooth, --ease-spring              →  animações .card-lift / .stagger-item com easing errado
```
- **Fix aplicado:** Todos os 14 grupos de tokens acima adicionados ao `:root` com valores coerentes com o tema azul/blue premium.

### BUG-03 — `--sidebar-primary` diverge de `--primary` no `:root`
- **Onde:** `src/index.css` → `:root { --sidebar-primary: 24 100% 50%; }` vs `--primary: 217 91% 60%`
- **Por quê é crítico:** Sidebar renderiza laranja (hue 24°) enquanto todos os botões de ação primária renderizam azul (hue 217°). Inconsistência visual imediata perceptível como bug de branding.
- **Fix aplicado:** `--sidebar-primary` alinhado com `--primary` (217 91% 60%).

### BUG-04 — `--orange-*` ausentes de `CSS_VARS_TO_APPLY`
- **Onde:** `src/lib/theme-presets.ts` › array `CSS_VARS_TO_APPLY`
- **Por quê é crítico:** `applyThemePreset()` itera `CSS_VARS_TO_APPLY` para aplicar cores do preset ativo. `orange`, `orange-hover`, `orange-active`, `orange-glow`, `orange-foreground` **não estavam** na lista → **nunca atualizados** ao trocar de tema.
- **Fix aplicado:** 5 tokens `orange-*` adicionados ao array `CSS_VARS_TO_APPLY`.

---

## 🔴 ALTOS

### BUG-05 — `@keyframes` duplicados (6 animações × 2)
- **Onde:** `src/index.css`
- **Keyframes:** `nebulaDrift`, `starDrift`, `zigzagMovement`, `circularOrbit`, `shootingStar`, `rocketRising`
- **Impacto:** ~80 linhas de CSS redundante; segunda declaração sobrescreve a primeira com parâmetros ligeiramente diferentes (comportamento imprevisível).
- **Fix aplicado:** Primeira declaração removida em cada caso; mantida a versão final mais refinada.

### BUG-06 — `@keyframes shimmer` conflitante (2x, lógicas opostas)
- **Declaração 1** (global): `background-position: -200% → 200%` — anima propriedade CSS
- **Declaração 2** (dentro de `@layer components`): `transform: translateX(-100% → 100%)` — anima transform
- **Impacto:** `.animate-shimmer` usa `background-size: 200%` mas o keyframe ativo aplica `transform` — efeito de shimmer incorreto.
- **Fix aplicado:** Unificado em `background-position` (GPU-friendly, sem layout thrashing).

### BUG-07 — `.card-base` / `.card-elevated` sem padding
- **Causa:** `p-[var(--spacing-card)]` com `--spacing-card` indefinido → padding = 0
- **Fix:** Resolvido via BUG-02 (spacing tokens adicionados ao `:root`).

### BUG-08 — `.card-lift:hover` sem sombra premium
- **Causa:** `box-shadow: var(--shadow-xl)` com `--shadow-xl` indefinido → sem efeito
- **Fix:** Resolvido via BUG-02.

---

## 🟡 MÉDIOS

### BUG-09 — `--ease-smooth` e `--ease-spring` não definidos
- **Referências:** `.card-lift`, `.stagger-item`, `.animate-heart-fill`
- **Fix:** Adicionados ao `:root`:
  - `--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1)`
  - `--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1)` (idêntico ao `--ease-out` existente)

### BUG-10 — `font-weight` não-padrão (450, 550, 650, 850)
- **Impacto:** Requerem variable font. Se Plus Jakarta Sans falhar no carregamento → browser arredonda inconsistentemente entre browsers.
- **Fix:** Substituídos por valores padrão (400/500/600/700/800) com comentário.

### BUG-11 — Utilities duplicadas em dois arquivos
- **Classes:** `.hover-lift`, `.card-interactive`, `.touch-target`, `.scrollbar-thin`
- **Arquivos:** `src/index.css` + `src/styles/design-polish.css`
- **Impacto:** `design-polish.css` sem `@layer` → especificidade maior → sobrescreve `index.css` imprevisivelmente.
- **Fix:** `design-polish.css` convertido para `@layer utilities`.

### BUG-12 — `@media (prefers-reduced-motion)` declarado 2x
- **Fix:** Segunda declaração removida (~20 linhas de bundle desnecessário).

### BUG-13 — Animações `glow-pulse` e `pulse-glow` são no-ops
- **Causa:** Ambos os keyframes têm `box-shadow: none` em todos os stops (NO_ORANGE_GLOW_POLICY aplicada incorretamente às animações).
- **Impacto:** Loop de animation a cada 2s sem nenhum efeito visual. CPU desnecessário.
- **Fix:** Keyframes removidos; classes redirecionadas para `animate-pulse` Tailwind com opacity.

### BUG-14 — `--gradient-hero` hardcoded em hue 24° (laranja)
- **Onde:** `--gradient-hero: linear-gradient(135deg, hsl(24 100% 97%)...)` no `:root`
- **Impacto:** Hero banner com fundo levemente laranja independente do tema ativo.
- **Fix:** Substituído por tokens dinâmicos `hsl(var(--primary) / 0.04)`.

### BUG-15 — `--accent` ausente do `:root` (light mode)
- **Causa:** Definido apenas no `.dark`, não no `:root`
- **Fix:** Resolvido via BUG-02.

---

## 📊 Matriz de Impacto

```
BUG-01: Semantic confusion  → Todos os devs, componentes usando orange.*
BUG-02: Tokens faltando     → card-base, glass-*, charts, cart, spacing quebrados
BUG-03: Sidebar divergente  → Visível na UI (laranja vs azul na sidebar)
BUG-04: Theme not applied   → Troca de preset não funciona para orange-* tokens
BUG-05/06: Keyframes dup    → Bundle bloat + comportamento imprevisível
BUG-07: Zero padding        → Todos os cards sem padding interno
BUG-08: Sem hover shadow    → card-lift hover broken
BUG-09: Ease undefined      → Animações com easing incorreto
BUG-10: Font-weight         → Inconsistência dark mode sem variable font garantida
BUG-11: Utilities dup       → Especificidade imprevisível (design-polish vs index)
BUG-12: Media query dup     → Bundle bloat ~20 linhas
BUG-13: No-op animations    → CPU waste + UX sem feedback visual
BUG-14: Hero gradient       → Cor laranja hardcoded ignora o tema ativo
BUG-15: Accent light mode   → bg-accent transparente no light mode
```

---

## 🏗️ Arquitetura — Observações para Roadmap

1. **Fase 2 da migração orange→brand-primary** está pendente (documentado em `brand-tokens.css`). Próximo passo: sweep de `bg-orange-*` → `bg-brand-primary-*` em todos os componentes.
2. **`design-polish.css`** deveria ser deprecado — toda sua lógica está duplicada no `index.css`. Manter temporariamente com aviso `@deprecated`.
3. **19 theme presets** (10 classic + 9 GX) estão corretos; `buildPreset()` factory está correto. O único problema era o `CSS_VARS_TO_APPLY` incompleto (BUG-04).
4. **`design-policy.ts`** documenta "No Orange Glow Policy" sem testes automatizados. Recomendado: lint rule ou e2e assertion para impedir regressão.
5. **`--border` usa slash notation** (`24 100% 50% / 0.15`) — funciona no Tailwind JIT/PostCSS mas pode falhar em browsers antigos. Monitorar compatibilidade.

---

*Relatório gerado por análise estática do design system em 25/05/2026.*  
*PR: `fix/design-system-audit-2026-05-25`*
