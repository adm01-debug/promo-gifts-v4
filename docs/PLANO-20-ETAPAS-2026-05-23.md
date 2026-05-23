# Plano de correção exaustiva — 20 etapas

> **Data**: 2026-05-23
> **Branch**: `claude/code-bug-analysis-VLG0u`
> **PR**: #124
> **Origem**: solicitação do sponsor pós-auditoria `docs/AUDITORIA-EXAUSTIVA-2026-05-23.md`
> **Estratégia**: 1 commit por etapa, validação local antes de cada push

## Sequência

### Quick wins / desbloqueio CI (1-5)
- [x] **Etapa 1** — Fix P5: rename 3 params PascalCase em `AdminStandardRules.test.tsx:107-113` (desbloqueia ESLint gate)
- [x] **Etapa 2** — Fix 3 empty catches: `ShortcutsHelpDialog.tsx:20`, `EnhancedSpotlight.tsx:25`, `SidebarBrandHeader.tsx:16`
- [x] **Etapa 3** — Atualizar `.eslint-baseline.json` (capitalizou 31 erros eliminados: 473→442 erros, 409→404 arquivos)
- [x] **Etapa 4** — T-FIX-3: bump GH Actions (`checkout@v4→v5`, `setup-node@v4→v6`, `upload-artifact@v4→v5`) — 60 usos atualizados em 12 workflows
- [x] **Etapa 5** — T-FIX-5: apply `eslint.config.t-fix-5.proposed.js` → `eslint.config.js` + `check:proposed-configs` script

### Post-mortem CRM bridge (6-8)
- [x] **Etapa 6** — Issue 1: criar `docs/operations/cadastro-secrets-supabase.md` (POP)
- [x] **Etapa 7** — Issue 2: adicionar `validateUrlFormat` em `supabase/functions/_shared/connection-test-runner.ts`
- [x] **Etapa 8** — Issue 2: testes de `validateUrlFormat` (15 testes cobrindo os 6 cenários da spec + bitrix24/n8n/webhook_outbound/mcp)

### Redução tsc-baseline — top 5 arquivos (9-13)
- [ ] **Etapa 9** — Refatorar `src/lib/personalization/adapters/price-response.adapter.ts` (61 erros)
- [ ] **Etapa 10** — Refatorar `src/pages/admin/AdminProductFormPage.tsx` (60)
- [ ] **Etapa 11** — Refatorar `src/components/admin/products/new-supplier/tabs/AddressTab.tsx` (56)
- [ ] **Etapa 12** — Refatorar `src/components/admin/products/new-supplier/tabs/BasicDataTab.tsx` (32)
- [ ] **Etapa 13** — Refatorar `src/components/compare/CompareTableView.tsx` (26)

### Redução eslint-baseline — top arquivos (14-16)
- [ ] **Etapa 14** — Reduzir `src/components/admin/connections/SupabaseConnectionsTab.tsx` (17 warnings)
- [ ] **Etapa 15** — Reduzir `src/components/catalog/CatalogContent.tsx` (16) + `ProductQuickView.tsx` (16)
- [ ] **Etapa 16** — Reduzir `src/hooks/simulator/useSimulatorWizard.ts` (15) + `useGlobalSearch.ts` (12)

### Pendências menores (17-19)
- [ ] **Etapa 17** — T-FIX-5b: antipadrão B residual em testes
- [x] **Etapa 18** — `QuoteBuilderStepper.test.tsx:68` forEach vazio — removido it() no-op (ícones mockados não testam classes do real)
- [x] **Etapa 19** — `ScenarioSimulation.test.ts` Scenario 2 CIF/FOB — teste desatualizado vs schema real, agora cobre fob_pre + cif corretamente (2 passing)

### Conclusão (20)
- [ ] **Etapa 20** — Atualizar `STATUS.md`, `SESSIONS.md`, `AUDITORIA-EXAUSTIVA-2026-05-23.md` + marcar PR #124 ready for review

## Notas de execução

- Cada etapa: 1 commit + 1 push. Marcar checkbox quando feita.
- Se etapa bloqueada por dependência externa (sponsor, chave), documentar e pular.
- Etapas 9-16 podem ter sub-commits se forem grandes demais.
- Etapa 20 fecha a sessão.
