# Tooltips de status de orçamentos — SSOT

Última atualização: 2026-06-27.

Esta página documenta o mapeamento **status ↔ tooltip** usado em todo o módulo
`/orcamentos` (chips do topo, badges da tabela, página de detalhe) e o motivo
pelo qual o status `cancelled` ainda não é alcançável via INSERT direto no
banco canônico.

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
| `cancelled` | `status='cancelled'` | ❌ **bloqueado por CHECK** (ver §3) |
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

## 3. Por que `cancelled` está bloqueado hoje

A migration original do schema define:

```sql
CONSTRAINT valid_quote_status CHECK (
  status IN ('draft','pending','sent','approved','rejected','expired','converted')
)
```

Apesar de funções recentes (`notify_quote_status_change`,
`fix_audit_novo_orcamento_batch2`) já tratarem `cancelled`, o CHECK acima
ainda não foi ampliado **no banco canônico** `doufsxqlfjyuvxuezpln`. Consequências:

- INSERT/UPDATE com `status='cancelled'` falha em produção.
- O seed E2E `seedQuotesForStatusChips` marca essa chave com
  `unseedable_reason='db-check-blocks-cancelled-for-quotes'` para não falhar
  silenciosamente.
- O spec `04m-quotes-status-tooltips-a11y.spec.ts` valida 13 status reachable
  e asserta `unreachable === ['cancelled']` como invariante até a migration.

## 4. Como liberar `cancelled` (checklist)

1. Aplicar `qa/migrations-draft/2026-06-27_quotes_status_allow_cancelled.sql`
   **no projeto canônico** (`doufsxqlfjyuvxuezpln`). Nunca rodar no
   Lovable Cloud `pqpdolkaeqlyzpdpbizo`.
2. Conferir no SQL:
   ```sql
   SELECT pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conrelid='public.quotes'::regclass
     AND conname='valid_quote_status';
   ```
3. Em `e2e/helpers/quotes-status-seed.ts`, remover o bloco
   `unseedable_reason` do alvo `cancelled`.
4. Em `e2e/flows/04m-quotes-status-tooltips-a11y.spec.ts`, trocar:
   - `expect(unreachable).toEqual(['cancelled'])` → `expect(unreachable).toEqual([])`
   - `expect(reachable).toHaveLength(13)` → `…toHaveLength(14)`
5. Atualizar a tabela acima marcando `cancelled` como ✅.
6. Rodar localmente:
   ```bash
   bunx playwright test e2e/flows/04m-quotes-status-tooltip
   ```
   Os 14 badges precisam aparecer com `aria-describedby` apontando para o
   `TooltipContent` correto.

## 5. Gates automáticos

| Gate | O que cobre |
|---|---|
| `src/components/quotes/__tests__/QuotesStatusChips.tooltips.test.ts` | Toda chave de chip tem tooltip; toda chave de badge tem `description` não vazia; fallback funciona; sem termos técnicos |
| `src/components/quotes/__tests__/QuotesStatusChips.ssot-parity.test.ts` | Paridade entre `QUOTE_STATUSES` (enum BD) e `QUOTE_ROW_BADGE_STYLES`; seed E2E retorna exatamente o conjunto canônico |
| `e2e/flows/04m-quotes-status-tooltips.spec.ts` | Hover e focus em chips + badge mostram a copy SSOT |
| `e2e/flows/04m-quotes-status-tooltips-a11y.spec.ts` | `aria-describedby` + texto do tooltip via teclado em todos os 13 (→ 14) status |
| `e2e/flows/04m-quotes-status-tooltip-fallback.spec.ts` | `TOOLTIP_FALLBACK_COPY` aparece para chave inválida |
| `.github/workflows/e2e-quotes-tooltips.yml` | Roda os 3 specs `04m-quotes-status-tooltip*` no CI |
