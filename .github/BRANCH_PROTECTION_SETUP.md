# Como ligar Branch Protection em `main` (5 minutos)

> **Por que isso é necessário:** o `Branch Protection Sentinel` (workflow) é só
> um **alarme post-mortem** — ele detecta pushes direto em `main` depois que
> já aconteceram. A **prevenção real** vem da configuração nativa do GitHub.

## Pré-requisito

Permissão de **admin** no repositório `adm01-debug/promo-gifts-v4` (o owner já tem).

## Passo a passo

### 1. Acesse a configuração de branches

Vá em: <https://github.com/adm01-debug/promo-gifts-v4/settings/branches>

### 2. Clique em **Add branch ruleset** (ou "Add rule" se for UI antiga)

> A GitHub renomeou "branch protection rules" para "rulesets" em 2023.
> Ambos funcionam — o ruleset é mais flexível.

### 3. Configure o ruleset

**Nome:** `Protect main`

**Enforcement status:** `Active`

**Target branches:** clique em `Add target` → `Include default branch` (ou explicitamente `main`)

### 4. Marque estas regras

| Regra | Valor recomendado | Motivo |
|---|---|---|
| ✅ **Restrict deletions** | ON | Impede `git push --delete origin main` |
| ✅ **Block force pushes** | ON | Impede `git push --force` que reescreve histórico |
| ✅ **Require a pull request before merging** | ON | A prevenção principal — força PR |
| └─ Required approvals | `0` (solo) ou `1` (com revisor) | Para solo dev, deixar 0 já basta — o ato de abrir PR já é o controle |
| └─ Dismiss stale approvals when new commits are pushed | ON | Boa prática |
| ✅ **Require status checks to pass** | ON | Garante que CI roda antes do merge |
| └─ Adicione: `Verify push to main matches accepted patterns` | | (nome do job do sentinel) |
| └─ Adicione: `Verify Branch Protection is enabled on main` | | (job paralelo do sentinel) |
| └─ Adicione: `Verify required checks SSOT matches workflows (+ Branch Protection)` | | (valida SSOT `.github/required-checks.json`) |
| └─ Adicione: `Risco de Ruptura — fuzz (800 sims, 10 invariantes)` | | (fuzz do filtro de Risco de Ruptura — bloqueia merge se invariante quebrar) |
| └─ Adicione: `Schema Drift Gate` *(se existir)* | | Drift do plano de redeploy |

| ⚪ Require signed commits | OFF (opcional) | Só se você assina com GPG/SSH |
| ⚪ Require linear history | ON (opcional) | Força squash/rebase, proíbe merge commit |

### 5. Bypass list (chave-mestra rastreável)

Em **Bypass list**, clique em `Add bypass` e adicione:

- **adm01-debug** com modo `For pull requests` (mais conservador) ou `Always` (mais flexível)

> **Recomendação:** comece com `Always` para o owner enquanto o repo é pequeno
> e solo. Se entrarem colaboradores, mude para `For pull requests` ou remova
> totalmente — aí o owner vira só mais um dev que abre PR.
>
> Toda vez que o bypass é usado, o GitHub registra no log de auditoria:
> `Settings → Audit log`. Rastreável.

### 6. Salve

Clique em **Create** (ou **Save changes**).

## Validação

Depois de salvar:

1. Aguarde 30s para a config propagar.
2. Vá na aba **Actions** e rode manualmente o workflow `Branch Protection Sentinel`
   (botão `Run workflow`).
3. No Summary do run, o job `Verify Branch Protection is enabled on main`
   deve mostrar **✅ Branch `main` está protegida**.
4. O job `Verify required checks SSOT matches workflows (+ Branch Protection)`
   deve mostrar **✓** para todos os itens de `.github/required-checks.json`
   (e nenhum `::warning::` sobre check ausente no Branch Protection).

## Status check ainda não aparece na lista de busca?

O GitHub só lista um status check como selecionável **depois que ele rodou
pelo menos uma vez** num PR/commit. Se você acabou de criar o workflow
`stock-rupture-fuzz` e o nome `Risco de Ruptura — fuzz (800 sims, 10 invariantes)`
não aparece no autocomplete:

- Abra um PR pequeno que toque `src/lib/inventory/**` (qualquer arquivo serve),
  **ou**
- Vá em **Actions → stock-rupture-fuzz → Run workflow** e dispare manualmente.

Após o primeiro run com sucesso/falha, o nome fica disponível para seleção.

## Adicionando novos required checks

A lista canônica vive em [`.github/required-checks.json`](./required-checks.json).
Para adicionar um novo check:

1. Edite o JSON acrescentando `{ "name": "...", "workflow": "...", "rationale": "..." }`
   — o `name` precisa ser **idêntico** ao campo `name:` do job no workflow.
2. Commit. O job `check-required-checks-ssot` do Sentinel valida automaticamente
   que o `name` existe no workflow indicado (falha o CI se houver drift).
3. Marque o novo check como required na UI do GitHub conforme tabela acima.


## Teste prático (opcional, mas recomendado)

Para confirmar que está funcionando, tente um push direto:

```bash
git checkout main
echo "teste" >> sentinel-smoke-test.md
git add sentinel-smoke-test.md
git commit -m "test: deve ser bloqueado"
git push origin main
# Depois de validar, limpar:
git reset --hard HEAD~1
rm -f sentinel-smoke-test.md
```

Resultado esperado:

```text
remote: error: GH006: Protected branch update failed for refs/heads/main.
remote: error: Required status check "..." is expected.
To github.com:adm01-debug/promo-gifts-v4.git
 ! [remote rejected] main -> main (protected branch hook declined)
```

Se aparecer essa mensagem: **funcionando.** 🎉

Se o push passar (porque seu usuário está no bypass list em modo `Always`), o
sentinel ainda vai disparar e registrar o uso do bypass no run — defesa em
profundidade.

## Desligar (em caso de necessidade)

Mesma página, clique no ruleset → **Disable** (não delete — desligar mantém a
config para reativação rápida).

## Referências

- [GitHub Docs — About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [GitHub Docs — Bypass list](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/managing-rulesets-for-a-repository#granting-bypass-permissions-for-a-ruleset)
