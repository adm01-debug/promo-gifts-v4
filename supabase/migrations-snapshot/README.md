# supabase/migrations-snapshot

Snapshots consolidados **read-only** para auditoria do schema.
**Não aplicar direto no banco.** A SSOT continua sendo `supabase/migrations/`.

## Arquivos

| Arquivo | Origem | Descrição |
|---|---|---|
| `ALL_IN_ONE.sql` | `supabase/migrations/**` | Concatenação alfabética de todas as migrations versionadas. |
| `SCHEMA_LIVE.sql` | `supabase db dump --linked --schema public` | Dump do schema `public` vivo do projeto canônico (`doufsxqlfjyuvxuezpln`). |
| `SCHEMA_DRIFT.sql` | `supabase db diff --linked --schema public` | DDL restante entre as migrations e o schema vivo (ideal: vazio). |
| `SNAPSHOT_META.json` | script | Metadados: timestamp, project ref, contagens. |

## Como regenerar

```bash
# Apenas ALL_IN_ONE.sql (não requer credenciais):
npm run schema:snapshot

# Também SCHEMA_LIVE.sql + SCHEMA_DRIFT.sql (requer CLI supabase + secrets):
SUPABASE_ACCESS_TOKEN=... SUPABASE_DB_PASSWORD=... npm run schema:snapshot
```

O script é safe-by-default: sem CLI/secrets ele apenas emite `ALL_IN_ONE.sql` e
avisa que os arquivos live/drift foram pulados.
