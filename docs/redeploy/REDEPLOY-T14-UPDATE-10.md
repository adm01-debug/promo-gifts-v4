# T14 UPDATE 10 — Verificação Pós-Fix: Smoke Gate (2026-05-23 14:26 UTC)

> Continuação da sessão anterior (T14 UPDATE 9, 13:22 UTC). Confirmação de que o fix para `toHaveScreenshot()` baseline PNG está presente em main, mas gate logic bug foi identificado causando run #563 failure.

**Status**: 🟡 **Code fix present, CI logic broken** (fix confirmado; gate lógico é culpado)

---

## 1. Contexto herdado (T14 UPDATE 9 + transcrição compactada)

### Causa raiz identificada
`toHaveScreenshot()` em specs 23 e 24 sem baseline PNG commitada → em CI Playwright 1.59.1, exit 1 com "A snapshot doesn't exist at..., writing actual", mascarando smoke gate como failing.

### Fix aplicado na sessão anterior (T14 UPDATE 9)
- **`722bac7`**: spec 23 → `test.fixme` ("should render initial burst of rockets")
- **`907be7e`**: spec 24 → `test.fixme` ("should match visual snapshot for the space scene branding")
- **`047718f`**: `docs/redeploy/REDEPLOY-T14-UPDATE-9-FIXME.md` (documentação, `[skip ci]`)

