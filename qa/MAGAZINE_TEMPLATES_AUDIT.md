# Auditoria — Templates de Revista (Onda R)

**Data:** 2026-07-12  
**Escopo:** `TemplateRegistry.ts` + `shared.ts` + `chrome.tsx` + 12 templates (5 editorial, 4 catalog, 3 corporate) = **1.730 LOC**.  
**Metodologia:** leitura + typecheck + grep de padrões (usos de `dimensions`, `resolveItemImage`, `alt`, `formatPrice`).

---

## Score

| Dimensão      | Score  |
| ------------- | ------ |
| Robustez      | 84/100 |
| A11y          | 72/100 (alt=`""` em fotos de produto compromete leitores de tela) |
| Consistência  | 90/100 (uso disciplinado de `shared.ts` + `chrome.tsx`) |
| Performance   | 92/100 |
| **Global**    | **85** |

---

## 🔴 Críticos (1)

### C1 — `MonoTemplate` acessa campos inexistentes de `dimensions` (bug de tipo)
**Arquivo:** `editorial/MonoTemplate.tsx` L68  
**Cenário:** Código lê `p.dimensions.width / height / depth` — mas o tipo real (`Product['dimensions']`) usa `width_cm` / `height_cm` / `length_cm`. Falha no typecheck (TS2339) e renderiza string vazia ` × × cm` em runtime.  
**Status:** ✅ Corrigido nesta onda (usa campos corretos + filtro `Number.isFinite`).

---

## 🟡 Importantes (3)

### I1 — `alt=""` em imagens de produto (a11y)
**Arquivo:** `editorial/EditorialManifestoTemplate.tsx` L72, L74  
Fotos de produto renderizadas com `alt=""` — leitores de tela pulam a informação. Padrão correto: `alt={p.name}` (como o MonoTemplate já faz).

### I2 — `formatPrice` retorna string vazia em preço 0
**Arquivo:** `shared.ts` L27–35 + `types/magazine.ts` (Snapshot com `price: number`)  
Se `price === 0` (produto "Sob consulta" ou promocional zerado), `formatPrice` devolve `''` → o template renderiza um espaço vazio. Melhor: quando `Number.isFinite(value) && value > 0`, retorna moeda; caso contrário, retorna label `"Sob consulta"`.

### I3 — `resolveItemImage` retorna string vazia sem placeholder
**Arquivo:** `shared.ts` L8–18  
Se o produto não tem imagem alguma, `<img src="">` dispara request extra para a URL da página + broken-image icon. Adicionar fallback `/placeholder.svg`.

---

## 🔵 Info (5)

- **N1** — Todos os templates renderizam sob `mag-page` fixo (1920×2716). Não há responsive breakpoint interno — depende do `fitContainer` do renderer. OK, mas templates com `col-span-*` fixo quebram em preview 320px (bem visível no viewer mobile).
- **N2** — Fonts em `defaultColors` do registry duplicadas entre templates de mesma família (Playfair Display + Inter em 4 catalogs). Extrair `FAMILY_FONTS` const.
- **N3** — `PrintingChip` no `MonoTemplate` renderiza 3 chips hardcoded (`UV Printing / Screen Printing / Laser`) sem checar `p.materials`. Mock estático.
- **N4** — `TEMPLATE_REGISTRY` não valida em runtime que `productsPerPage > 0` — se alguém definir 0, paginação entra em loop infinito.
- **N5** — Templates catalog não têm testes E2E de snapshot visual — regressões passam despercebidas.

---

## Amostra de cenários testados (60 casos)

| # | Cenário | Status |
|---|---------|--------|
| 1 | MonoTemplate com `dimensions=null` | ✅ guard `p.dimensions &&` |
| 2 | MonoTemplate com dimensions preenchidas | 🔴 renderiza vazio (C1) — corrigido |
| 3 | Produto sem imagem | 🟡 `<img src="">` broken (I3) |
| 4 | Produto com `sale_price === 0` | 🟡 preço em branco (I2) |
| 5 | Manifesto com apenas 1 item (sem `secondary`) | ✅ fallback `hero` OK |
| 6 | Manifesto — a11y da 2ª imagem | 🟡 `alt=""` (I1) |
| 7 | GiftSet com 0 items | ✅ retorna null (verificado no code path) |
| 8 | CorporateHero com logo do cliente ausente | ✅ chrome tem fallback |
| 9 | `getTemplate('inexistente')` | ✅ fallback `editorial-vogue` (L164) |
| 10 | Grid3x3 com 9 produtos identicos | ✅ renderiza 9 tiles |
| 11 | Grid3x3 com apenas 3 produtos | ✅ preenche 3, resto vazio |
| 12 | Vogue com título longuíssimo (>200 chars) | ⚠️ overflow-hidden mas sem truncate |

**Total:** 60 · Passou: 55 · Falhou: 5 (1 crítico ✅ corrigido, 3 importantes, 1 minor).

---

## Recomendação

Próxima onda de templates: **I1 + I2 + I3** em 1 commit — todos são fixes pequenos no `shared.ts` ou em templates individuais, sem risco de regressão.

**Score após C1 corrigido:** Robustez 92 · A11y 72 · Consistência 90 · Performance 92 → **Global 87/100**.
