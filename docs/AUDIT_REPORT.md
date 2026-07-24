# Auditoria Técnica — Relatório de Triagem

**Data:** 2026-07-13
**Escopo:** Triagem completa (read-only). Sem correções aplicadas neste ciclo (modo "Só relatório" aprovado pelo usuário).
**Ambiente inspecionado:** branch atual do sandbox, projeto Supabase canônico `doufsxqlfjyuvxuezpln`.

---

## 1. Sumário executivo

| Severidade | Domínio | Qtd | Status |
|---|---|---:|---|
| P0 | CI — TypeScript baseline gate | **33 erros novos** (46 atuais vs 13 no baseline) | 🔴 vermelho |
| P0 | CI — ESLint baseline gate | **~309 pares** file:rule com regressão | 🔴 vermelho |
| P0 | CI — Toast leaks gate | **7 novas** ocorrências | 🔴 vermelho |
| P0 | CI — Edge structured logging gate | **1 edge** sem logger SSOT | 🔴 vermelho |
| P1 | Infra — script ausente | `check-client-structured-logging.mjs` referenciado mas inexistente | 🟡 |
| P1 | Supabase — linter (WARN) | 57 findings totais no BD, verificação vs baseline pendente (sem credenciais na sandbox) | 🟡 |
| P2 | Vite dev-server | 2 erros de sintaxe históricos em log (não reproduzem no preview atual) | ⚪ |
| — | Runtime do preview | **sem console errors, sem network 5xx, sem runtime errors** | ✅ |
| — | Gates verdes | inline-cors, edge-cors, edge-request-id-propagation, doc-refs | ✅ |

**Observação global:** o preview em tempo de execução está limpo. Todos os P0 são falhas de **CI gate** (bloqueiam merge no `main`), não de runtime de produção. Nenhum secret vazando, nenhuma RLS aberta identificada, SSOT do Supabase (`doufsxqlfjyuvxuezpln`) confirmado em `src/integrations/supabase/runtime-validator.ts`.

---

## 2. P0 — Bloqueadores de CI

### 2.1 TypeScript baseline gate (`scripts/check-tsc-baseline.mjs`)

**Estado:** 46 erros vs baseline 13 → **+33 regressões** distribuídas em 17 pares `file:rule`.

**Causa provável:** regeneração recente de `src/integrations/supabase/types.ts` alterou o `Database["public"]["Tables"]` union (152 tabelas listadas), invalidando chamadas `.from("mv_supplier_reliability")`, `.rpc("fn_get_similar_products")`, etc., que apontam para objetos ausentes/renomeados no schema tipado.

**Impacto:** CI falha em todo PR. Sem novo baseline ou correção, nenhum merge passa.

**Findings detalhados:**

| Arquivo:linha | Erro | Causa | Fix sugerido |
|---|---|---|---|
| `src/hooks/inventory/useSupplierReliabilityServer.ts:121-201` | TS2589/TS2769/TS2345/TS2352 | tabela `mv_supplier_reliability` e RPC `get_supplier_reliability_history` não constam em `types.ts` | Confirmar se a mv/RPC existe no BD canônico; se sim, regenerar types; se não, promover a mv/RPC ou remover a chamada |
| `src/hooks/products/useSimilarProducts.ts:94-100` | TS2345/TS2339 | RPC `fn_get_similar_products` fora do union tipado | Idem — verificar existência da RPC |
| `src/hooks/useProductColorSwatch.ts:60-62` | TS2345/TS2339/TS7053 | RPC `fn_get_color_swatches_batch` fora do union | Idem |
| `src/lib/security/magazine-guard.ts:44-50` | TS2339 (`primaryColor`) | Campo removido de `MagazineClientBranding` | Ajustar type ou fallback |
| `src/lib/telemetry/magazineMetrics.ts:66-109` | TS2322/TS2345 | Interfaces `MagazineRenderMetrics`/`PublishMetrics`/`AuthStallMetrics` sem index signature exigido por `Extras`/`Record<string, unknown>` | Adicionar `[key: string]: unknown` ou usar `as Record<string, unknown>` cirurgicamente |
| `src/lib/supabase/rest-client.ts:28` | TS2339 (`session`) | Uso de `supabase.auth.session` (API antiga v1) | Migrar para `supabase.auth.getSession()` |
| `src/lib/supabase/rls-validator.ts:146-147` | TS2589/TS2769 | `.from(dynamicString)` sem cast — union de 152 tabelas explode | Usar cast: `.from(tbl as never)` ou refazer com fetch REST direto |
| `src/components/products/ProductCard.tsx:476`, `ProductListItem.tsx:348`, `table-view/TableRowActions.tsx:173`, `filters/SavedFilters.tsx:366`, `kit-builder/KitLibraryPage.tsx:496` | TS2322 | Handler `onFavorite` agora retorna `{added, isFull}` mas prop tipada como `boolean \| void \| Promise<...>` | Alinhar type do prop com o novo retorno OU envolver o callback em wrapper que devolve `void` |
| `src/components/products/ProductTableView.tsx:539` | TS2322 | `boolean \| undefined` sendo passado a prop `boolean` | Coerção `!!value` ou default |
| `src/pages/products/CartsListPage.tsx:168-334` | TS2353/TS2339/TS2345 (×7) | Uso de campos `status`/`deadline` em `Record<"q", string>` — URL state schema não inclui esses campos | Estender o schema do URL state ou remover uso |
| `src/pages/quotes/useQuotesListPage.ts` | TS2339/TS2345 (×4) | Campos ausentes no shape esperado | Verificar tipagem do hook |
| `src/pages/quotes/quote-view/QuoteActionHandlers.ts` | TS2367 | Comparação de tipos que não se sobrepõem | Provavelmente enum status divergente |
| `src/pages/admin/AdminCloudflareImagesPage.tsx:377` | TS2339 (`url_original`) | Campo ausente no type `CfImage` | Ajustar interface |
| `src/hooks/products/useProducts.ts:55,63` | TS2345/TS2554 | `Error` vs `unknown` + arity de função | Cast `error as Error` e ajustar assinatura |

