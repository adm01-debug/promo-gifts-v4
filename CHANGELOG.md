# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### 🔍 Auditoria Exaustiva — Módulo BUSCA GLOBAL (2026-05-27)

**Branch**: `claude/global-search-audit-AsGQa` · **Auditoria**: [`audit/BUSCA_GLOBAL_BUG_AUDIT_2026-05-26.md`](./audit/BUSCA_GLOBAL_BUG_AUDIT_2026-05-26.md)

20 bugs corrigidos no módulo de busca global. Abaixo o resumo agrupado por categoria:

#### 🐛 Stale Closures / Dependency Arrays (BUG-GS-03, 04, 08, 18)
- **BUG-GS-03/18** (`useGlobalSearch.ts`): `handleVoiceAction` useCallback deps corrigidos — adicionados `setQuery` e `setResults`; previne stale closure nos casos `search`, `filter` e `clear`.
- **BUG-GS-04** (`AdvancedSearch.tsx`): mesmo padrão — `setQuery` adicionado às deps do `handleVoiceAction`.
- **BUG-GS-08** (`GlobalSearch.tsx`): `handleResultClick` envolvido em `useCallback` e adicionado ao array de deps do `useEffect` de teclado.

#### 🐛 UI Rendering Conflicts (BUG-GS-02)
- **BUG-GS-02** (`GlobalSearchPalette.tsx`): para `query.length === 2`, `EmptySearchState` + hint "Continue digitando" + typing suggestions renderizavam simultaneamente. Corrigido: threshold do `EmptySearchState` elevado de `>= 2` para `>= 3`, alinhado com o limiar real do `performSemanticSearch`.

#### 🐛 Regex Stateful Bug (BUG-GS-01)
- **BUG-GS-01** (`HighlightMatch.tsx`): regex global (`gi`) reutilizada no `.test()` após `.split()` — `lastIndex` avançava e produzia alternância true/false, fazendo metade dos highlights ser perdida. Corrigido: regex de split (`gi`) separada da regex de teste (sem flag `g`, com `^...$`).

#### 🐛 LocalStorage Unification (BUG-GS-05)
- **BUG-GS-05** (`EmptySearchState.tsx`): chave `'recent_global_searches'` (formato `string[]`) desconectada da chave canônica `'global-search-history-v2'` (formato `HistoryItem[]`) usada por `useSearchHistory`. Histórico divergia em partes diferentes da UI. Corrigido: `EmptySearchState` agora lê/escreve na chave unificada.

#### 🔒 Segurança e Privacidade (BUG-GS-06, 14)
- **BUG-GS-06** (`useGlobalSearch.ts` + `searchCache.ts`): cache LRU de módulo não era limpo no logout. Usuário B podia ver resultados de pesquisa do Usuário A na mesma aba. Corrigido: listener `supabase.auth.onAuthStateChange` chama `searchCache.clear()` no evento `SIGNED_OUT`.
- **BUG-GS-14** (`useGlobalSearch.ts`): queries brutas gravadas em `search_analytics.search_term` podiam conter CPF, CNPJ ou e-mail. Corrigido: função `redactPii()` aplicada antes do insert — substitui padrões sensíveis por `[REDACTED]` (LGPD compliance).

#### 🔒 Error Handling (BUG-GS-07)
- **BUG-GS-07** (`GlobalSearchPalette.tsx` + `useGlobalSearch.ts`): falhas de rede ou timeout da edge function resultavam em "nenhum resultado" sem qualquer feedback. Corrigido: estado `searchError` exposto; banner de erro sutil renderizado na UI.

#### 🧹 Código Morto / Dead Code (BUG-GS-09, 13)
- **BUG-GS-09** (`SmartSuggestions.tsx`): componente nunca importado (o `SmartSuggestions` real vem de `CartUtilComponents.tsx`). Arquivo deletado.
- **BUG-GS-13** (`GlobalSearch.tsx`): export `useGlobalSearch` legado colidiria com o hook real em `useGlobalSearch.ts`. Renomeado para `useLegacyGlobalSearch` com tag `@deprecated`.

#### ♿ Acessibilidade (BUG-GS-12)
- **BUG-GS-12** (`GlobalSearchPalette.tsx`): botão trigger da busca global sem `aria-label` e sem `aria-haspopup`. Adicionados `aria-label="Abrir busca global"` e `aria-haspopup="dialog"`.

#### 🐛 SpeechRecognition Leak (BUG-GS-11)
- **BUG-GS-11** (`SearchWithSuggestions.tsx`): cada clique no botão de voz criava nova instância de `SpeechRecognition` sem cancelar a anterior — instâncias concorrentes disputavam o microfone. Corrigido: `recognitionRef` + `abort()` antes de criar nova instância.

#### 📊 Popular Products Query (BUG-GS-10)
- **BUG-GS-10** (`useGlobalSearch.ts`): query de "produtos populares" buscava apenas os 100 registros mais recentes de `product_views`, o que favorecia produtos recém-vistos, não os mais vistos. Limite aumentado para 1.000 para melhor aproximação de frequência real.

#### 🧪 Novos Testes (T15–T17)
- `src/components/search/__tests__/HighlightMatch.test.tsx` — 10 casos (regex alternância, diacríticos, múltiplos matches)
- `src/components/search/__tests__/searchCache.test.ts` — 18 casos (set/get/TTL/LRU/clear — regressão BUG-GS-06)
- `src/components/search/__tests__/searchStates.test.ts` — 25 casos (condições de render mutuamente exclusivas — regressão BUG-GS-02)

