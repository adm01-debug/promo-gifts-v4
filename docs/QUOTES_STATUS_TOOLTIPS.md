# Tooltips de status de orçamentos — SSOT

Última atualização: 2026-06-27.

Esta página documenta o mapeamento **status ↔ tooltip** usado em todo o módulo
`/orcamentos` (chips do topo, badges da tabela, página de detalhe) e como o
status `cancelled` é semeado no banco canônico — aceito pelo CHECK e inserível
desde que o INSERT inclua `organization_id` (exigência da RLS).

## 1. Fontes da verdade

| Camada | Arquivo | Papel |
|---|---|---|
| Enum FE | `src/types/quote.ts` (`QUOTE_STATUSES`) | Tupla canônica dos 10 status aceitos no FE + Zod guard |
| Badges/copy | `src/components/quotes/QuotesStatusChips.tsx` (`QUOTE_ROW_BADGE_STYLES`) | 14 chaves de badge (status + sub-estados de desconto) → label, classes, `description` (= tooltip) |
| Matchers de chip | mesmo arquivo (`QUOTE_CHIP_MATCHERS`) | Função booleana por chip do topo |
| Tooltips de chip | mesmo arquivo (`CHIP_TOOLTIPS`) | Mapa `chipKey → description` (reusa o campo `description` do badge) |
| Fallback | mesmo arquivo (`getChipTooltip` + `TOOLTIP_FALLBACK_COPY`) | Devolve copy genérica se a chave vier vazia/desconhecida |

> Toda alteração de texto **só pode** ser feita em `QUOTE_ROW_BADGE_STYLES`
> (badges) ou no objeto `CHIP_TOOLTIPS` (apenas para chaves de chip que não
> têm badge equivalente, como `all`). Nunca duplique copy em componentes.

## 2. Mapa atual (14 badges × 6 chips)

### Badges da linha (`QUOTE_ROW_BADGE_STYLES`)

| Chave | Origem (tuple BD) | Inserível? |
|---|---|---|
| `draft` | `status='draft'` | ✅ |
| `unsynced` | `status='pending' AND synced_to_bitrix=false` | ✅ |
| `synced` | `status='pending' AND synced_to_bitrix=true` | ✅ |
| `awaiting` | `status='pending_approval' AND discount_approval_status='pending'` | ✅ |
| `approved` | `discount_approval_status='approved'` | ✅ |
| `rejected` | `discount_approval_status='rejected'` | ✅ |
| `expired` | `status='expired'` | ✅ |
| `expired_discount` | `discount_approval_status='expired'` | ✅ |
| `sent` | `status='sent'` | ✅ |
| `viewed` | `status='viewed'` | ✅ |
| `quote_approved` | `status='approved'` | ✅ |
| `converted` | `status='converted'` | ✅ |
| `cancelled` | `status='cancelled'` | ✅ (requer `organization_id`; ver §3) |
| `quote_rejected` | `status='rejected'` | ✅ |

### Chips do topo (`CHIP_TOOLTIPS`)

| Chip | Tooltip vem de |
|---|---|
| `all` | copy própria ("Mostra todos os seus orçamentos…") |
| `draft` | `QUOTE_ROW_BADGE_STYLES.draft.description` |
| `unsynced` | `QUOTE_ROW_BADGE_STYLES.unsynced.description` |
| `created_synced` | `QUOTE_ROW_BADGE_STYLES.synced.description` |
| `pending_approval` | `QUOTE_ROW_BADGE_STYLES.awaiting.description` |
| `discount_approved` | `QUOTE_ROW_BADGE_STYLES.approved.description` |
| `discount_rejected` | `QUOTE_ROW_BADGE_STYLES.rejected.description` |
| `discount_expired` | `QUOTE_ROW_BADGE_STYLES.expired_discount.description` |
| `expired` | `QUOTE_ROW_BADGE_STYLES.expired.description` |

