# Regressão — Preço read-only em Itens de Orçamento

Checklist usado após remover o `<input>` editável de `unit_price` no
`QuoteItemsList` / `QuoteItemEditorSheet`. Garante que nenhum cálculo,
persistência ou integração foi afetado pela mudança puramente visual.

## 1. Cálculos derivados (client)

- [ ] **Subtotal por item** = `quantity * unit_price + Σ personalizations.total_cost`
      continua correto na lista do sheet (`QuoteItemRow`).
- [ ] **Total geral** no `QuoteBuilderSummaryColumn` reflete a soma dos
      subtotais (sem mudança vs. baseline antes do read-only).
- [ ] **Desconto** (`discountValue` % ou R$) aplica sobre o mesmo total.
- [ ] **Markup de negociação** (`negotiationMarkup`) infla o subtotal
      apresentado da mesma forma de antes.
- [ ] **Frete CIF** soma corretamente ao total final.

## 2. Persistência (Supabase)

- [ ] `quote_items.unit_price` salvo no INSERT mantém o valor vindo do catálogo
      (não é mais sobrescrito por edição manual).
- [ ] UPDATE de outros campos (`quantity`, `notes`, `personalizations`)
      continua funcionando para seller comum.
- [ ] UPDATE direto de `unit_price` por seller comum é **rejeitado** pelo
      trigger `trg_prevent_non_admin_quote_item_price_change` com
      `ERRCODE=42501` e mensagem "...somente leitura...".
- [ ] UPDATE de `unit_price` por `admin` / `supervisor` /
      `can_view_all_sales()=true` é permitido.

## 3. Auto-save

- [ ] `QuoteAutoSave` não dispara mais "alteração não salva" só por foco/blur
      no antigo `CurrencyInput` de preço (esse evento não existe mais).
- [ ] `hasUnsavedChanges` continua reagindo a `quantity`, `notes`,
      `personalizations`, condições comerciais.

## 4. UI / a11y

- [ ] `quote-item-price-display` visível e formatado em pt-BR (R$ NN,NN).
- [ ] `aria-label` contém "somente leitura" / "não editável".
- [ ] `title` explica origem do preço (catálogo).
- [ ] Tab order **pula** o preço (validado em `quote-item-editor-sheet-header.spec.ts`).
- [ ] Cursor `not-allowed` sobre o display.
- [ ] Layout Qtd/Preço/Subtotal em uma linha nos viewports 320/375/768/1024/1440.

## 5. Integrações

- [ ] Sincronização CRM (Bitrix/SalesPro) envia 4 casas decimais do
      `unit_price` original do banco (sem campo mutável no payload do cliente).
- [ ] PDF público (`quote-public-view`) renderiza o mesmo `unit_price`.
- [ ] Aprovação eletrônica não considera preço modificável.

## 6. e2e

- [ ] `quote-items-list-mobile-layout.spec.ts` — todos viewports + assert read-only.
- [ ] `quote-item-editor-sheet-header.spec.ts` — Tab order ignora preço.
- [ ] `quote-item-price-immutable.spec.ts` — UPDATE rejeitado pelo trigger.
- [ ] Snapshots `quote-items-list-inputs-row-*.png` regenerados via workflow
      `update-quote-reset-snapshots.yml` (snapshots antigos removidos do repo).

## 7. Rollback (se necessário)

Reverter requer:
1. `git revert` do commit da UI (restaura `CurrencyInput` + `onUpdatePrice`).
2. Migração `DROP TRIGGER trg_prevent_non_admin_quote_item_price_change ON public.quote_items;`
3. `DROP FUNCTION public.prevent_non_admin_quote_item_price_change();`

> Não fazer rollback sem decisão explícita do PO — a edição livre de preço
> é vetor de fraude conhecido.

## 8. Automação

- Execute `node scripts/qa-price-readonly-regression.mjs` para validar todos
  os itens estáticos deste checklist (testids, trigger, specs, snapshots
  antigos removidos). Sai com código 1 em qualquer regressão.
- Regeneração visual dos snapshots `quote-items-list-inputs-row-*.png`:
  dispare o workflow `.github/workflows/update-quote-reset-snapshots.yml`
  via `workflow_dispatch` (botão "Run workflow" no GitHub Actions). Não
  rode `playwright test --update-snapshots` localmente — o baseline oficial
  é o renderizado pelo CI.

