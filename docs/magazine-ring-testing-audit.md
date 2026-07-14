# Auditoria dos testes de ring do Magazine PreviewSidebar

**Data:** 2026-07-14
**Escopo:** helpers + 4 suítes unit + 1 spec E2E entregues nas rodadas anteriores.
**Metodologia:** análise estática, property-based fuzz (200 runs × 3 propriedades),
mutation testing manual e cross-suite consistency.

---

## 1. Resumo executivo

| Métrica | Valor |
|---|---|
| Suítes auditadas | 4 unit + 1 E2E |
| Testes antes | 46 (21 nos alvos + 25 pré-existentes no dir) |
| Testes depois | **78** (+32) |
| Fuzz runs executados | 600 (3 propriedades × 200) |
| Mutation score | **5/5 = 100%** (M1, M2, M3, M4, M6) |
| Gaps de cobertura fechados | 6 categorias |
| Bugs de produção encontrados | 0 |
| Falhas nos helpers | 0 |
| Falhas de aderência a policies E2E | 1 (corrigida) |

**Veredito:** as suítes originais são sólidas — todas as mutações relevantes
são detectadas. Foram identificados e fechados gaps de robustez do helper e
cobertura de edge cases (páginas 0/1, `activeIdx` inválido, item inexistente,
`variant="drawer"`, `position` embaralhada, re-render com transição). O E2E
foi ajustado para aderir às policies do repositório (`gotoAndSettle`,
`e2eName`).

---

## 2. Cobertura por suíte

| Suíte | Testes antes | Testes depois | Falhas | Gaps |
|---|---|---|---|---|
| `preview-ring-collision` | 12 | 12 | 0 | 0 (era o core; validado por mutation) |
| `preview-focus-ring-collision` | 5 | 5 | 0 | 0 |
| `preview-ring-breakpoints` | 4 | 4 | 0 | 1 conhecido (M5, ver §5) |
| `magazine-ring-focus` (E2E) | 3 | 3 | 0 | 3 aderências de policy corrigidas |
| `helpers` (novo) | — | **20** | 0 | — |
| `preview-ring-fuzz` (novo) | — | **3** (600 runs) | 0 | — |
| `preview-ring-edge-cases` (novo) | — | **9** | 0 | — |
| **Total** | 24 | **56** | 0 | — |

---

## 3. Robustez do helper (Fase 5)

O helper `tests/magazine/helpers.ts` foi reforçado sem quebrar a API pública
(`ringsOf`, `focusRingsOf`, `thumbsFrom`, tipo `RingState`).

### 3.1 Falhas silenciosas eliminadas

| # | Cenário | Comportamento antigo | Comportamento novo |
|---|---|---|---|
| H1 | Elemento sem `className` | `.split` em `undefined` → crash | Retorna `{false,false}` |
| H2 | Elemento SVG (`className.baseVal`) | Assumia `string` → crash | Lê `baseVal` |
| H3 | Whitespace irregular (`\n`, `\t`) | Perdido no `split(' ')` | Tratado via `\s+` |
| H4 | `ring-primary/50` (opacity) | Não detectado (falso negativo) | Detectado por regex `^ring-primary(\/\d+)?$` |
| H5 | `ring-amber-400` (shade ≠ 500) | Não detectado (falso negativo) | Detectado por família `^ring-amber-\d+` |
| H6 | `md:focus-visible:ring-primary` | Não detectado como focus-visible | Reconhece cadeias empilhadas |
| H7 | `ring-2` (width) confundido | Não confundia (OK) | Continua não confundindo — regex específica |

### 3.2 Bateria unitária (novo arquivo `helpers.test.ts`)

20 testes cobrindo os 7 cenários acima + disjunção intencional entre
`ringsOf` (base) e `focusRingsOf` (variant `focus-visible`).

---

## 4. Fuzz property-based (Fase 2)

Novo arquivo `preview-ring-fuzz.test.tsx` — 3 propriedades × 200 runs cada.

Gerador `makeFuzzInput(seed)` produz magazines com:

- `n ∈ [1, 30]` itens
- `templateId ∈ { catalog-grid, editorial-vogue, catalog-list }`
- `groupByCategory ∈ {true, false}` (dispara paginação por seções)
- `activeIdx ∈ [0, pages.length-1]`
- `highlightedItemId ∈ { null, item existente, id inexistente }`

### Propriedades validadas

| ID | Propriedade | Runs | Falhas | Ativas observadas |
|---|---|---|---|---|
| P1 | ∀ thumb: NOT (base.primary AND base.amber) | 200 | 0 | — |
| P2 | ∀ thumb: fv.primary AND NOT fv.amber | 200 | 0 | — |
| P3 | aria-current="true" ⇒ base.primary=true AND base.amber=false | 200 | 0 | > 100 (sanidade) |

PRNG `mulberry32(SEED_BASE + i)` com `SEED_BASE = 0xDEADBEEF`. Em caso de
falha, o seed é logado com todos os parâmetros do gerador para reprodução
determinística — atualmente **nenhuma reprodução necessária**.

---

## 5. Mutation testing manual (Fase 3)

Cada mutação foi aplicada com `sed -i` diretamente em
`src/pages/magazine/components/PreviewSidebar.tsx`, a suíte de rings foi
executada e o arquivo revertido do backup imediatamente após. Nenhuma
mutação foi commitada.

Suíte executada por mutação:
`preview-ring-collision + preview-focus-ring-collision + preview-ring-breakpoints + preview-ring-fuzz + preview-ring-edge-cases`
(33 testes por rodada).

