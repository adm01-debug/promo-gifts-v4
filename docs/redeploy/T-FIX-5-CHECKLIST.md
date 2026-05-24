# T-FIX-5 — Checklist de Ativação

**Owner**: Joaquim (`adm01@promobrindes.com.br`)
**Origem**: sessão T-FIX-5 (commits `c129d54`, `57d9f8f`, `c033e71`, `bdaae3d`)
**Status atual**: 4 commits no `main` prontos; 3 passos manuais pendentes
**Tempo total estimado**: < 5 minutos

---

## 🎯 Por que este checklist existe

A sessão do agente que produziu o T-FIX-5 **não conseguiu fazer apply direto** do `eslint.config.js` via MCP (limitação técnica: sem acesso ao blob SHA do arquivo existente). Os artefatos ficaram prontos no repo, mas dependem de 3 ações manuais para virarem efetivos.

Sem este checklist, esses passos viram **dependentes de memória humana** — Joaquim teria que lembrar 3 coisas espalhadas em N mensagens de chat. Este arquivo serve para:

1. Sobreviver a context resets (chat fecha, arquivo continua no repo)
2. Permitir auditoria item-a-item (cada ✅ vira commit fechando o item)
3. Eliminar ambiguidade sobre o que falta

---

## ✅ Critérios de aceitação (definição de "pronto")

- [ ] Regra ESLint do T-FIX-5 (anti-padrão A) ativa em `npm run lint:check`
- [ ] `eslint.config.t-fix-5.proposed.js` **removido** do repo (cleanup)
- [ ] Script `check-eslint-config-current.mjs` integrado ao quality gate
- [ ] Suite vitest do script descoberta e executada (22/22 PASS)

Depois de marcar tudo, este arquivo pode ser deletado ou movido para `docs/redeploy/done/`.

---

## 📋 Passo 1 — Aplicar a config (≈1 min)

### Sub-passos

```bash
cd promo-gifts-v4
git pull origin main

# Substitui a config pelo proposed
mv eslint.config.t-fix-5.proposed.js eslint.config.js

# Valida que não quebrou nada
npm run lint:check
# Esperado: 0 erros novos, 0 warnings novos
# Se aparecer erro 'no-restricted-syntax' apontando para algum arquivo,
# é uma violação REAL — refatore o arquivo para usar it.each/describe.each

# Commit
git add eslint.config.js
git status  # eslint.config.t-fix-5.proposed.js deve aparecer como deletado
git commit -m "chore(lint): T-FIX-5 — apply lint guard-rail (anti-padrão A)"
git push origin main
```

### Critério de sucesso

- [ ] `git ls-files | grep proposed` retorna **vazio** (arquivo proposed foi removido)
- [ ] `npm run lint:check` exit code 0
- [ ] Commit pushed no `main`

### Plano B (se algum arquivo quebrar)

Se aparecer `no-restricted-syntax` em algum arquivo de teste:

1. Inspecione o arquivo apontado pelo lint
2. Localize o `forEach(... it/test/describe ...)`
3. Refatore para `it.each(data)('label $name', (item) => {...})`
4. Re-rode `npm run lint:check` até passar
5. Faça parte do mesmo commit (não merge a regra sem corrigir as violações)

---

## 📋 Passo 2 — Integrar script no quality gate (≈30 s)

### Sub-passos

```bash
# Adiciona entry no package.json
npm pkg set scripts.check:proposed-configs="node scripts/check-eslint-config-current.mjs --strict"

# Valida que funciona
npm run check:proposed-configs
# Esperado: '✅ no orphaned *.proposed.* configs in repo root' + exit 0
# Se Passo 1 não foi feito, vai mostrar 1 orphan e sair 1 — corrija o Passo 1 primeiro

# Edita package.json para que test:quality chame o novo script.
# Encontre a linha "test:quality" e adicione "&& npm run check:proposed-configs" no final.
# Exemplo (ajuste conforme o valor atual):
#   "test:quality": "vitest run --exclude 'tests/hooks/**' && npm run check:proposed-configs"

# Commit
git add package.json
git commit -m "ci(lint): T-FIX-5 — integra check:proposed-configs no quality gate"
git push origin main
```

### Critério de sucesso

- [ ] `npm pkg get scripts.check:proposed-configs` retorna a string esperada
- [ ] `npm run check:proposed-configs` exit code 0
- [ ] `npm run test:quality` continua passando (com o novo check incluído)

---

## 📋 Passo 3 — Validar a suite de testes do script (≈1 min)

### Sub-passos

```bash
# Roda a suite específica
npm test -- scripts/__tests__/check-eslint-config-current.test.ts

# Esperado: 22/22 PASS
```

### Plano B (se vitest não descobrir a suite)

Se o output mostrar **0 specs encontradas**, o `vitest.config.ts` provavelmente tem `include` restrito a `src/**` ou `tests/**`. Para resolver:

```bash
# Abra vitest.config.ts e adicione ao array de include:
#   'scripts/__tests__/**/*.test.ts'

# Re-rode
npm test -- scripts/__tests__/check-eslint-config-current.test.ts

# Commit
git add vitest.config.ts
git commit -m "test(config): T-FIX-5 — inclui scripts/__tests__ no vitest"
git push origin main
```

### Critério de sucesso

- [ ] `npm test` descobre a suite (não retorna "0 spec files found")
- [ ] 22/22 testes PASS

---

## 🗺️ Mapa de dependências entre passos

```
Passo 1 (aplicar config) ──┬─→ Passo 2 (integrar script)
                           │
                           └─→ Passo 3 (validar suite)
```

Passos 2 e 3 são independentes entre si e podem ser executados em qualquer ordem **após** o Passo 1. Mas todos os 3 devem ser feitos antes de marcar o T-FIX-5 como concluído.

---

## 🔗 Referências

| Item | Localização |
|------|-------------|
| Bug original (CI run que mascarou 3 falhas) | <https://github.com/adm01-debug/promo-gifts-v4/actions/runs/26303752735> |
| Documentação completa do guard-rail | `docs/redeploy/T-FIX-5-LINT-GUARDRAIL.md` |
| Config proposta (Passo 1) | `eslint.config.t-fix-5.proposed.js` (raiz do repo) |
| Script anti-órfão (Passo 2) | `scripts/check-eslint-config-current.mjs` |
| Suite de testes (Passo 3) | `scripts/__tests__/check-eslint-config-current.test.ts` |
| Commits do T-FIX-5 | `c129d54`, `57d9f8f`, `c033e71`, `bdaae3d` |

---

## 📋 Backlog após este checklist

Quando os 3 passos estiverem ✅:

| Item | Tipo | Quando |
|------|------|--------|
| T-FIX-5b — Anti-padrão B (`expect` dentro de `forEach` dentro de `it`) | Próxima iteração lint | Quando time decidir tratar os 2 falsos positivos |
| T-FIX-3 — Bump GitHub Actions (`checkout@v4→v5`, `setup-node@v4→v6`, `upload-artifact@v4→v5`) | Manutenção | Cutoff **2026-06-02** |
| Deletar `docs/redeploy/T-FIX-5-CHECKLIST.md` (este arquivo) | Cleanup | Após os 3 passos fecharem |
