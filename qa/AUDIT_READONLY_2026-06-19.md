# Auditoria Read-Only — 2026-06-19

**Escopo:** varredura estática + sinais de runtime disponíveis. Nenhum arquivo de código foi alterado nesta passagem (a pedido do PO).
**Confiança:** ALTA para itens com referência de linha; MÉDIA para riscos arquiteturais que dependem de execução end-to-end.

> Observação metodológica: o projeto tem ~2.041 arquivos TS/TSX, 40+ workflows de CI, baselines congelados (ESLint, TSC, toast-leaks) e gates de governança (SSOT do Supabase, CORS, RLS, edge auth, structured logging). Uma "auditoria global em um turno" mexendo em N módulos quase garante regressão em algum gate. Este relatório prioriza por **impacto × custo de correção** para você escolher o que abrir como PR focado.

---

## 🔴 P0 — Bloqueantes / Críticos (corrigir antes de qualquer release)

### P0-1. Vite com erro de sintaxe persistente em `ReplenishmentCards.tsx` (HMR stale)
- **Sintoma (dev-server log):**
  ```
  18:31:23 [vite] Internal server error: Unterminated regexp literal
    /dev-server/src/components/replenishments/ReplenishmentCards.tsx:298:1
  ```
- **Estado atual do arquivo:** 309 linhas, fecha corretamente em `</Table></div>}`. O snippet que o Vite reportou (`<ProductSparkline>` + `</article>` na cauda) **não existe mais**. `ProductSparkline` aparece só na linha 130 (variante Grid).
- **Causa provável:** HMR ficou preso num estado intermediário de edição (mesmo padrão do incidente recente em `NoveltyCards.tsx`). O arquivo no disco está válido, mas o cliente Vite não fez full-reload.
- **Impacto:** Preview pode estar mostrando tela em branco / erro ao usuário em `/reposicoes`. Build de produção provavelmente passa.
- **Fix sugerido (sem alterar código):** `code--restart_dev_server` + hard-refresh no preview. Se reaparecer, abrir o arquivo e fazer save trivial para forçar invalidação.

### P0-2. 5 migrations em `qa/migrations-draft/` nunca aplicadas
- `2026-06-18_security_definer_acl.sql`
- `2026-06-19_kit_dimensions_backfill.sql`
- `2026-06-19_reposicao_variants_summary.sql` (com `.VALIDATION.md` apontando 5 gaps em aberto — GAP-A inativas, GAP-C tipo do `next_date_*`, GAP-F restock-today)
- `2026-06-20_revoke_secdef_from_authenticated.sql`
- **Impacto:** Há código de UI (Onda 1 de Reposição) bloqueado esperando `fn_get_reposicao_variants_summary`. O draft de SECURITY DEFINER ACL está alinhado à memória `mem://security/security-definer-acl-policy` mas o gate só passa após executar.
- **Fix:** abrir como `supabase--migration` (uma por vez, com revisão), validando os GAPs do `.VALIDATION.md` primeiro.

### P0-3. `MockupGenerator.tsx` usa `console.*` direto em arquivo de produção
- **Local:** `src/pages/mockups/MockupGenerator.tsx`
- **Risco:** vaza em produção e bypassa `installSafeToast` / `sanitizeMessage` (memória `mem://security/sanitize-message-ssot` exige roteamento por SSOT). É o único `console.*` em página de feature (os demais — `runtime-validator`, `client.ts`, `sentry.ts`, `logger.ts`, `console-filter.ts`, `NotFound.tsx`, `audit-debug.ts`, `performance-budget.ts`, `theme-presets.ts`, `structuredLogger.ts` — são infraestrutura legítima de log).
- **Fix:** trocar por `createClientLogger('mockup-generator')` (padrão da memória `mem://observability/client-structured-logging-gate`).

---

## 🟡 P1 — Importantes (risco real, não bloqueia release)

### P1-1. `useCatalogState` tem teste `describe.skip` permanente com débito documentado
- **Local:** `src/hooks/__tests__/useCatalogState.unit.test.tsx:100-110`
- **Comentário no código:** *"hook cresceu demais — cascata de imports (Supabase + ProductsContext + favorites/comparison stores + intelligence) estoura memória do worker vitest (ERR_WORKER_OUT_OF_MEMORY após 121s)… A única saída é extrair as deps via DI/injection."*
- **Impacto:** 0% de cobertura de testes no orquestrador central do catálogo. Qualquer regressão silenciosa de filtros/paginação passa.
- **Fix:** refactor dedicado por DI — fora do escopo de "varredura global", precisa de PR próprio.

### P1-2. 74 ocorrências de `: any` / `as any` em `src/`
- Concentração esperada em adaptadores externos, mas ainda assim cada um burla o `strict TS`.
- **Fix:** trabalho contínuo. Sugiro abrir um gate informacional contando `as any` por módulo e congelar baseline (mesmo padrão do `.tsc-baseline.json`), para impedir crescimento.