## 3. Por que `cancelled` é inserível no banco canônico

O CHECK de `quotes.status` no projeto canônico `doufsxqlfjyuvxuezpln` **já
aceita** `cancelled`. Verificado em 2026-06-27 via `pg_get_constraintdef`:

```sql
CONSTRAINT valid_quote_status CHECK (
  status = ANY (ARRAY[
    'draft','pending','pending_approval','sent','viewed',
    'approved','converted','rejected','expired','cancelled'
  ])
)
```

Consequências:

- INSERT/UPDATE com `status='cancelled'` passa no CHECK (testado por escrita em
  `session_replication_role='replica'`, com ROLLBACK; valor inválido cai com
  `23514`, `cancelled` é aceito).
- O único requisito extra para semear é o mesmo de qualquer quote: a coluna
  `organization_id` (NOT NULL) precisa satisfazer a policy de INSERT
  `org_members_create_quotes`, que valida `user_is_org_member(organization_id)`.
  Sem org, o INSERT falha com `42501` (RLS) — para QUALQUER status, não só
  `cancelled`. O seed resolve o org via `user_organizations` (a fonte que a RLS
  checa), com fallback em `profiles.organization_id`.
- Nuance de contexto de auth: `is_admin_or_above` / `is_coord_or_above` levantam
  exceção ao consultar o papel de **outro** usuário; no uso normal o vendedor
  age sobre o próprio quote (`auth.uid() = seller_id`), então não há bloqueio.

> A ideia de que o CHECK bloqueava `cancelled` vinha do projeto **Lovable Cloud**
> `pqpdolkaeqlyzpdpbizo` — não do canônico. Nenhuma migration de status é
> necessária em `doufsxqlfjyuvxuezpln`.

## 4. Estado atual (cancelled já liberado)

1. **Banco**: nada a aplicar no canônico — o CHECK já contempla `cancelled`. O
   draft `qa/migrations-draft/2026-06-27_quotes_status_allow_cancelled.sql` seria
   um no-op aqui e **nunca** deve rodar no Lovable Cloud `pqpdolkaeqlyzpdpbizo`.
2. **Seed** (`e2e/helpers/quotes-status-seed.ts`): `unseedable_reason` removido do
   alvo `cancelled`; o seed resolve `organization_id` e insere os 14 alvos.
3. **Spec** (`e2e/flows/04m-quotes-status-tooltips-a11y.spec.ts`):
   `expect(unreachable).toEqual([])` e `reachable` cobre os 14 (`toHaveLength(14)`).
4. **Validação ponta-a-ponta**: roda no CI via
   `.github/workflows/e2e-quotes-tooltips.yml` (precisa de app + auth reais). Os
   14 badges aparecem com `aria-describedby` apontando para o `TooltipContent`
   correto.

## 5. Gates automáticos

| Gate | O que cobre |
|---|---|
| `src/components/quotes/__tests__/QuotesStatusChips.tooltips.test.ts` | Toda chave de chip tem tooltip; toda chave de badge tem `description` não vazia; fallback funciona; sem termos técnicos |
| `src/components/quotes/__tests__/QuotesStatusChips.ssot-parity.test.ts` | Paridade entre `QUOTE_STATUSES` (enum BD) e `QUOTE_ROW_BADGE_STYLES`; seed E2E retorna exatamente o conjunto canônico |
| `e2e/flows/04m-quotes-status-tooltips.spec.ts` | Hover e focus em chips + badge mostram a copy SSOT |
| `e2e/flows/04m-quotes-status-tooltips-a11y.spec.ts` | `aria-describedby` + texto do tooltip via teclado em todos os 14 status |
| `e2e/flows/04m-quotes-status-tooltip-fallback.spec.ts` | `TOOLTIP_FALLBACK_COPY` aparece para chave inválida |
| `.github/workflows/e2e-quotes-tooltips.yml` | Roda os 3 specs `04m-quotes-status-tooltip*` no CI |
