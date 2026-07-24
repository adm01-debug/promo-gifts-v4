# SSOT Supabase — Painel de Saúde

> Última atualização: 2026-07-15
> Escopo: gates de proteção do banco canônico `doufsxqlfjyuvxuezpln`.

## Sinal verde (o que garantimos)

| Camada | Gate | Cobertura | Onde roda |
|---|---|---|---|
| Config runtime | `scripts/validate-supabase-config.mjs` | `client.ts` aponta ao canônico; sem `pqpdolkaeqlyzpdpbizo` em código executável (comentários históricos ignorados). | CI + `pre-commit` (fast-path) + `npm run ssot:validate` |
| Runtime + configs | `scripts/guard-canonical-project.mjs` | 4 fases: (1) src/functions runtime, (2) `client.ts`/`config.toml` ancorados, (3) docs `.md` operacionais, (4) configs `.yml/.yaml/.toml/.env*/.json`. | CI + `pre-commit` (fast-path) + `npm run ssot:guard` |
| URLs em docs | `scripts/check-docs-supabase-hosts.mjs` | Toda URL `*.supabase.co` operacional em `.md` deve ser do canônico ou de allowlist (CRM externo). | CI + `pre-commit` (fast-path) + `npm run ssot:hosts` |
| Testes | `tests/ssot/ssot-gates.fuzz.test.ts` | 26 cenários adversariais (operacional × informacional × canônico × bloco de código × unlabeled). | Vitest padrão |

## Como executar tudo

```bash
npm run ssot:all
```

## Onde falha um PR

- **Menção operacional ao legado sem marcador em `.md`:** aparece na Fase 3 do guard como `⚠️  OPERACIONAL`.
- **URL não-canônica em `.md`:** aparece no `check-docs-supabase-hosts.mjs` com o ref detectado.
- **Referência ao legado em `.yml/.toml/.json` sem marcador:** aparece na Fase 4 do guard.
- **`client.ts` divergente:** Gate 0 (`ssot:validate`) falha imediatamente.

## Marcadores legítimos

Uma linha (ou 2 linhas anteriores) contendo qualquer um destes marcadores classifica a menção ao legado como informacional:

- `[LEGACY_INFORMATIVO]`, `projeto legado`, `deprecated`, `obsoleto`, `⚠️`
- `Do not use`, `Don't use`, `NÃO USE`, `NÃO USAR`, `nunca`, `never`
- `histórico`, `historical`, `forbidden`, `proibido`
- `sem dados reais`, `Lovable Cloud interno`
- `re-apontar`, `substitua por`, `banco canônico`

## Caminhos históricos tolerados

Menções sem marcador são toleradas **apenas** em (e desde que não sejam operacionais):
`docs/redeploy/`, `docs/audit/`, `docs/AUDITORIA_*`, `docs/prompts/history/`, `qa/reports/`, `qa/migrations-draft/`, `qa/CANONICAL_PROJECT_REPORT.md`, `.lovable/`.

## Simulação (200+ cenários)

`tests/ssot/ssot-gates.fuzz.test.ts` executa 26 permutações determinísticas + templates × contextos. Ampliar cenários requer só adicionar entradas em `opTemplates`/`legacyMarkers`.

## Referências

- SSOT canônico: [`SUPABASE_CONNECTION.md`](../../SUPABASE_CONNECTION.md)
- Regras vinculantes: [`CLAUDE.md`](../../CLAUDE.md) §REGRA #1
- Auditoria de docs: [`DOC_SSOT_AUDIT_2026-07-15.md`](DOC_SSOT_AUDIT_2026-07-15.md)
- Checklist para revisões de PR: [`CONTRIBUTING.md`](../../CONTRIBUTING.md) §SSOT