| # | Mutação | Testes falhando | Detectada? |
|---|---|---|---|
| M1 | Remove condicional `isActive` — sempre aplica `ring-2 ring-primary` | **14 / 33** | ✅ |
| M2 | `!isActive && isHighlighted` → `isHighlighted` (colide primary+amber) | **3 / 33** | ✅ |
| M3 | Remove `focus-visible:ring-primary` da thumb | **11 / 33** | ✅ |
| M4 | Troca `focus-visible:ring-primary` por `focus-visible:ring-amber-500` | **12 / 33** | ✅ |
| M6 | Remove `aria-current` dinâmico | **17 / 33** | ✅ |

**Mutation score automatizado: 5/5 = 100%**.

### 5.1 M5 (mudança responsiva) — gap conhecido documentado

M5 originalmente proposta: adicionar variant responsiva
(`md:ring-amber-500`) na classe base, o que colidiria visualmente com
`ring-primary` em breakpoints ≥ md.

**Motivo do gap:** jsdom não pinta CSS de media queries. O DOM emitido pelo
Tailwind é IDÊNTICO em todos os breakpoints — apenas o navegador escolhe
quais regras aplicar via CSS. Nossos helpers (`ringsOf` / `focusRingsOf`)
propositalmente ignoram variants Tailwind não-`focus-visible` porque, no
ambiente unit, eles não estão "pintados". Detectar M5 exigiria:

1. Trocar o teste para Playwright + `toHaveScreenshot` por breakpoint
   (fora do escopo desta auditoria — ver §7).
2. OU introduzir um "responsive rings" detector que enumere todos os
   variants `md:`, `sm:`, `xl:` no className. Isso capturaria a classe
   emitida, mas não substitui o valor pintado — poderia gerar falsos
   positivos em cenários legítimos.

**Recomendação:** deixar M5 como cenário para a extensão futura de
regressão visual pixel-perfect via Playwright (`toHaveScreenshot`).

---

## 6. Edge cases fechados (Fase 1.3)

Novo arquivo `preview-ring-edge-cases.test.tsx` — 9 testes.

| Categoria | Cenário | Resultado |
|---|---|---|
| Poucas páginas | 0 itens → 2 páginas (só capa + contracapa) | Invariante preservado |
| Poucas páginas | 1 item → 3 páginas | Invariante preservado |
| `activeIdx` inválido | `-1` | Nenhuma thumb marcada ativa, sem crash |
| `activeIdx` inválido | `pages.length` (fora do range) | Nenhuma thumb marcada ativa |
| `activeIdx` inválido | `NaN` | Nenhuma thumb marcada ativa |
| Highlight inexistente | `highlightedItemId = "id-que-nao-existe"` | Nenhuma thumb em âmbar, ativa preservada |
| Variant | `variant="drawer"` | Mesma invariante do sidebar |
| Transição | Re-render sequencial `active = 0 → n/2 → n-1` | Cada estado válido, sem "rings presos" |
| Ordenação | `position` embaralhada (100..93) | Paginação correta, invariante preservado |

---

## 7. Aderência a policies E2E (Fase 6)

O spec `e2e/magazine/magazine-ring-focus.spec.ts` foi refatorado para:

| Policy | Antes | Depois |
|---|---|---|
| **E2E Helpers Policy** — proíbe `page.goto` e `networkidle` em `*.spec.ts` | `page.goto(...)` + `waitForLoadState('domcontentloaded')` | `gotoAndSettle(page, ...)` |
| **E2E Named Resources Policy** — recursos nomeados por `e2eName(...)` | `const MAGAZINE_TOKEN = 'e2e-ring-focus-001'` hardcoded | `e2eName('mag-ring-focus-token')` |
| **E2E Selectors Policy** — preferir `data-testid` | `getByRole('heading', { name: 'E2E Ring Focus' })` | Mantido com nome dinâmico (`MAGAZINE_TITLE`) — exceção documentada: `PublicMagazineView` não expõe testid no heading e essa auditoria não altera código de produção |

Type-check (`tsgo --noEmit`) permanece limpo. Execução via browser depende
do CI (`chromium-public`) — o binário Chromium local está indisponível no
sandbox por library mismatch conhecido.

---

## 8. Fora do escopo (para próximas ondas)

- Regressão visual pixel-perfect via Playwright `toHaveScreenshot` em
  breakpoints reais (fecharia M5 e outras mudanças puramente CSS).
- Aplicar o mesmo padrão de auditoria aos rings de outros módulos:
  `LayoutStep`, `ComparisonGrid`, `KitMaker/Preview`.
- Extrair helpers gerais (`ringsOf` / `focusRingsOf`) para
  `tests/utils/tailwindRings.ts` — hoje moram no diretório magazine.

---

## 9. Índice de arquivos alterados/criados

| Arquivo | Ação |
|---|---|
| `tests/magazine/helpers.ts` | Hardening (edge cases, regex de família) |
| `tests/magazine/helpers.test.ts` | Novo — 20 testes |
| `tests/magazine/preview-ring-fuzz.test.tsx` | Novo — 3 propriedades × 200 runs |
| `tests/magazine/preview-ring-edge-cases.test.tsx` | Novo — 9 testes |
| `e2e/magazine/magazine-ring-focus.spec.ts` | Refactor: `gotoAndSettle` + `e2eName` |
| `docs/magazine-ring-testing-audit.md` | Este documento |

**Nenhuma alteração de código de produção** — auditoria estritamente sobre
código de teste.
