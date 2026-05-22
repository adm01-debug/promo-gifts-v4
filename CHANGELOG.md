# Changelog

Todas as mudanças notáveis deste projeto são documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Unreleased]

### 📜 Contratos de Webhook/Edge Functions — Schemas Zod + Testes 422 + Versionamento v1/v2 (2026-05-22)

**Camada compartilhada (`supabase/functions/_shared/contracts/`)**
- `error-response.ts`: shape único de erro `{ code, message, fields[] }` + helpers `validationErrorResponse` (422), `invalidJsonResponse` (400), `missingBodyResponse` (400), `unsupportedVersionResponse` (400)
- `versioning.ts`: `resolveContractVersion` lê `X-Contract-Version` (header) com fallback `?v=` query; default = primeira versão do registry; versões `deprecated` propagam headers `Deprecation: true` + `Sunset: <ISO>` (RFC 8594)
- `<endpoint>.contracts.ts` (×18): registry `{ v1: { schema, status, examples } }` extraído de cada handler com `examples.valid[]` + `examples.invalid[]` (fonte única usada por Vitest, Deno e runner live)

**Helper `zod-validate.ts` evoluído**
- ⚠️ **BREAKING**: respostas de validação agora são **422** com `{ code: "VALIDATION_FAILED", message, fields: [{ path, code, message }] }` em vez de `400 { error, details }`. Status 400 reservado para `INVALID_JSON` e `MISSING_BODY` (input malformado, não validação semântica)
- Novo `parseRequestWithContract(req, registry, corsHeaders)` resolve versão + valida body + ecoa `X-Contract-Version` / `Deprecation` / `Sunset` na resposta

**Versionamento real — `product-webhook` v1/v2**
- v1 (deprecated, sunset `2026-08-22`): payload legado (`price: number`)
- v2 (stable): `price: { amount, currency: 'BRL'|'USD'|'EUR' }`; handler ramifica internamente e mapeia v2→v1 antes de persistir
- Headers `Deprecation: true` + `Sunset` retornados automaticamente para chamadores que não setam `X-Contract-Version` (default v1)

**17 handlers refatorados** para usar `parseBodyWithSchema` / `parseRequestWithContract` (schemas extraídos para `_shared/contracts/`; lógica de negócio inalterada): product-webhook, webhook-dispatcher, webhook-inbound (envelope), ai-recommendations, visual-search, semantic-search, generate-ad-prompt, categories-api, commemorative-dates, analyze-logo-colors, sync-quote-bitrix, quote-sync, generate-product-seo, materials-api, kit-identity-suggest, dropbox-list, magic-up-score, external-db-inspect, generate-ad-image, rate-limit-check.

**Testes de contrato (Vitest in-process)**
- `tests/contract/edge-functions/error-response.test.ts`: helper de erro + shape único
- `tests/contract/edge-functions/versioning.test.ts`: resolução + deprecation + compat v1↔v2
- `tests/contract/edge-functions/all-contracts.test.ts`: parametrizado via `import.meta.glob` — para todo contrato, valida `examples.valid`, `examples.invalid` (com `expectedPath`) + matriz negativa auto-derivada (missing/wrong/empty) por introspecção do ZodObject
- `tests/contract/edge-functions/inventory.test.ts`: **gate de cobertura** — falha o CI se uma Edge Function nova for adicionada sem `_shared/contracts/<name>.contracts.ts` nem entrada em `tests/contract/_allowlist/no-contract.json` (61 funções na allowlist hoje — dívida explícita)

**Testes Deno colocados** para os 3 webhooks externos:
- `supabase/functions/product-webhook/contract_test.ts` (versionamento end-to-end + 422 + Sunset)
- `supabase/functions/webhook-inbound/contract_test.ts` (envelope HMAC)
- `supabase/functions/webhook-dispatcher/contract_test.ts` (parseBodyWithSchema via Deno runtime, exercitando os URL imports reais do `zod-validate.ts`)

**Runner live (`scripts/contract-testing.mjs`)** reescrito para enumerar todos os contratos via filesystem e usar os mesmos `examples.invalid[]` — bate em ambiente staging (configurado via `SUPABASE_URL` + `CONTRACT_TEST_TOKEN`).

**Docs**
- `docs/RUNBOOKS/contracts-and-versioning.md` (novo): como criar v2, política de Sunset, ciclo de promoção stable→deprecated, e fluxo do inventory gate.

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
