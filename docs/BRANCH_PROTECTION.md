# 🔒 Branch Protection — `main`

**Status alvo:** ✅ Ativa
**Configuração final:** UI do GitHub (não pode ser feita via API com `GITHUB_TOKEN` padrão)
**Defesa em profundidade:** este repo tem o workflow `branch-protection-sentinel.yml` como camada CI auxiliar.

---

## 1. Por que isso importa

Sem branch protection:
- Qualquer pessoa com acesso write pode `git push --force` em `main` e reescrever histórico
- PRs podem ser mergeados sem revisão
- Gitleaks pode falhar e ser ignorado
- Builds quebrados podem entrar em `main`

Com branch protection:
- Force-push bloqueado
- PR + 1 approval obrigatórios
- CI checks (Gitleaks) bloqueiam merge se falharem
- Histórico imutável → audit trail confiável

## 2. Como ativar (passo a passo no UI)

1. Acessar https://github.com/adm01-debug/Promo_Gifts/settings/branches
2. Clicar em **Add branch protection rule**
3. Em **Branch name pattern**: digitar `main`
4. Marcar (ordem recomendada):
   - ☑ **Require a pull request before merging**
     - ☑ Require approvals → `1`
     - ☑ Dismiss stale pull request approvals when new commits are pushed
   - ☑ **Require status checks to pass before merging**
     - ☑ Require branches to be up to date before merging
     - Adicionar ao "Search for status checks":
       - `Lint, Typecheck & Test` (job crítico de lint + testes em `.github/workflows/ci.yml`)
       - `Production Build & Warnings Gate` (job crítico de build em `.github/workflows/ci.yml`)
       - `TypeScript gate (PR fail-fast)` (gate rápido para bloquear regressão de tipos)
       - `Gitleaks — Secret Scan` (de `.github/workflows/security.yml`)
       - `Verify push to main matches accepted patterns` (de `.github/workflows/branch-protection-sentinel.yml`)
     - ✅ **Não marcar** "Require branches to be up to date before merging" como opcional: manter marcado para evitar merge com checks antigos.
     - ✅ Em "Status checks that are required", deixar **somente checks finais** (não steps intermediários).
     - 🔒 Resultado prático: merge fica bloqueado quando qualquer check obrigatório estiver **pending**, **failed** ou **cancelled**.
   - ☑ **Require conversation resolution before merging**
   - ☑ **Do not allow bypassing the above settings**
   - ☐ Allow force pushes (deixar **DESmarcado**)
   - ☐ Allow deletions (deixar **DESmarcado**)
5. Clicar em **Create**

## 3. Validação

### Teste 1 — Force push deve falhar

```bash
git checkout main
git commit --allow-empty -m "test: force push attempt"
git push --force origin main
```

Resultado esperado:
```
! [remote rejected] main -> main (protected branch hook declined)
```

### Teste 2 — PR sem approval não merge

Abrir um PR simples e clicar em **Merge** sem aprovar primeiro. O botão deve estar **desabilitado**.

### Teste 3 — CI pendente/vermelho bloqueia merge

Abrir PR com `package.json` malformado de propósito. Mesmo com 1 approval, merge fica bloqueado até CI ficar verde.

### Teste 4 — CI pendente bloqueia merge

Abrir PR e, enquanto os jobs obrigatórios ainda estiverem rodando (status **Expected — Waiting for status to be reported** ou **Pending**), validar que o botão **Merge** permanece desabilitado.

## 4. Workflow auxiliar (defesa em profundidade)

`.github/workflows/branch-protection-sentinel.yml` é uma camada CI que detecta padrões anômalos de push em `main` e falha o build. **Não substitui a configuração UI**, mas:

- Documenta a política como código
- Serve de audit log na aba Actions
- Cobre o caso de admin contornar inadvertidamente

## 5. Exceções operacionais

Nenhuma. Hotfixes seguem o mesmo fluxo PR + approval. Se houver incidente que exija bypass, registrar em `docs/INCIDENTS/` com justificativa.

## 6. Revisão periódica

A cada trimestre:
- Confirmar que regra continua ativa
- Revisar lista de status checks obrigatórios (lint, build e testes críticos)
- Auditar logs de override