**Ação recomendada:** tratar como **um único PR de "reconciliação de tipos pós-regeneração"**. Não corrigível em fix cirúrgico único porque envolve decisões de schema (mv/RPC existem no BD ou não?). Requer confirmação humana antes de: (a) regenerar types novamente, (b) promover mv/RPC ausentes, ou (c) atualizar baseline.

---

### 2.2 ESLint baseline gate (`scripts/check-eslint-baseline.mjs`)

**Estado:** **~309 pares `file:rule`** acima do baseline (baseline congelado em 1433 erros em 576 arquivos).

**Regras mais recorrentes nos exemplos:**
- `@typescript-eslint/require-await` — async sem `await` em testes (`useQuotesListPage.*.test.ts`)
- `@typescript-eslint/sort-type-constituents` — ordenação alfabética de uniões (`undoToast.tsx`, `DiscountApprovalAuditTrail.tsx`)
- `prefer-template` — string concatenation em fuzz helpers
- `object-shorthand` — métodos em objetos de teste

**Impacto:** gate bloqueante do `main`. Mais de 300 regressões sugerem múltiplos arquivos novos escritos sem `lint --fix` local ou pre-commit hook desligado.

**Ação recomendada:** rodar `npx eslint --fix` na lista de arquivos afetados (a maioria é auto-fixável). Alternativa: `node scripts/eslint-baseline-generate.mjs` se as regressões forem intencionais.

---

### 2.3 Toast leaks gate (`scripts/check-toast-leaks.mjs`)

**Estado:** 7 novas ocorrências não presentes em `.toast-leaks-baseline.json`.

| Arquivo:linha | Código atual |
|---|---|
| `src/components/admin/products/new-supplier/useNewSupplierForm.ts:542` | `toast.error(mapped.message);` |
| `src/components/admin/suppliers-manager/useSuppliersManager.ts:524` | `toast.error(mapped.message);` |
| `src/pages/admin/AdminV4CallbacksPage.tsx:141` | `toast.error(e instanceof Error ? e.message : 'Falha ao reprocessar.');` |
| `src/pages/admin/AdminV4CallbacksPage.tsx:154` | `toast.error(e instanceof Error ? e.message : 'Falha no lote.');` |
| `src/pages/products/CartsListPage.tsx:333` | `toast.warning(summary.message);` |
| `src/pages/products/CartsListPage.tsx:334` | `toast.error(summary.message);` |
| `src/pages/products/SellerCartsPage.tsx:213` | `toast.error(EMPTY_CART_BLOCK_TITLE, { description: decision.message });` |

**Causa:** memory rule `[Sanitize Message SSOT]` exige que toda mensagem de erro passe por `sanitizeMessage()`/`sanitizeError()` de `src/lib/security/sanitize-error.ts`. Runtime patch já protege contra vazamento visual, mas o gate estático quer código explícito.

**Impacto:** CI vermelho. Risco de mensagem técnica escapar para usuário não-dev caso o patch runtime falhe.

**Fix sugerido (cirúrgico, ~5 linhas por arquivo):**

```tsx
// Antes:
toast.error(mapped.message);

// Depois:
import { sanitizeError } from "@/lib/security/sanitize-error";
toast.error("Não foi possível concluir a operação.", { description: sanitizeError(mapped) });
```

---

### 2.4 Edge structured-logging gate

**Estado:** 1 edge function sem logger SSOT.

| Edge function | Falta |
|---|---|
| `supabase/functions/quote-sync-promo-champions/index.ts` | `createStructuredLogger` de `../_shared/structured-logger.ts` |

**Fix sugerido:**
```ts
import { createStructuredLogger } from "../_shared/structured-logger.ts";
const log = createStructuredLogger("quote-sync-promo-champions");
// substituir console.log/error pelos métodos do log (log.info/log.error com scope canônico)
```

---

## 3. P1 — Não-bloqueadores, mas relevantes

### 3.1 Script ausente referenciado

