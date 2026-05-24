# T14 — UPDATES 3 & 4 (validação desta sessão)

**Data**: 2026-05-22 (~23:30 UTC)
**Operador**: Agente Claude
**Sponsor**: Joaquim (adm01-debug)
**Status**: ✅ FIX APLICADO — aguardando auto-debug do smoke gate (este push)

## TL;DR

Após o UPDATE 2 (recovery de base64-duplo + per-test timeout 90s), os runs
E2E ainda falhavam no gate, MAS o smoke step em si rodava por 2min54s antes
da falha — sinal de que o problema era de **gate logic**, não de timeout.

Aplicados dois patches:
- **UPDATE 3** (`7b506096`): substituí `outcome != 'success'` por **marker-file pattern**
- **UPDATE 4** (`e96134c4`): adicionei **auto-commit do diagnóstico** em `docs/redeploy/T14-AUTO-DEBUG.md`

Resultado revelador: marker-file pattern confirmou que **o Playwright realmente
sai com exit ≠ 0** mesmo quando todos os smoke specs "passam" visualmente —
não era ruído do GitHub Actions `outcome`. Causa real está agora sendo
capturada pelo auto-debug commit deste push.

## UPDATE 3 — Marker-file pattern (commit `7b506096`)

### Causa raiz da troca

`steps.<id>.outcome` em GitHub Actions é o exit code **RAW** do step (antes de
`continue-on-error` ser aplicado). Em todos os runs (#459 sha `1fa53507`,
#463 sha `7b506096`), o smoke step rodava success na API (`conclusion=success`,
2min54s) mas o `outcome` raw estava `failure` — disparando o gate.

Hipótese inicial: ruído (warnings, retry counters, quirks do reporter JSON).
Marker-file pattern faria o gate ler do filesystem (não do `outcome`), eliminando ambiguidade.

### Implementação

4 condicionais trocadas + 2 markers introduzidos:

```yaml
# Smoke step — só cria marker se exit 0 explícito
- name: Run E2E smoke (gate)
  run: |
    mkdir -p playwright-report
    npx playwright test ... && touch playwright-report/.smoke-passed

# Gate — checa filesystem (determinístico)
- name: 🛑 Fail-fast se smoke falhou (gate)
  if: hashFiles('playwright-report/.smoke-passed') == ''

# Header-sticky e regression idem (com marker .header-sticky-passed)
```

### Resultado

Run #463 e workflow_dispatch #465 ambos:
- step 12 (smoke) → conclusion=success em 2min19s
- step 15 (debug) → conclusion=success
- **step 16 (gate) → FAILURE → marker absent → exit ≠ 0 do Playwright confirmado**

A hipótese de "ruído" caiu. É exit code real ≠ 0 — precisamos descobrir QUAL teste/quirk.

## UPDATE 4 — Auto-commit do diagnóstico (commit `e96134c4`)

Sem MCP para download de artifacts (exige auth) e sem acesso aos logs textuais do GH Actions UI via API, o output do `🔍 Debug smoke gate state` ficava invisível remotamente.

Solução: expandir o step para **commit automático em `docs/redeploy/T14-AUTO-DEBUG.md`** via `gh api`.

### Conteúdo do diagnóstico

- outcome / conclusion / marker presence
- `ls -la playwright-report/`
- `head -100 playwright-report/smoke-summary.md`
- Parse de `results.json` com:
  - `stats` (passed, failed, skipped, expected, unexpected, flaky, etc.)
  - `errors_count` + `errors_first_3`
  - `results_by_status`
  - `non_passing[:15]` (testes que não-passaram com título, status, duration, error)

### Salvaguardas

- `[skip ci]` na commit message → não dispara loop de workflows
- `if: github.event_name == 'push'` → só commita em push real
- `permissions: contents: write` no job → `GITHUB_TOKEN` pode escrever
- Fallbacks `|| echo "(failed)"` → step não falha se commit der erro
- Log no console **sempre** acontece (visível na UI mesmo se commit falhar)

