# 📚 docs/redeploy/

Pasta com toda a documentação do redeploy de schemas (alinhamento Lovable Cloud ↔ Supabase Oficial).

## 🎓 Manual reutilizável

**Se você é outro Claude em outro projeto Lovable, comece aqui:**

1. [`MANUAL-MIGRACAO-LOVABLE-PARA-SUPABASE-OFICIAL.md`](./MANUAL-MIGRACAO-LOVABLE-PARA-SUPABASE-OFICIAL.md) — **Parte 1** (Fases 0/1/2)
2. [`MANUAL-PARTE-2.md`](./MANUAL-PARTE-2.md) — **Parte 2** (Fases 3/3.5/4/1.1 + templates + troubleshooting)
3. [`MANUAL-APENDICE-D-MIGRACAO-DADOS.md`](./MANUAL-APENDICE-D-MIGRACAO-DADOS.md) — **Apêndice D** (migração de dados em chunks + ON CONFLICT)

O manual foi escrito pelo Claude que executou a primeira migração bem-sucedida (Promo Gifts V4), pensando em outras instâncias do Claude que vão repetir o processo em outros projetos.

### O que cada parte cobre

| Arquivo | Cobre | Quando ler |
|---|---|---|
| Parte 1 | Cenário, descoberta arquitetural, pré-requisitos, mapa, Fases 0/1/2 | Sempre — primeiro |
| Parte 2 | Fases 3 (waves), 3.5 (allowlist), 4 (Gate CI), 1.1 (legacy cleanup), templates, troubleshooting, checklist | Sempre — em sequência |
| Apêndice D | Migração de **dados** (não só schema): chunks, ON CONFLICT, checkpoint, validação | Quando precisar mover linhas de uma tabela do Lovable para o Oficial |

## 📋 Logs de execução (Promo Gifts V4)

Estes são os relatórios reais da primeira execução. Servem de exemplo concreto:

- [`FASE-1.1-EXECUTION-LOG.md`](./FASE-1.1-EXECUTION-LOG.md) — DROP de 3 legacy fantasma
- [`FASE-3.5-EXECUTION-LOG.md`](./FASE-3.5-EXECUTION-LOG.md) — 8 schema drift → 0 + allowlist
- [`FASE-4-GATE-CI.md`](./FASE-4-GATE-CI.md) — Arquitetura + ops runbook do Gate CI

## 🗺 Ordem de leitura

```
1. README.md (você está aqui)
2. MANUAL Parte 1 (introdução, Fase 0/1/2)
3. MANUAL Parte 2 (Fase 3/3.5/4/1.1 + templates)
4. Apêndice D (somente se for migrar dados, não só schema)
5. Logs de execução (exemplos concretos)
```

## 💡 Princípios fundamentais (resumo)

1. **Banco é SSOT** — `apply_migration` direto, nunca `supabase db push`
2. **Pré-validar antes de mutar** — `SELECT count(*)` + FKs + deps + código no repo
3. **Wave por wave** — uma melhoria de cada vez, com excelência
4. **Allowlist auditável** — divergências aceitáveis vão para `schema_drift_allowlist`
5. **Documentar tudo** — relatório + migration commitada para sobreviver a session resets
6. **Idempotência** (especial dados) — `ON CONFLICT DO NOTHING` em todo INSERT bulk
7. **Checkpoint retomável** — `data_migration_log` permite retomar migração interrompida

## 🎯 Estado atual do Promo Gifts V4

| Fase | Status |
|---|:---:|
| Fase 0 — Descoberta | ✅ |
| Fase 2 — Órfãs/funções/crons | ✅ |
| Fase 3.1–3.4 — Drift correction | ✅ |
| Fase 3.5 — Allowlist | ✅ |
| Fase 4 — Gate CI cron | ✅ |
| Fase 1.1 — Legacy cleanup | ✅ |
| **Fase 5 — Migração de dados** | ⚪ não iniciada (manual existe em Apêndice D) |
| PR no app (desbloqueio definitivo) | 🔴 PENDING |

Gate CI: `has_drift = false` ✅

## 🛠 Migrations relacionadas

Veja [`supabase/migrations/`](../../supabase/migrations/) — busque por arquivos `2026052*_align_wave_*` e `2026052*_fase_1_1_*` e `2026052*_fix_has_drift*`.

## 🚀 Para começar uma nova migração em outro projeto

Cole isso num chat novo do Claude:

```
Vou fazer a mesma migração Lovable Cloud → Supabase Oficial em outro projeto.

Manual completo (3 arquivos):
- https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/redeploy/MANUAL-MIGRACAO-LOVABLE-PARA-SUPABASE-OFICIAL.md
- https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/redeploy/MANUAL-PARTE-2.md
- https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/redeploy/MANUAL-APENDICE-D-MIGRACAO-DADOS.md

Leia os 3, depois me ajude a executar começando pela Fase 0.

Projeto Lovable: <id>
Supabase Oficial: <id>
Repo GitHub: <owner/repo>

Vou migrar dados também? <sim/não — se sim, ler também o Apêndice D>
```
