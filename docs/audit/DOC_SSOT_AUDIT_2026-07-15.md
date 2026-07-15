# Auditoria de Documentação — SSOT Supabase

**Data:** 2026-07-15
**Escopo:** todos os arquivos `.md` do repositório
**Objetivo:** garantir que 100% da documentação declare corretamente o banco
canônico e sinalize o projeto legado sem instruir seu uso operacional.

## 🎯 Referência canônica

| Papel | Project ID | URL |
|---|---|---|
| ✅ **SSOT (produção)** | `doufsxqlfjyuvxuezpln` | https://doufsxqlfjyuvxuezpln.supabase.co |
| ⚠️ **Legado (Lovable Cloud interno, sem dados)** | `pqpdolkaeqlyzpdpbizo` | — |

## 📊 Inventário

Varredura via `rg -n "pqpdolkaeqlyzpdpbizo|doufsxqlfjyuvxuezpln" . --glob '*.md'`.

| Métrica | Antes | Depois |
|---|---:|---:|
| Total de linhas com referências | 196 | 199 |
| Ocorrências de `doufsxqlfjyuvxuezpln` (SSOT) | 177 | 180 |
| Ocorrências de `pqpdolkaeqlyzpdpbizo` (legado) | 24 | 24 |
| Docs de topo declarando SSOT explicitamente | 2 | **5** |

## 🔎 Classificação das 24 menções ao legado

Cada uma foi lida e classificada. **Nenhuma** é instrução operacional
incorreta — todas descrevem o legado como legado.

| Arquivo:linha | Categoria | Ação |
|---|---|---|
| `CLAUDE.md:22` | `LEGACY_INFORMATIVO` — regra proíbe uso | manter |
| `CLAUDE.md:26` | `LEGACY_INFORMATIVO` — regra de substituição | manter |
| `SUPABASE_CONNECTION.md:9` | `LEGACY_INFORMATIVO` — aviso explícito | reforçado (bloco PT-BR completo) |
| `docs/AUDITORIA_200_COMMITS_2026-06-20.md:48` | `LEGACY_INFORMATIVO` — auditoria histórica | manter |
| `docs/AUDITORIA_E2E_2026-05-22.md:91` | `LEGACY_INFORMATIVO` — comando `git grep` de detecção | manter |
| `docs/INTEGRACAO_FRONTEND_MEDALLION.md:124` | `LEGACY_INFORMATIVO` — descreve reversão do Lovable | manter |
| `docs/INTEGRACAO_MEDALLION_FRONT.md:22` | `LEGACY_INFORMATIVO` — marca explicitamente como legado | manter |
| `docs/QUOTES_STATUS_TOOLTIPS.md:89` | `LEGACY_INFORMATIVO` — aviso operacional | manter |
| `docs/QUOTES_STATUS_TOOLTIPS.md:96` | `LEGACY_INFORMATIVO` — proibição explícita | manter |
| `docs/prompts/magazine-module-implementation-prompt.md:23` | `LEGACY_INFORMATIVO` — proibição em prompt | manter |
| `docs/redeploy/FASE-1.1-EXECUTION-LOG.md:6,54,112` | `LEGACY_INFORMATIVO` — log histórico de execução | manter |
| `docs/redeploy/FASE-3.5-EXECUTION-LOG.md:8,28,34` | `LEGACY_INFORMATIVO` — log histórico | manter |
| `docs/redeploy/FASE-4-GATE-CI.md:9,59,63` | `LEGACY_INFORMATIVO` — descreve gate anti-drift | manter |
| `docs/redeploy/SESSIONS.md:256` | `LEGACY_INFORMATIVO` — descreve foco da sessão | manter |
| `qa/CANONICAL_PROJECT_REPORT.md:7` | `LEGACY_INFORMATIVO` — cita ID legado como bloqueado no guard | manter |
| `qa/migrations-draft/README.md:58` | `LEGACY_INFORMATIVO` — proibição explícita | manter |
| `qa/reports/magazine-followup-2026-07-12.md:42` | `LEGACY_INFORMATIVO` — proibição operacional | manter |
| `supabase/MIGRATIONS_README.md:53` | `LEGACY_INFORMATIVO` — proibição explícita | manter |

**Total por categoria:**

- `CANONICAL_OK`: 177 (todas as menções ao SSOT em contexto adequado).
- `LEGACY_INFORMATIVO`: 24 (todas as menções ao legado com contexto claro).
- `INCORRETO`: **0** ✅
- `AMBIGUO`: **0** ✅
- `URL_QUEBRADA`: **0** ✅

## ✏️ Arquivos alterados nesta auditoria

| Arquivo | Mudança |
|---|---|
| `SUPABASE_CONNECTION.md` | Reescrito em PT-BR com bloco SSOT completo, URL da API, tabela do legado, seção de guardas CI e link para este relatório. Bloco em inglês preservado ao final. |
| `README.md` | Adicionado box "🔒 SSOT — Banco canônico" no topo da seção "🗄 Banco de Dados", incluindo `doufsxqlfjyuvxuezpln`, host `.supabase.co` e link para `SUPABASE_CONNECTION.md`. |
| `CONTRIBUTING.md` | Adicionado callout de SSOT no topo, apontando ao `SUPABASE_CONNECTION.md`. |
| `docs/audit/DOC_SSOT_AUDIT_2026-07-15.md` | Este relatório. |

## 🔒 Documentos de topo (após auditoria)

| Doc | Declara SSOT? | Cita legado como legado? |
|---|---|---|
| `CLAUDE.md` (REGRA #1) | ✅ | ✅ |
| `SUPABASE_CONNECTION.md` | ✅ (PT-BR + EN) | ✅ |
| `README.md` (§ Banco de Dados) | ✅ (novo box) | via link |
| `CONTRIBUTING.md` | ✅ (novo callout) | via link |
| `SECURITY.md` | n/a (não menciona banco) | n/a |

## 🛡️ Fora de escopo (não alterado)

- Nenhum arquivo `.ts`, `.tsx`, `.js`, `.mjs`, `.json`, `.yml`, `.toml`, `.sql`.
- Nenhuma migration, edge function, RLS policy, schema.
- `src/integrations/supabase/client.ts` (protegido — invariante).
- `.eslint-baseline.json` e testes.

## ✅ Critérios 10/10

- [x] 0 documentos com instrução operacional apontando ao projeto legado.
- [x] 100% dos docs de topo declaram o SSOT com URL da API.
- [x] Todas as menções ao legado permanecem, marcadas como legado/histórico.
- [x] Zero alteração em código, schema ou config.
- [x] Relatório publicado com inventário antes/depois.

## 📎 Comandos de reprodução

```bash
# inventário completo
rg -n "pqpdolkaeqlyzpdpbizo|doufsxqlfjyuvxuezpln" . --glob '*.md'

# só o legado (deve retornar 24, todas contextualizadas)
rg -n "pqpdolkaeqlyzpdpbizo" . --glob '*.md'

# validar guarda do client.ts (Gate 0)
node scripts/validate-supabase-config.mjs
```
