# 🔍 Auditoria Exaustiva de Integrações — 26/05/2026

**Data:** 26/05/2026  
**Executor:** TIPROMO / Claude Sonnet 4.6  
**Escopo:** Edge functions, hooks frontend, serviços, banco de dados

---

## Scorecard Geral

| Bug | Severidade | Componente | Status |
|-----|-----------|------------|--------|
| BUG-001 | 🔴 Crítico | `elevenlabs-tts` `[object Object]` como API key | ✅ Corrigido |
| BUG-002 | 🟠 Alto | `elevenlabs-scribe-token` SSOT bypass | ✅ Corrigido |
| BUG-003 | 🟠 Alto | `cnpj-lookup` mock formato inválido | ✅ Corrigido |
| BUG-004 | 🟡 Médio | `generate-mockup` SDK version divergente | ✅ Corrigido |
| BUG-005 | 🟡 Médio | `dropbox-list` SSOT bypass | ✅ Corrigido |
| BUG-006 | 🟡 Médio | `sync-quote-bitrix` SSOT bypass | ✅ Corrigido |
| BUG-007 | 🔵 Baixo | `viacep.ts` sem timeout | ✅ Corrigido |
| BUG-B01 | Info | `quote_items` subtotal falso positivo | ✅ Constraint adicionado |
| BUG-B02 | 🔴 Alto | `negotiation_markup_percent` não persistido | ✅ DB backfill + fix código |
| BUG-B03 | 🟡 Médio | Tabelas duplicadas (`smoke_test_runs` etc.) | ✅ Documentado |
| BUG-B04 | 🟡 Médio | 4 produtos ativos sem preço | ✅ Desativados |
| BUG-B05 | Info | `category_id` vs `main_category_id` | ✅ Documentado (esperado) |
| **BUG-NEW-01** | 🔴 **Crítico** | `duplicateQuote` perde `negotiation_markup_percent` | ✅ **Corrigido neste PR** |
| **BUG-NEW-02** | 🟡 Médio | `rest-native` offset sem limit silencioso | ✅ **warn adicionado neste PR** |
| **BUG-NEW-03** | 🟡 Médio | Markup clamp de 50% silencioso | ✅ **Corrigido neste PR** |

---

## BUG-NEW-01 🔴 CRÍTICO — `duplicateQuote` perde `negotiation_markup_percent`

**Arquivo:** `src/hooks/quotes/useQuotes.ts` → `duplicateQuote()`

### Descrição

Ao duplicar um orçamento, o campo `negotiation_markup_percent` era omitido do
payload passado para `createQuote()`. O campo ficava com valor `0` (default do
`buildInsertPayload`), perdendo completamente o markup da cotação original.

### Impacto

- Orçamento com 5% de markup duplicado → cópia sem markup
- Total da cópia diverge do original sem explicação visível
- Vendedor pode enviar preço errado ao cliente

### Evidência

```typescript
// ANTES (BUGADO) — negotiation_markup_percent ausente:
await createQuote({
  client_id: original.client_id,
  // ... outros campos
  // negotiation_markup_percent AUSENTE → padrão = 0
  internal_notes: `Duplicado de ${original.quote_number}`,
}, items);

// DEPOIS (CORRETO):
await createQuote({
  // ...
  negotiation_markup_percent: original.negotiation_markup_percent ?? 0,
  // ...
}, items);
```

---

## BUG-NEW-02 🟡 MÉDIO — `rest-native.ts` offset sem limit usa upper bound 999 silencioso

**Arquivo:** `src/lib/external-db/rest-native.ts`

### Descrição

Quando `options.offset` está definido mas `options.limit` não, o código usava
silenciosamente `range(offset, offset + 999)`. Tabelas com mais de 1.000
registros a partir do offset teriam resultados truncados sem qualquer aviso.

### Fix

`logger.warn` adicionado para tornar o comportamento visível nos logs.
O bound de 999 permanece como fallback conservador e seguro.

---

## BUG-NEW-03 🟡 MÉDIO — Markup clamp de 50% silencioso

**Arquivo:** `src/hooks/quotes/quoteHelpers.ts` → `calculateQuoteTotals()`

### Descrição

```typescript
// ANTES (BUGADO):
const markup = Math.min(50, Math.max(0, quote.negotiation_markup_percent || 0));
// markup de 60% → silenciosamente virava 50% sem aviso ao usuário
```

O usuário digitava 60% de markup e o sistema salvava 50% sem nenhuma mensagem
de erro, validação ou indicação visual da truncagem.

### Fix

```typescript
// DEPOIS (CORRETO):
if (rawMarkup > MARKUP_MAX_PERCENT) {
  throw new Error(
    `Margem de negociação não pode exceder ${MARKUP_MAX_PERCENT}%. Valor informado: ${rawMarkup}%.`
  );
}
```

---

## Banco de Dados — Aplicado via Supabase MCP (26/05/2026)

| Ação | Tabela | Status |
|------|--------|--------|
| CHECK CONSTRAINT adicionado | `quote_items` | ✅ |
| Backfill `negotiation_markup_percent` | `quotes` (3 registros) | ✅ |
| 4 produtos desativados sem preço | `products` | ✅ |
| View de monitoramento criada | `v_db_health_audit` | ✅ |
| Policies FIX-001..005 | múltiplas tabelas | ✅ (já existiam no banco) |

### Estado atual `v_db_health_audit`

```
B02 markup não persistido    → 0 issues  ✅
B03 smoke_test_runs vazia    → 1 issue   ⚠️ (tabela deprecada — esperado)
B04 produto ativo sem preço  → 0 issues  ✅
B05 category inconsistente   → 136       ℹ️ (esperado para hierarquias)
B06 subtotal fórmula inválida → 0 issues ✅
```

---

## Checklist de Ações Pendentes

- [ ] **[DB]** Migrar 203 registros `login_attempts` → `auth_login_attempts`
- [ ] **[DB]** Migrar 3 registros `audit_log` → `admin_audit_log`
- [ ] **[CODE]** Migrar refs de código `smoke_test_runs` → `smoke_tests_runs`
- [ ] **[PRODUCT]** Cadastrar preços para 4 produtos Asia Import antes de reativar
- [ ] **[CONFIG]** Avaliar se limite 50% de markup deve ser configurável por org
