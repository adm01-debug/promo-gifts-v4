# 📚 docs/redeploy/

Pasta com toda a documentação do redeploy de schemas (alinhamento Lovable Cloud ↔ Supabase Oficial).

## 🎓 Manual reutilizável

**Se você é outro Claude em outro projeto Lovable, comece aqui:**

1. [`MANUAL-MIGRACAO-LOVABLE-PARA-SUPABASE-OFICIAL.md`](./MANUAL-MIGRACAO-LOVABLE-PARA-SUPABASE-OFICIAL.md) — **Parte 1** (Fases 0/1/2)
2. [`MANUAL-PARTE-2.md`](./MANUAL-PARTE-2.md) — **Parte 2** (Fases 3/3.5/4/1.1 + templates + troubleshooting)

O manual foi escrito pelo Claude que executou a primeira migração bem-sucedida (Promo Gifts V4), pensando em outras instâncias do Claude que vão repetir o processo em outros projetos.

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
4. Logs de execução (exemplos concretos)
```

## 💡 Princípios fundamentais (resumo)

1. **Banco é SSOT** — `apply_migration` direto, nunca `supabase db push`
2. **Pré-validar antes de mutar** — `SELECT count(*)` + FKs + deps + código no repo
3. **Wave por wave** — uma melhoria de cada vez, com excelência
4. **Allowlist auditável** — divergências aceitáveis vão para `schema_drift_allowlist`
5. **Documentar tudo** — relatório + migration commitada para sobreviver a session resets

## 🎯 Estado atual do Promo Gifts V4

| Fase | Status |
|---|:---:|
| Fase 0 — Descoberta | ✅ |
| Fase 2 — Órfãs/funções/crons | ✅ |
| Fase 3.1–3.4 — Drift correction | ✅ |
| Fase 3.5 — Allowlist | ✅ |
| Fase 4 — Gate CI cron | ✅ |
| Fase 1.1 — Legacy cleanup | ✅ |
| PR no app (desbloqueio definitivo) | 🔴 PENDING |

Gate CI: `has_drift = false` ✅

## 🛠 Migrations relacionadas

Veja [`supabase/migrations/`](../../supabase/migrations/) — busque por arquivos `2026052*_align_wave_*` e `2026052*_fase_1_1_*` e `2026052*_fix_has_drift*`.
