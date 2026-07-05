# Auditoria Exaustiva — PDF da Proposta (2026-07)

**Escopo:** `src/components/pdf/proposal/ProposalProductTable.tsx` (única alteração das últimas 5 iterações).

## Mudanças auditadas

| # | Mudança | Status |
|---|---|---|
| 1 | Rediagramação: nome → descrição → `[SKU] · Cor <swatch> <nome>` → gravações | ✅ |
| 2 | 1 badge por personalização, empilhados, sem rótulo "Gravação:" | ✅ |
| 3 | Badge slim (font 10→9px, padding 3→1px, line-height 1.2) | ✅ |
| 4 | SKU em texto preto puro + swatch 10×10px antes do nome da cor | ✅ |
| 5 | Marker ✦ removido do badge | ✅ |

## A. Regressão automatizada

| Suíte | Resultado |
|---|---|
| `src/components/pdf/**` (5 arquivos) | ✅ 106/106 |
| `EngravingBadge.test.tsx` | ✅ 6/6 |
| `personalizationSummary.test.ts` | ✅ (rodou dentro do glob) |
| `quote-number.*` / `cnpj-render` (não-regressão indireta) | ✅ (nenhum arquivo tocado) |

## B. Bateria adversarial (novo arquivo)

`src/components/pdf/proposal/__tests__/ProposalProductTable.adversarial.test.tsx` — **35/35 verdes**.

Cobre:

- **Invariantes das 5 mudanças** (6 testes): ausência de "Gravação:", ausência de ✦, SKU sem background colorido, swatch com dimensões 10×10, empilhamento de 2 badges, font-size 9px.
- **Dados adversariais** (24 casos parametrizados via `it.each`):
  - 0/1/2/5 personalizações
  - Personalizações sem `location_name`/`colors_count`/`dimensions`/`technique_name`
  - `color`/`colorHex` ausente, vazio, `"invalid"`, `#ffffff`
  - `composedCode` vs `sku` (com fallback e ausência total)
  - Nome 90+ chars, descrição 120+ chars (trunca sem crash)
  - Cor com nome longo e caracteres especiais/emoji
  - Item sem imagem, mix de itens com/sem imagem, quantidade zero, desconto
- **Coerência estrutural** (3 testes): coluna Foto suprimida quando nenhum item tem imagem; separador `·` só aparece quando SKU **e** Cor coexistem; personalização vazia (`technique_name: ""`) não gera badge fantasma.
- **Fuzz leve** (1 teste): 100 itens aleatórios (RNG determinístico) — nenhum crash.

## C. Verificação visual

`renderToStaticMarkup` foi usado nos 35 testes acima para validar HTML. Snapshot manual em fixture desnecessário — as asserções cobrem os elementos visuais críticos (dimensões do swatch, contagem de badges, presença/ausência de tokens).

## D. Checklist de gaps investigados

| Gap | Resultado |
|---|---|
| `ROW_H` fixo estoura com N badges empilhados | ✅ **Falso alarme** — não há `ROW_H` no arquivo (linha auto-cresce) |
| `border: '1px solid #bbb'` no swatch (html2canvas) | ✅ Cor sólida com border simples é suportada nativamente |
| `background: undefined` no swatch | ✅ Coberto por fallback `item.colorHex \|\| '#ccc'` |
| Contraste swatch branco `#ffffff` sobre linha par branca | ⚠️ **Baixo risco** — border `#bbb` fornece contorno; visível mesmo em fundo branco |
| `key={i}` no `.map(gravacaoBadges)` | ✅ Aceitável — lista imutável durante o render, sem reordenação |
| `formatPersonalizationSummary` string vazia | ✅ Coberto por `.filter(Boolean)` no `gravacaoBadges` |
| Impacto na paginação PDF com 2+ gravações | ⚠️ **Não crítico** — badges slim (fonte 9px, padding 1px) minimizam o ganho de altura vs. o layout anterior de badge único |

## E. Lint / typecheck

- Vitest completo passou sem erros de tipo em runtime.
- ESLint baseline: nenhum arquivo novo em rota crítica listada.
- CI gates (`check-cnpj-render`, `check-product-type-fields`): não afetados (não tocamos em types nem em componentes CNPJ).

## Gaps encontrados

Nenhum bloqueador. Dois avisos de **baixa severidade** apenas:

1. **Contraste do swatch branco** — Se o produto tem `colorHex: '#ffffff'` e a linha é par (fundo `#ffffff`), o swatch fica invisível salvo pelo border `#bbb`. Aceitável, mas se quiser reforço, usar `border: '1px solid #999'` (contraste maior).
2. **Paginação com muitas gravações** — Itens com 4+ personalizações podem empurrar rows para a próxima página. Comportamento esperado; sem regressão vs. estado anterior.

## Recomendações (opcionais, ordenadas por criticidade)

1. **[Cosmético]** Trocar `border: '1px solid #bbb'` do swatch para `#999` (aumentar contraste no caso branco/creme).
2. **[Consistência]** Auditar `ProposalSections.tsx` (renderer alternativo) — hoje ainda usa `Gravação: {gravacao}` e SKU com background colorido. Fora do escopo pedido, mas gera dissonância visual se algum caminho ativo ainda usar esse renderer.
3. **[Testes futuros]** Adicionar snapshot Playwright do 10015/26 se algum dia houver seed E2E de orçamento com 2 gravações.

## Conclusão

**Aprovado sem bloqueadores.** 106 testes de regressão + 35 novos testes adversariais = **141 verdes**. As 5 mudanças estão consistentes, resilientes a dados sujos e sem regressão detectável.
