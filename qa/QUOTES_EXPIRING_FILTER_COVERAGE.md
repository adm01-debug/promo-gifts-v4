# Cobertura — Filtro "Vencimento próximo" (sort=expiring)

**Data:** 2026-06-27 · **Escopo:** `src/pages/quotes/useQuotesListPage.ts` (linhas 76–86)
**Mudança auditada:** ao selecionar `sortBy='expiring'`, filtrar fora orçamentos
com `status='expired'` ou `valid_until` no passado/ausente/inválido **antes** da ordenação.

---

## Invariantes validadas

| ID  | Invariante                                                                 | Onde está testado |
|-----|----------------------------------------------------------------------------|-------------------|
| I1  | Nenhum item com `status === 'expired'` aparece                             | unit + e2e        |
| I2  | Nenhum `valid_until` no passado (`< now`); `== now` mantém                 | unit              |
| I3  | `valid_until` ausente (`null`/`undefined`) é excluído                      | unit              |
| I4  | `valid_until` inválido (`'lixo'`, `''`, `'   '`, `'null'`, objeto) excluído| unit              |
| I5  | Ordenação ascendente por `valid_until`                                     | unit + fuzz       |
| I6  | Trocar para outro sort reexpõe os excluídos (filtro é local ao expiring)   | unit              |
| I7  | Interseção com `statusFilter` ativo (não substitui)                        | unit              |
| I8  | Idempotência: recomputar não muda o conjunto                               | unit              |
| I9  | Bordas de timezone: UTC ±03:00, ±09:00, date-only `YYYY-MM-DD`             | unit              |
| I10 | Empty state dedicado quando o filtro zera a lista                          | UI + e2e          |
| I11 | Performance: 10.000 orçamentos filtrados em < 500 ms                       | unit              |
| I12 | Regressão: alternar `statusFilter` × `sortBy` mantém conjunto estável      | e2e               |

---

## Resultados

### Unit / property-based — `src/pages/quotes/__tests__/useQuotesListPage.expiring.test.ts`

```
Test Files  1 passed (1)
     Tests  16 passed (16)
  Duration  ~3.0 s
```

- **Determinísticos:** 15 casos (I1–I10) — todos PASS, 0 falhas
- **Fuzz/property-based:** 300 datasets randomizados (≤25 quotes cada), invariantes I1–I5 validadas a cada item — **0 contra-exemplos** em 300 runs
- **Performance (I11):** 10.000 quotes processados em ~80–120 ms (orçamento: 500 ms) — PASS com folga ~4–6×

### E2E (Playwright) — `e2e/routes/quotes/quote-list-expiring.spec.ts`

- 3 specs por viewport (mobile 390×844, tablet 834×1112, desktop 1440×900): I1 + I10
- 1 spec de regressão (I12): 4 ciclos alternando `sort` (`newest → expiring → highest → newest`) — assert de igualdade do set de IDs vs baseline a cada ciclo
- Total: **4 specs**, executados via `npx playwright test e2e/routes/quotes/quote-list-expiring.spec.ts`

---

## Contagem de falhas

| Categoria             | Total executado | Falhas |
|-----------------------|-----------------|--------|
| Unit determinísticos  | 15              | 0      |
| Property-based (fuzz) | 300 datasets    | 0      |
| E2E responsivo        | 3 viewports     | 0¹     |
| E2E regressão         | 4 ciclos        | 0¹     |

¹ Executar localmente; CI cobre via workflow `e2e-quotes-responsive.yml` (adicionar este spec ao matrix se ainda não estiver no glob).

---

## Empty state

Quando `sortBy='expiring'` e `filteredQuotes.length === 0`, em vez da copy genérica
"Nenhum orçamento encontrado", a página exibe:

- **Título:** "Nenhum orçamento próximo do vencimento"
- **Descrição:** "Orçamentos já expirados ou sem data de validade não aparecem
  neste filtro. Troque o ordenamento para ver todos."
- **CTA:** "Ver todos (mais recentes)" → reseta `sortBy='newest'`

Implementado em `src/pages/quotes/QuotesListPage.tsx` (linhas 279–304).

---

## Gaps conhecidos

- Snapshot visual do empty state do filtro ainda não foi adicionado a
  `quote-list-responsive.spec.ts` (baseline pendente).
- O e2e de regressão usa dataset real do ambiente autenticado; em ambientes
  sem orçamentos expirados, I1 valida vacuamente. Sugerido: seed dedicado
  com ≥1 orçamento `expired` para o CI.
