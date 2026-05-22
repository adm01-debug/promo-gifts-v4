# 📡 Status do Projeto

> **Estado operacional do redeploy hardening do `promo-gifts-v4`.**
> Para entender o produto, ver [`README.md`](./README.md).
> Para o histórico completo de sessões, ver [`docs/redeploy/SESSIONS.md`](./docs/redeploy/SESSIONS.md).

---

## 🎯 Onde estamos hoje

**Última sessão**: 2026-05-22 — **T-FIX-5** (Lint guard-rail contra `forEach()` em testes).

| Métrica | Valor |
|---------|-------|
| Sessões de hardening concluídas | T-FIX-4 (5 commits) + T-FIX-5 (6 commits) + Bugs #1/#2 + Redeploy de schemas |
| Camadas de defesa do T-FIX-5 | 3 (regra ESLint + script anti-órfão + suite de testes do script) |
| Passos manuais pendentes (Joaquim) | 3 (ver checklist abaixo) |
| Próximo cutoff iminente | **T-FIX-3** em 2026-06-02 (bump GitHub Actions) |

---

## ⏳ Pendências do sponsor (Joaquim)

### T-FIX-5 — Ativar lint guard-rail (< 5 min)

📋 **Checklist**: [`docs/redeploy/T-FIX-5-CHECKLIST.md`](./docs/redeploy/T-FIX-5-CHECKLIST.md)

3 passos sequenciais:

1. `mv eslint.config.t-fix-5.proposed.js eslint.config.js` + commit
2. `npm pkg set scripts.check:proposed-configs="..."` + integrar no quality gate
3. Validar suite vitest (`npm test -- scripts/__tests__/`)

Critério de pronto: 4 checkboxes marcados no checklist + arquivo `eslint.config.t-fix-5.proposed.js` removido do repo.

---

## 🗺️ Navegação rápida

Para diferentes perfis que abrem o repo:

| Quem | O que olhar primeiro |
|------|-----------------------|
| **Novo dev** querendo entender o produto | [`README.md`](./README.md) |
| **Sponsor** querendo ver o que falta fechar | Este arquivo (`STATUS.md`) → seção *Pendências* |
| **Code reviewer** entendendo decisões recentes | [`docs/redeploy/SESSIONS.md`](./docs/redeploy/SESSIONS.md) (dashboard executivo) |
| **Agente IA novo** continuando o trabalho | [`docs/redeploy/SESSIONS.md`](./docs/redeploy/SESSIONS.md) → entrada mais recente |
| **Auditor** verificando trilha de mudanças | `docs/redeploy/T-FIX-*-*.md` (artefatos por sessão) |

---

## 📅 Backlog priorizado

| Prioridade | Item | Origem | Cutoff |
|------------|------|--------|--------|
| 🟡 Alta | T-FIX-5 — 3 passos manuais (ver checklist) | T-FIX-5 sessão 2026-05-22 | ASAP |
| 🟡 Alta | **T-FIX-3** — bump GitHub Actions (`checkout@v4→v5`, `setup-node@v4→v6`, `upload-artifact@v4→v5`) | Backlog herdado | **2026-06-02** |
| 🟡 Média | Plano "10/10" #3, #4, #5 (coverage, quality runner, ESLint baseline) | Bugs anteriores | Sem cutoff |
| 🟢 Baixa | T-FIX-5b — anti-padrão B (`expect` em `forEach` em `it`) | T-FIX-4 audit | Sem cutoff |
| 🟢 Baixa | `QuoteBuilderStepper.test.tsx:68` forEach vazio | T-FIX-4 audit | Sem cutoff |
| 🟢 Baixa | `ScenarioSimulation.test.ts` 1 fail Scenario 2 CIF/FOB | Sessão anterior | Sem cutoff |
| 🟢 Baixa | Flakiness teardown async Helmet/Event listener | Sessão anterior | Sem cutoff |

---

## 🔄 Atualização deste arquivo

Este arquivo deve ser atualizado **ao final de cada sessão** que produz mudanças no estado operacional do projeto. Padrão BPM:

1. Sessão fecha → última entrada adicionada em `SESSIONS.md`
2. Pendências mudam → seção `Pendências do sponsor` atualizada aqui
3. Backlog reordena → seção `Backlog priorizado` revisada aqui
4. Commit conjunto: `docs(status): refresh após sessão <X>`

> 💡 Quando o redeploy hardening tiver lead time zero (sem pendências, sem backlog crítico), este arquivo pode virar um simples "✅ projeto estável — sem hardening em curso" e ficar dormente até a próxima onda de melhorias.