---

### 🚀 Redeploy 2026-05 — Fase 2 (T19–T23) + Fase 3 (T24–T30)

**Fase 2 — Segurança P1 (PR #166)**

- T19: 10 views SECURITY DEFINER refatoradas para `security_invoker=true` + REVOKE de anon
- T20: 7 materialized views movidas de `public` para schema `analytics` com wrapper views (frontend não muda)
- T21: 17 policies `USING(true)` expostas a `public`/`anon` — 2 restritas (suppliers/preços) + 15 documentadas via `COMMENT ON POLICY`
- T22: branch protection + Dependabot + Secret Scanning ⏳ (`docs/redeploy/REDEPLOY-FASE2-CHECKLIST-UI.md` — ação UI manual)
- T23: 2 buckets públicos fechados (`recibos-entrega`, `scripts`); policy `recibos_authenticated_read` ⏳ (limitação técnica documentada: `storage.objects` pertence a `supabase_storage_admin`)
- T3: `docs/DEPLOYMENT.md` reescrito (removida instrução perigosa `supabase db push`); CI guard `check-no-db-push.mjs` instalado
- Reviews endereçadas: 7 CodeRabbit + 1 Codex P1 crítico (sentinel push-only) + 4 Copilot + 2 Codex P2

**Fase 3 — Hardening 10/10**

- T24: 2 dos 5 arquivos de teste skipados re-habilitados (`SidebarFocusVisible`, `SidebarNavGroup.harmony`); 3 restantes (collapse/history/suspense) mantidos com justificativa rastreável atualizada
- T28 piloto: 36 funções SECURITY DEFINER (audit/auto/build/cleanup/purge/enforce/sync) revogadas de `anon` + `authenticated`. Advisor: **651 → 578 WARN entries** (-73). Critério C2 do plano atingido
- T28 guard: `scripts/check-security-definer-hardening.mjs` bloqueia migrations novas adicionando função SECURITY DEFINER sem `search_path` + REVOKE de anon
- T26: inventário formal de observability — Sentry + structured logger + webhook metrics + request_id ponta-a-ponta. Gaps catalogados para Fase 4+
- T29 (este entry) + T30 sign-off: ver `docs/redeploy/REDEPLOY-FASE3-FINAL.md`

### 🚀 Adicionado — Hardening 10/10 (Onda 1)
- ESLint integrado ao pipeline de CI (`.github/workflows/ci.yml`)
- Verificação HIBP (Have I Been Pwned) habilitada para senhas fracas/vazadas
- Hardening de RLS em buckets públicos de Storage (UPDATE/DELETE restrito ao dono)
- Template de Pull Request com checklist obrigatório (`.github/pull_request_template.md`)
- Dependabot configurado para atualizações semanais de npm + GitHub Actions
- Cabeçalhos de segurança (CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy) em `public/_headers`
- Coverage threshold elevado de 50% → 60% em `vitest.config.ts`
- Husky pre-push hook executando `npm run test` antes de push para prevenir regressões

### 🔒 Segurança
- CSP restritivo com allow-list de domínios externos (Supabase, Cloudflare Stream, CNPJa, OpenAI, Gemini, ElevenLabs)
- HSTS com `preload` (max-age 2 anos) — preparado para inclusão na lista HSTS Preload do Chromium

---

## [3.4.0] - 2025-04-10

### Adicionado
- Sincronização de orçamentos com SalesPro v3.4 (4 casas decimais em `unit_price`/`total_price`)
- Sistema de assinatura eletrônica de orçamentos (MP 2.200-2/2001)
- Workflow de aprovação de descontos com alçada por vendedor

### Corrigido
- Race condition em `acquire_ai_quota` (lock pessimista adicionado)

---

## [3.3.0] - 2025-03-25

### Adicionado
- Suíte Magic Up de marketing com IA (Gemini 3 Pro / Nano Banana Pro)
- Comparador de produtos com chave composta (productId::variant_id)
- Sistema de coleções privadas

---

## [3.2.0] - 2025-03-10

### Adicionado
- Catálogo com busca semântica (8 níveis + re-rank pg_trgm)
- Sistema de Estoque Futuro com previsões de reposição
- Multi-variant carousel nos cards de produto

---

## [3.0.0] - 2025-02-01

### 💥 Breaking
- Plataforma fechada: sign-up público desabilitado, cadastro apenas via convite admin
- RLS migrado para arquitetura SECURITY DEFINER + has_role()

### Adicionado
- 50 Edge Functions com validação Zod (100% de cobertura)
- Anti-scraping: bot detection + rate limit persistente + anti-hotlinking
- Logger estruturado (`src/lib/logger.ts`) substituindo todos os `console.*`

[Unreleased]: https://github.com/promo-gifts/app/compare/v3.4.0...HEAD
[3.4.0]: https://github.com/promo-gifts/app/compare/v3.3.0...v3.4.0
[3.3.0]: https://github.com/promo-gifts/app/compare/v3.2.0...v3.3.0
[3.2.0]: https://github.com/promo-gifts/app/compare/v3.0.0...v3.2.0
[3.0.0]: https://github.com/promo-gifts/app/releases/tag/v3.0.0