`scripts/check-client-structured-logging.mjs` é citado em memory rules (`[Client Logging Gate]`) e no plano da auditoria, mas **não existe** no repositório. O comando `node scripts/check-client-structured-logging.mjs` falha com `MODULE_NOT_FOUND`.

**Verificar:** se o script foi movido, renomeado, ou se a memory rule está estale.

### 3.2 Supabase linter — verificação incompleta

Sem credenciais válidas na sandbox (`SUPABASE_ACCESS_TOKEN` retornou 401), não foi possível diffar findings atuais vs `.security/supabase-linter-baseline.json`. O `supabase--linter` (tool) reporta 57 findings totais — **todos WARN**, categoria SECURITY, subcategoria 0028/0029 (SECURITY DEFINER executável por PUBLIC/anon/authenticated).

O baseline já aceita 48 funções nessa categoria (RLS helpers, RPCs do frontend). Faltam ~9 para reconciliar. **Não é P0** enquanto forem funções whitelisted intencionalmente; é P1 até validação humana.

**Ação recomendada:** rodar localmente com `SUPABASE_ACCESS_TOKEN` real:
```bash
SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=doufsxqlfjyuvxuezpln node scripts/check-supabase-linter.mjs
```

### 3.3 Vite dev-server — erros históricos

Log do daemon Vite (`daemon_logs` table) mostra dois erros de sintaxe em `14:08–14:09`:
- `x Expected ',', got 'ident'`
- `x Expected '</', got ')'`

Sem path anexado no log (o Vite trunca em log de daemon). **Não reproduzem** no preview atual (`console_logs`, `runtime_errors`, `network` todos limpos). Provavelmente ocorreram durante edições em turnos anteriores e já foram sanadas.

---

## 4. P2 — Observações

- Runtime do preview limpo: sem `console.error`, sem 4xx/5xx em network, sem runtime errors capturados.
- SSOT do Supabase confirmado: `src/integrations/supabase/runtime-validator.ts` bloqueia URL fora de `doufsxqlfjyuvxuezpln` em produção.
- CORS gate verde (99 edges via `_shared/cors`, 4 server-only, 0 inline).
- Doc-refs gate verde (38 referências em `docs/PERF_OPTIMIZATIONS.md` intactas).
- Edge request-id propagation gate verde nas 17 edges críticas.

---

## 5. Não verificado neste ciclo

Estes domínios não foram cobertos pela varredura por falta de sinal automatizado disponível na sandbox — recomenda-se auditoria dedicada se houver suspeita concreta:

- **Fluxos E2E (login, orçamento, kit, catálogo)** — a suíte Playwright existe (~50 specs) mas rodá-la aqui excederia janela de tempo. CI já executa `test:e2e:critical` em cada PR.
- **RLS row-level em live-DB** — testes existem em `tests/rls/live-rls.test.ts` mas dependem de credenciais.
- **Responsividade mobile / a11y visual** — sem screenshots automatizados neste ciclo.
- **Realtime, webhooks inbound, cron jobs** — não inspecionados individualmente.

---

## 6. Recomendações de priorização (para o próximo ciclo)

Ordem sugerida caso o usuário aprove correções:

1. **Toast leaks (2.3)** — 7 arquivos, fix mecânico com `sanitizeError`. Baixo risco, alto ROI (destrava um gate).
2. **Edge sem logger (2.4)** — 1 arquivo, ~10 linhas. Baixo risco.
3. **TypeScript baseline (2.1)** — dividir em 2 sub-PRs:
   - (a) trivial (5 min): coerção `!!`, `as Record<string, unknown>`, cast de `error as Error`, remoção de `supabase.auth.session`.
   - (b) requer decisão (schema): mv/RPC ausentes em types (`mv_supplier_reliability`, `fn_get_similar_products`, `fn_get_color_swatches_batch`, `get_supplier_reliability_history`). Confirmar com PO se esses objetos existem no BD canônico antes de regenerar types.
4. **ESLint baseline (2.2)** — 1 comando: `npx eslint --fix` nos arquivos listados. Depois `eslint-baseline-generate.mjs` se sobrar.

---

## Apêndice — Comandos executados

```bash
npx tsgo --noEmit                                       # ok (empty)
npm run check:doc-refs                                  # ok
npm run check:no-inline-cors                            # ok
npm run check:edge-cors                                 # ok
node scripts/check-edge-structured-logging.mjs          # 1 falha
node scripts/check-client-structured-logging.mjs        # arquivo ausente
node scripts/check-edge-request-id-propagation.mjs      # ok
node scripts/check-toast-leaks.mjs                      # 7 falhas
node scripts/check-eslint-baseline.mjs                  # ~309 pares
node scripts/check-tsc-baseline.mjs                     # 33 regressões
supabase--linter (tool)                                 # 57 WARN
node scripts/check-supabase-linter.mjs                  # 401 sem token real
```

**Sinais de runtime do preview:** console/network/runtime-errors todos vazios.
**Log Vite:** 2 syntax errors históricos sem repetição.

---

_Relatório gerado sem alterações no código. Nenhum arquivo além deste foi modificado._
