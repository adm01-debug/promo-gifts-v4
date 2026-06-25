
# Aprovação de Desconto — 4 frentes

## 1. Mensagens de validação mais claras (UI)

**Arquivo:** `src/components/quotes/QuoteBuilderSummaryColumn.tsx`

- Logo abaixo do `CurrencyInput` de desconto, mostrar uma faixa de status (`role="status"`, `aria-live="polite"`) que muda conforme o estado real:
  - **Acima de 100% / inválido** (ex.: digitar `1000`): "Valor inválido — o desconto não pode ultrapassar **100%**. Ajuste para um valor entre 0 e 100." (vermelho).
  - **Acima do limite do vendedor** (`realDiscountPercent > maxDiscountPercent`): "Desconto real **{real}%** ultrapassa seu limite de **{max}%**. Clique em **Solicitar Aprovação** e justifique para enviar ao gestor comercial." (âmbar).
  - **Margem de Negociação desligada inflando o desconto real**: dica complementar quando `realDiscountPercent ≠ discount_percent` aparente, explicando que ativar a Margem reduz o desconto efetivo.
  - **Dentro do limite**: silencioso (ou verde discreto).
- Renomear/atualizar o tooltip `quote-discount-tooltip` para listar exatamente o que falta para habilitar "Solicitar Aprovação": (a) ter ao menos 1 item, (b) cliente selecionado, (c) justificativa preenchida ≥ 10 chars.
- Botão "Solicitar Aprovação" no `Dialog` passa a ter `disabled` baseado nesses 3 critérios, com lista de checklist visível no dialog.

**SSOT da mensagem:** novo módulo `src/lib/quotes/discount-validation-messages.ts` exportando `getDiscountValidationMessage({ raw, realPct, maxPct, hasMarkup })` para reuso em testes.

## 2. Testes automatizados do fluxo de alçada

**Arquivo novo:** `src/hooks/quotes/__tests__/discountApprovalFlow.test.ts`

Cobre 4 cenários, mockando `supabase.from('discount_approval_requests')`:

| # | Margem | Desconto digitado | maxPct | Esperado |
|---|---|---|---|---|
| 1 | OFF | 30% | 10% | save com `status='pending_approval'` + 1 INSERT em DAR |
| 2 | ON (markup 20%) | 30% aparente → real ≈ 16% | 10% | mesmo: 1 INSERT |
| 3 | ON forte (markup 50%) | 30% aparente → real negativo | 10% | NÃO cria DAR; save normal |
| 4 | OFF | 30% (clicar Salvar 2x rapidamente) | 10% | apenas 1 linha em DAR (dedup guard) |

Mais um teste de `discount-validation-messages` para a mensagem do `1000`.

## 3. Notificação ao gestor comercial

**Banco:** sem migration nova — usar tabela `workspace_notifications` já existente.

**Trigger novo** em `discount_approval_requests` (migration):
- `AFTER INSERT` quando `NEW.status = 'pending'`.
- Para cada usuário com role `admin` ou `comercial_manager` (via `user_roles` + `has_role`), insere uma linha em `workspace_notifications` com:
  - `type = 'discount_approval_requested'`
  - `title = 'Novo pedido de aprovação de desconto'`
  - `body` = "Vendedor {nome} solicitou {req%} (limite {max%})." + primeiras 140 chars de `seller_notes`.
  - `link = '/admin/usuarios?tab=discounts&request={dar.id}'`
  - `metadata` JSONB: `{seller_id, quote_id, quote_number, requested_pct, max_pct}`.

Como `workspace_notifications` já é consumida por polling (mem `workspace-notification-service-v2`), aparece em até 30s no sino.

**UI:** `DiscountManagementPanel` passa a ler `?request=<id>` e abrir o card destacado/scroll-into-view.

## 4. Auditoria detalhada das decisões

**Migration:** nova tabela `discount_approval_audit`:

```
id uuid pk
request_id uuid fk → discount_approval_requests on delete cascade
quote_id uuid
actor_id uuid (quem agiu: seller/admin)
actor_role text ('seller' | 'admin' | 'supervisor' | 'system')
event text CHECK in ('requested','approved','rejected','expired','superseded','cancelled')
requested_discount_percent numeric
max_allowed_percent numeric
real_discount_percent numeric       -- snapshot do efetivo no momento
admin_notes text
seller_notes text
metadata jsonb
created_at timestamptz default now()
```

- Index `(request_id, created_at desc)`, `(quote_id, created_at desc)`.
- GRANT padrão + RLS: SELECT para `can_view_all_sales()` OR `seller = auth.uid()` (via join); INSERT só via trigger (REVOKE direto).
- **Trigger** `AFTER INSERT OR UPDATE ON discount_approval_requests` que escreve linha de auditoria correspondente (requested no INSERT; approved/rejected no UPDATE com diff de status).

**UI no painel admin (`DiscountManagementPanel`)**: collapsible "Histórico" por solicitação listando as linhas de auditoria com timestamps, valores e notas.

**UI no orçamento (`QuoteBuilderSummaryColumn` + `QuoteViewPage`)**: badge "Aprovado por {admin} em {data}" quando há decisão final, com tooltip mostrando max/real/notes.

---

## Ordem de execução

1. SSOT de mensagens + UI de validação (1) + testes da mensagem.
2. Migration: tabela `discount_approval_audit` + trigger de auditoria + trigger de notificação.
3. UI admin (auditoria + deep-link `?request=`).
4. UI builder (badge de decisão).
5. Testes do fluxo de alçada (2).

## Pontos a confirmar

- **Role do gestor comercial**: usar `has_role(uid,'admin')` OR `has_role(uid,'supervisor')` OR `can_view_all_sales()`? Memória do projeto não nomeia um role `comercial_manager` — vou usar `can_view_all_sales()` como predicado (mesmo das policies da DAR) salvo objeção sua.
- **Tempo de retenção da auditoria**: manter indefinida (sem TTL)?
- Algum desses 4 itens é prioridade absoluta para começarmos primeiro, ou implemento na ordem acima de uma vez?