### Bug detectado e corrigido durante este patch

Versão inicial tinha `walk()` recursivo com chamada duplicada dentro do loop spec, que inflaria os resultados. Detectado pela validação local (`python3 -c "compile(...)"`) antes do commit. Corrigido.

## Validação pós-commit (durabilidade)

Ambos os commits validados via `github_get_contents`:

| Commit | Blob | Size | `decoded_content` starts with |
|---|---|---|---|
| `7b506096` (UPDATE 3) | `13e29e40` | 14487 bytes | `name: E2E (Playwright)` ✅ |
| `e96134c4` (UPDATE 4) | `6aeff506` | 20294 bytes | `name: E2E (Playwright)` ✅ |

UTF-8 puro nos dois — sem corrupção base64-duplo (lição da sessão paralela do UPDATE 2 aplicada).

## Próximo passo automático

Este commit (push event em main) vai disparar o E2E. O step `🔍 Debug smoke gate state` agora:

1. Vai rodar como sempre (`if: always()`)
2. Coletar o diagnóstico completo
3. **Comitar `docs/redeploy/T14-AUTO-DEBUG.md` automaticamente** (porque `event_name == 'push'`)
4. Com `[skip ci]` na mensagem → não dispara loop infinito

Após ~5min, basta ler o arquivo via `github_get_contents path=docs/redeploy/T14-AUTO-DEBUG.md` para descobrir QUAL teste/quirk do Playwright está causando exit ≠ 0. Hipóteses em ordem de probabilidade:

1. Algum teste @smoke realmente falhou (ex.: 23 rocket-animation ou 24 visual-regression com timeout 5s hardcoded)
2. `test.fixme` no spec 22 sendo contado como "expected-failure" pelo runner → exit ≠ 0
3. `--forbid-only` detectou `test.only` em algum spec não-smoke importado
4. Bug do reporter JSON ao escrever path

## Como confirmar que UPDATE 4 funcionou

1. Aguardar ~5min após este push
2. `github_list_workflow_runs` → ver run E2E novo no SHA deste commit
3. Job `e2e` step 15 (`🔍 Debug smoke gate state`) deve mostrar conclusion=success
4. `github_get_contents path=docs/redeploy/T14-AUTO-DEBUG.md` → arquivo deve existir
5. Conteúdo deve mostrar `marker present: ❌ NO (smoke exit != 0)` (esperado)
6. `non_passing` array deve identificar QUAL teste falhou

Se o arquivo NÃO for criado, possíveis causas:
- `GITHUB_TOKEN` sem `contents:write` (mitigado por `permissions: contents: write` no job)
- Race condition com outro push simultâneo (mitigado por `|| echo "(failed)"`)
- Erro de sintaxe no script bash do step (validado pré-commit)

## Commits desta sessão

| SHA | Arquivo | Descrição |
|---|---|---|
| `7b506096` | `.github/workflows/e2e.yml` | UPDATE 3 — marker-file pattern em 4 steps + debug step |
| `e96134c4` | `.github/workflows/e2e.yml` | UPDATE 4 — auto-commit do diagnóstico via gh api |
| (este) | `docs/redeploy/REDEPLOY-T14-UPDATE-3-AND-4.md` | Validação durável desta sessão + trigger do auto-debug |

Refs:
- `docs/redeploy/REDEPLOY-T14-E2E-FIX.md` (UPDATEs 1 + 2)
- Run #459 (sha `1fa53507`) — primeiro com smoke step conclusion=success mas gate disparando
- Run #463 (sha `7b506096`) — primeiro com marker-file confirmando exit ≠ 0
- Run #465 (sha `e96134c4`, workflow_dispatch) — confirmou que `event != 'push'` pula auto-commit
- Próximo run desta sessão (este push) — primeiro com auto-commit ativo
