# T14 — UPDATE 13 (CAUSA RAIZ REAL: BASE64 EM SPECS COMMITADOS)

**Data**: 2026-05-23 (sessão pós UPDATE 12)
**Operador**: Agente Claude (novo)
**Sponsor**: Joaquim (adm01-debug)
**Status**: ✅ FIX APLICADO — aguardando CI verde para fechar T14

## TL;DR

A saga T14 (UPDATEs 1–12) atacou hipóteses erradas por **12 iterações**: gate logic, `hashFiles()` vs `test -f`, `continue-on-error`, baseline PNG sem `--update-snapshots`, etc. **Nenhuma sessão anterior abriu o conteúdo dos specs commitados em `main`**. A causa real é trivial:

| Commit | Arquivo | Estado no blob |
|---|---|---|
| `722bac76` | `e2e/flows/23-rocket-animation-snapshot.spec.ts` | Base64 (1 linha, sem terminator) — não é TypeScript |
| `907be7ef` | `e2e/flows/24-visual-regression-stars.spec.ts` | Base64 (1 linha, sem terminator) — não é TypeScript |
| `047718fb` | `docs/redeploy/REDEPLOY-T14-UPDATE-9-FIXME.md` | Base64 (1 linha) — não bloqueia CI mas é o mesmo bug |

## Reprodução do diagnóstico (qualquer um pode repetir)

```bash
git clone https://github.com/adm01-debug/promo-gifts-v4 repo && cd repo
file e2e/flows/23-rocket-animation-snapshot.spec.ts
# → ASCII text, with very long lines (3380), with no line terminators
git cat-file -p HEAD:e2e/flows/23-rocket-animation-snapshot.spec.ts | head -c 100
# → aW1wb3J0IHsgdGVzdCwgZXhwZWN0IH0gZnJvbSAnQHBsYXl3cmlnaHQvdGVzdCc7Cg... (base64)
base64 -d < e2e/flows/23-rocket-animation-snapshot.spec.ts | head -3
# → import { test, expect } from '@playwright/test';
#   (TypeScript válido depois de decodificar)
```

Validação por commit de origem:

```bash
git cat-file -p 722bac76^:e2e/flows/23-rocket-animation-snapshot.spec.ts | head -c 50
# → import { test, expect } from '@playwrigh... (TS válido no pai)
git cat-file -p 722bac76:e2e/flows/23-rocket-animation-snapshot.spec.ts  | head -c 50
# → aW1wb3J0IHsgdGVzdCwgZXhwZWN0IH0gZnJvbSAn... (base64 a partir desse commit)
git show --stat 722bac76
# → 1 file changed, 1 insertion(+), 50 deletions(-)
#   ↑ o agente apagou 50 linhas e inseriu 1 linha (a base64 do conteúdo)
```

## Por que Playwright falha

Quando Playwright importa o spec (resolve `testMatch: /flows\/(20|22|23|24)/`), o parser TS lê uma "linha" começando com `aW1w` — não é JavaScript válido. Exit 1 **antes de qualquer teste rodar**, antes do reporter `github`/`list`/`json` produzir uma única linha de saída útil. O step com `continue-on-error: true` reporta `success` na API; o `touch playwright-report/.smoke-passed` é `&&`-chained e portanto **não executa**; o gate `test -f` corretamente detecta ausência do marker e dispara `exit 1`.

**Conclusão**: o gate fail-fast estava CORRETO o tempo todo. O fix do `hashFiles()` no UPDATE 12 foi uma **melhoria genuína** (determinismo), mas não era a causa raiz. A causa raiz era o conteúdo do spec ilegível desde o UPDATE 9.

## Por que os 12 UPDATEs anteriores não pegaram

1. **API GitHub mascara o problema**: `github_list_workflow_run_jobs` mostra `step 12: success` (devido ao `continue-on-error`), levando à interpretação "o teste passou, é o gate que está errado".
2. **Nenhum UPDATE rodou `git cat-file` nos specs alterados** — todos confiaram que o conteúdo no blob era o conteúdo "lógico" do TS visto em mensagens de commit.
3. **`git diff` no GitHub UI renderiza base64 como texto**, sem indicar que o arquivo é uma única linha gigante.
4. **Re-instâncias do agente herdam o diagnóstico anterior** via `userMemories` ("test.fixme já aplicado") sem revalidar fisicamente o conteúdo em disco.

