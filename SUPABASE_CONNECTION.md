# Conexão Supabase — SSOT (Single Source of Truth)

> 🔒 **Invariante do repositório.** Este documento é a fonte da verdade para
> qualquer decisão sobre qual projeto Supabase é o banco canônico da Promo
> Brindes. Alterações aqui exigem revisão explícita — ver `CLAUDE.md` §REGRA #1.

## ✅ Banco canônico (produção)

| Campo | Valor |
|---|---|
| **Project ID** | `doufsxqlfjyuvxuezpln` |
| **API URL** | `https://doufsxqlfjyuvxuezpln.supabase.co` |
| **Dashboard** | https://supabase.com/dashboard/project/doufsxqlfjyuvxuezpln |
| **Status** | ✅ Verified and Active — contém o schema Medallion Bronze/Silver/Gold + dados reais |
| **Usado por** | App em produção, migrations, edge functions, catálogo, orçamentos |

Todo `CREATE`/`ALTER`/`DROP`, toda migration, toda edge function, todo cron e
toda RLS policy vive **exclusivamente** neste projeto.

## ⚠️ Projeto legado (NÃO usar)

| Campo | Valor |
|---|---|
| **Project ID** | `pqpdolkaeqlyzpdpbizo` |
| **Natureza** | Lovable Cloud interno — auto-provisionado, **sem dados reais** |
| **Status** | 🚫 Legado — não é fonte da verdade |

- Não rodar migrations, edge functions ou schema changes contra ele.
- Não apontar `client.ts`, `.env`, tipos ou CI para ele.
- Menções a este ID em documentos históricos (`docs/redeploy/`, logs de fase,
  auditorias antigas) descrevem o **estado passado do incidente 401** e
  permanecem por razões arqueológicas — não são instruções operacionais.

## 🛡️ Guardas em CI

- `scripts/validate-supabase-config.mjs` — Gate 0 do CI, falha se
  `CURRENT_PROJECT_ID` em `src/integrations/supabase/client.ts` divergir.
- `scripts/guard-canonical-project.mjs` — falha o build se qualquer
  referência executável ao ID legado for detectada.
- `.github/CODEOWNERS` + `.lovableignore` — proteção contra reversões do
  Lovable no arquivo `client.ts`.

## 📎 Auditoria de documentação

- Última varredura: **2026-07-15** — ver
  [`docs/audit/DOC_SSOT_AUDIT_2026-07-15.md`](docs/audit/DOC_SSOT_AUDIT_2026-07-15.md).
- Resultado: **0** instruções operacionais apontando ao projeto legado;
  24 menções ao legado, todas classificadas como `LEGACY_INFORMATIVO`.

---

## Supabase Project Connection (English)

This project is connected to an external Supabase instance.

- **Project ID:** `doufsxqlfjyuvxuezpln`
- **API URL:** `https://doufsxqlfjyuvxuezpln.supabase.co`
- **Dashboard URL:** https://supabase.com/dashboard/project/doufsxqlfjyuvxuezpln
- **Status:** Verified and Active

**Important:** Do not use the internal Lovable-managed Supabase project
(`pqpdolkaeqlyzpdpbizo`) for database operations, migrations, or edge
functions. Always target `doufsxqlfjyuvxuezpln`.