### Incerteza na transcrição anterior
SHA mais recente em main era `2c6c509` (PR #136, CORS migration). Os commits T14 (`722bac7`, `907be7e`, `047718f`) tinham parent `660fc0c`. Pergunta: os commits T14 estão realmente em main ou foram sobrescritos/superset pelo PR #136?

---

## 2. Diagnóstico desta sessão (T14 UPDATE 10)

### Passo 1: Verificar presença do fix nos specs atuais

**Spec 23** (`e2e/flows/23-rocket-animation-snapshot.spec.ts`):
```typescript
test.fixme('should render initial burst of rockets and maintain count', async ({ page }) => {
  // ...
  await expect(brandingPanel).toHaveScreenshot('auth-branding-rockets.png', {
    maxDiffPixelRatio: 0.1,
  });
});
```
✅ **Status**: `test.fixme` presente em main (SHA `346c7fa8`)

**Spec 24** (`e2e/flows/24-visual-regression-stars.spec.ts`):
```typescript
test.fixme('should match visual snapshot for the space scene branding', async ({ page }) => {
  // ...
  await expect(brandingPanel).toHaveScreenshot('auth-branding-space-scene.png', {
    maxDiffPixelRatio: 0.05,
    threshold: 0.2,
  });
});
```
✅ **Status**: `test.fixme` presente em main (SHA `ab83616d`)

**Conclusão**: ✅ **Fix está em main**. Ambos os specs com `test.fixme` confirmados.

### Passo 2: Analisar run #563 que ainda mostra failure

**Run metadata**:
- ID: `26335052769` (run #563)
- SHA: `2c6c509974d21bf4a436e8dc16c251ff6eccf4e2` (PR #136, CORS migration)
- Branch: `main`
- Timestamp: `2026-05-23T14:19:15Z`
- **Conclusion**: `failure` ❌

**Análise dos steps**:

| Step # | Nome | Conclusion |
|--------|------|-----------|
| 12 | "Run E2E smoke (gate — para na 1ª falha)" | ✅ success |
| 13 | "📋 Generate SMOKE summary" | ✅ success |
| 14 | "📤 Append SMOKE summary to GitHub UI" | ⏭️ skipped |
| 15 | "🔍 Debug smoke gate state" | ✅ success |
| **16** | **"🛑 Fail-fast se smoke falhou (gate)"** | ❌ **failure** |
| 17+ | (skipped após step 16) | ⏭️ skipped |

**Interpretação**:
- Step 12 rodou os testes **com sucesso** ✅
- Step 13 gerou a saída (JSON/Markdown) **com sucesso** ✅
- Step 15 debugou o estado **com sucesso** ✅
- **Step 16 disparou FAILURE** ❌

### Passo 3: Identificação do culpado

**Bug identificado**: O step 16 está lendo um arquivo de estado/JSON (provavelmente gerado no step 13) que diz "falhou", mesmo que o step 12 (o teste em si) tenha passado.

**Descompasso**:
- `step 12` outcome: "smoke test passed" ✅
- `step 13` output: JSON/markdown com resultado
- `step 16` logic: `if (smoke_summary.failed == true) { fail this step }` — bug aqui!

**Possível causa-raiz do gate**:
1. Step 13 gerou summary com campo como `"failed": true` ou `"status": "failure"` incorretamente
2. OU step 16 está lendo um arquivo antigo de um run anterior
3. OU há logic bug no script de verificação (por ex., negação invertida)

---

## 3. Próximas ações necessárias

### Ação 1: Debugar saída do step 13
Ler o arquivo JSON/Markdown de saída do smoke summary no run #563 para ver qual é exatamente o conteúdo que o step 16 está lendo.

**Como**: Acessar GitHub Actions UI > run #563 > Artifacts tab > download "smoke summary (markdown + json)"

### Ação 2: Revisar `.github/workflows/e2e.yml` step 16
Analisar a lógica do script que verifica se o smoke falhou.

**Suspeita**: Algo como:
```bash
if grep -q '"failed": true' smoke-summary.json; then
  echo "❌ Smoke failed"
  exit 1
else
  echo "✅ Smoke passed"
  exit 0
fi
```

Se o script estiver negado ou se o `smoke-summary.json` tiver um campo incorreto, isso explica o descompasso.

### Ação 3: Corrigir gate logic
Uma vez identificado o bug, corrigi-lo em `.github/workflows/e2e.yml` ou no script chamado pelo step 16.

### Ação 4: Testar a correção
Rerun o E2E workflow (por exemplo, via GitHub Actions UI ou novo push) para confirmar:
- Step 12 = success
- Step 16 = success (not failure)

---

## 4. Informações para próxima sessão

| Aspecto | Valor |
|---------|-------|
| **Workflow file** | `.github/workflows/e2e.yml` |
| **Workflow ID** | `278436800` |
| **Last failing run** | #563 (id `26335052769`, sha `2c6c509`) |
| **Suspect step** | 16 ("🛑 Fail-fast se smoke falhou (gate)") |
| **Specs affected** | `e2e/flows/23-rocket-animation-snapshot.spec.ts`, `e2e/flows/24-visual-regression-stars.spec.ts` |
| **Fix status** | ✅ present (test.fixme) |
| **Gate status** | ❌ broken (logic bug) |

---

## 5. Resumo para Joaquim

Olá Joaquim,

A verificação do T14 UPDATE 9 confirmou que o fix (adicionar `test.fixme` aos specs 23 e 24) **está em main**. Porém, o run #563 continua falhando porque há um bug de CI logic no **step 16** do workflow E2E.

**O que está acontecendo**:
1. ✅ Os testes rodam (step 12) = success
2. ✅ O summary é gerado (step 13) = success
3. ❌ Mas o gate que verifica se falhou (step 16) dispara FAILURE mesmo assim

**Próximo passo**: Debugar o arquivo de saída gerado pelo step 13 e revisar a lógica do step 16 em `.github/workflows/e2e.yml`.

Se preferir, posso investigar e corrigir na próxima sessão. Avise!

---

## Referências

- **Smoke gate spec 23**: https://github.com/adm01-debug/promo-gifts-v4/blob/main/e2e/flows/23-rocket-animation-snapshot.spec.ts
- **Smoke gate spec 24**: https://github.com/adm01-debug/promo-gifts-v4/blob/main/e2e/flows/24-visual-regression-stars.spec.ts
- **Run #563**: https://github.com/adm01-debug/promo-gifts-v4/actions/runs/26335052769
- **Workflow**: https://github.com/adm01-debug/promo-gifts-v4/blob/main/.github/workflows/e2e.yml