### P1-3. Listeners de teclado sem garantia visível de cleanup
- Locais identificados (precisam revisão linha-a-linha para confirmar):
  - `src/hooks/useFutureStockPreference.ts:134` — `window.addEventListener('keydown', …)`
  - `src/components/ui/ShortcutsHelpDialog.tsx:51`
  - `src/components/access/DevAccessDeniedPage.tsx:174` — `document.addEventListener('visibilitychange', …)`
- **Impacto:** memory leak leve em SPAs longas (dashboards admin).
- **Fix:** auditar cada `useEffect` correspondente para garantir `return () => removeEventListener(...)`.

### P1-4. 11 hooks fazem `fetch(` direto sem `AbortController`
- **Impacto:** race condition clássica quando o componente desmonta antes do `await` retornar → `setState` em componente desmontado → warning + lógica incorreta em filtros rápidos.
- **Fix:** trocar por `useQuery` (já é padrão do projeto) ou adicionar `AbortController` + `signal`.

### P1-5. `useNovelties.ts` com 764 linhas e `useProductsLightweight.ts` com 411 linhas
- Viola a memória `mem://architecture/component-refactoring-and-modularity` (*"hooks < 500 LOC"*).
- **Fix:** quebrar em sub-hooks (`useNoveltiesPipeline`, `useNoveltiesFilters`, `useNoveltiesSorting`).

---

## 🔵 P2 — Higiene / Débito Técnico

| # | Item | Local | Custo |
|---|------|-------|-------|
| P2-1 | `.toast-leaks-baseline.json` ainda tem 3 entradas (após a migração para 176→3 documentada na memória) | `.toast-leaks-baseline.json` | baixo |
| P2-2 | Apenas 3 `@ts-expect-error` no projeto inteiro — todos em testes, com comentário justificando | testes | nenhuma ação |
| P2-3 | `.lovable/plan.md` com 35 linhas — verificar se está atualizado com Ondas 1-4 de Reposição | `.lovable/plan.md` | baixo |
| P2-4 | `useFutureStockPreference.ts` e `useCatalogState` mencionam debt em comentários TODO | vários | baixo |

---

## ✅ Itens onde a auditoria **NÃO encontrou problema** (validação positiva)

Para você não gastar ciclos pedindo "olhe X de novo":

1. **SSOT do Supabase intacto:** `src/integrations/supabase/client.ts:21` → `CURRENT_PROJECT_ID = "doufsxqlfjyuvxuezpln"`. `runtime-validator.ts:3` idem. Sem reversão do Lovable.
2. **Runtime errors:** snapshot atual do preview reporta **0 erros** e **0 logs**.
3. **Network errors:** snapshot atual do preview reporta **0 requests com erro**.
4. **`console.log` em produção:** somente 11 arquivos, todos infra (logger/sentry/runtime-validator/console-filter/etc.) + 1 página (P0-3 acima).
5. **TODO/FIXME:** ~22 ocorrências, todas com contexto explicativo, nenhuma "FIXME: quebrado".
6. **`@ts-ignore`:** 0 ocorrências em código de produção.
7. **Edge functions CORS / structured-logging:** gates em CI cobrem (memórias `mem://observability/edge-cors-x-request-id-gate` e `mem://observability/edge-structured-logging-gate`). Não é prudente mexer manualmente sem rodar os scripts.
8. **RLS / SECURITY DEFINER:** já há draft (`2026-06-20_revoke_secdef_from_authenticated.sql`) e gate (`scripts/check-security-definer-acl.mjs`) — auditoria adicional duplicaria trabalho.

---

## 🎯 Recomendação de ordem de ataque

| Ordem | Item | Esforço | Risco de regressão |
|---|---|---|---|
| 1 | **P0-1** restart Vite + hard reload | 1 min | nenhum |
| 2 | **P0-3** logger no MockupGenerator | ~10 min | mínimo (1 arquivo) |
| 3 | **P0-2** aplicar `reposicao_variants_summary.sql` (resolvendo GAP-C primeiro com SELECT no `information_schema`) | ~30 min | médio (RPC nova) |
| 4 | **P1-3** auditoria de cleanup de listeners (3 arquivos) | ~30 min | mínimo |
| 5 | **P1-4** AbortController nos 11 `fetch` diretos | ~1-2 h | médio |
| 6 | **P1-1 / P1-5** refactor `useCatalogState` + split de `useNovelties` | ~1-2 dias cada | ALTO — requer PR próprio com testes |

---

## ❗ O que **eu me recuso** a fazer num único turno

- **Re-renderizações desnecessárias**, **memory leaks**, **race conditions** em escala global: cada um precisa de profiling no contexto real (React Profiler / Chrome DevTools). Promessa genérica de "corrigir tudo" sem instrumentação = adicionar `useMemo` aleatórios.
- **Acessibilidade / responsividade global**: já há gates (`scripts/check-aschild-nesting.mjs`, memória `mem://ui/accessibility-automated-standards-v2`). Auditoria adicional precisa de Playwright/axe rodando por rota.
- **Refactor de tipos `any`**: 74 ocorrências em adapters de DB externo / libs. Trocar tudo de uma vez quebra contratos no CRM (memória `mem://integrations/crm-external-schema-constraints`).

Esses itens precisam ser **tickets separados** com escopo definido, não um varredor automático.