## Fix aplicado

Os 3 arquivos foram recodificados como UTF-8 texto plano. O conteúdo **lógico** é exatamente o que o UPDATE 9 pretendia commitar (validado por `base64 -d`):

- Spec 23: `test.fixme('should render initial burst of rockets...')` mantido; `test('should cleanup rockets after duration')` mantido (assertion DOM, não snapshot).
- Spec 24: `test.fixme('should match visual snapshot for the space scene branding')` mantido; `test('should verify star brightness presence in DOM')` mantido (assertion DOM).
- Doc UPDATE 9: 118 linhas de markdown decodificadas.

## Validação esperada no próximo run E2E

| Step | Esperado |
|---|---|
| 12 (`Run E2E smoke`) | ✅ `success` (exit 0, smoke passa, `touch .smoke-passed` executa) |
| 13 (`Generate SMOKE summary`) | ✅ `success` |
| 14 (`Append SMOKE summary to GitHub UI`) | ✅ `success` (não `skipped`) |
| 15 (`🔍 Debug smoke gate state`) | ✅ `success` + log "Marker: present (smoke exit 0)" |
| 16 (`🛑 Fail-fast se smoke falhou`) | ⏭️ `skipped` (porque `! test -f .smoke-passed` é falso) |
| 17 (`Header sticky gate`) | ✅ `success` ou falha legítima |
| 18+ | seguir conforme header-sticky e regression |

Se o run **continuar falhando após este fix**, será por OUTRO motivo (header sticky regression real, baseline visual desatualizada etc.), e o log do step 15 vai revelar.

## Reabilitar testes visuais (próximo passo, não escopo deste PR)

Conforme procedimento documentado no próprio UPDATE 9:

1. `npm run test:e2e:smoke -- --update-snapshots` (gera baselines localmente em Linux)
2. Commitar PNGs em `e2e/flows/23-rocket-animation-snapshot.spec.ts-snapshots/` e `e2e/flows/24-visual-regression-stars.spec.ts-snapshots/`
3. Remover `test.fixme` (voltar para `test`)
4. Validar em CI

## Lições aprendidas (durável para futuras instâncias)

1. **Sempre `git cat-file -p HEAD:<file> | head -c 200` ANTES de assumir que o conteúdo do repo é o conteúdo lógico** — especialmente após commits feitos por agente via MCP `github_create_or_update_file`.
2. **Quando usar `github_create_or_update_file` do MCP, enviar conteúdo UTF-8 plain — o MCP cuida da codificação base64 para o transport**. NÃO enviar base64 manualmente no parâmetro `content`.
3. **`continue-on-error: true` + `&&` chain é frágil**: se o comando falhar antes do `&&`, o marker não é criado. Use `;` + checagem explícita de exit code com `$?` capture em arquivo separado se quiser preservar diagnóstico mesmo em failure mode.
4. **API workflow_run_jobs reporta `conclusion` (que pode ser sobrescrito por `continue-on-error`), não `outcome`** — sempre validar com logs do step `🔍 Debug smoke gate state` (ou equivalente).
5. **`git show --stat` revela commits suspeitos**: "1 insertion, N deletions" em arquivo TS de mais de 1 linha é red flag — significa que o arquivo virou linha única (provavelmente base64).
6. **`file <arquivo>`** mostra "very long lines, with no line terminators" → suspeitar de base64/binário.

## Refs

- Run que iniciou esta sessão: [#425 (id 26301868515)](https://github.com/adm01-debug/promo-gifts-v4/actions/runs/26301868515) — commit `2346d72`
- Último run pré-fix: [#570](https://github.com/adm01-debug/promo-gifts-v4/actions) — commit `3e296eb`
- UPDATEs anteriores: `REDEPLOY-T14-UPDATE-9-FIXME.md`, `REDEPLOY-T14-UPDATE-10.md`, `REDEPLOY-T14-UPDATE-12.md`
- Commits que introduziram o bug: `722bac76`, `907be7ef`, `047718fb`
- Versão Playwright: `@playwright/test@^1.59.1`
