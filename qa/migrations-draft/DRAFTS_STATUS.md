# Rastreamento draft → migration → DB

_Atualizado em 2026-07-01T11:12:20.433Z · 5 rascunho(s) · **sem acesso ao DB** (ERROR:  permission denied for schema supabase_migrations)._

Gerado por `scripts/map-drafts-to-migrations.mjs`. Não editar à mão.

## Legenda

- ✅ **aplicada** — existe migration versionada correspondente E o `version` está em `supabase_migrations.schema_migrations`.
- 🟠 **versionada, não aplicada** — foi promovida para `supabase/migrations/` mas o DB canônico ainda não a executou.
- 🟡 **não promovido** — só existe rascunho; nenhuma migration canônica bate com o slug.
- ❔ **sem acesso ao DB** — status não pôde ser consultado (PG indisponível ou sem permissão).

### Como ler a coluna "Candidatos"

- **🎯 slug exato** — o nome do arquivo canônico contém o slug completo do draft (match 100%).
- **N%** — fuzzy por tokens: `N = tokens do slug encontrados / total`. Só aparece se ≥ 60% e ≥ 3 tokens (ou todos, se slug tiver menos).
- `token` — apareceu no nome do arquivo canônico.
- ~~`token`~~ — está no slug do draft mas **não** no candidato (sinal de divergência semântica).

## Tabela

| Rascunho | Slug (tokens) | Candidatos em `supabase/migrations/` | Status no DB |
| --- | --- | --- | --- |
| `2026-06-18_security_definer_acl.sql` | `security_definer_acl`<br>`security` `definer` `acl` | _(nenhum match)_ | 🟡 não promovido |
| `2026-06-19_kit_dimensions_backfill.sql` | `kit_dimensions_backfill`<br>`kit` `dimensions` `backfill` | _(nenhum match)_ | 🟡 não promovido |
| `2026-06-19_reposicao_variants_summary.sql` | `reposicao_variants_summary`<br>`reposicao` `variants` `summary` | _(nenhum match)_ | 🟡 não promovido |
| `2026-06-20_revoke_secdef_from_authenticated.sql` | `revoke_secdef_from_authenticated`<br>`revoke` `secdef` `from` `authenticated` | `20260512222200_t28_pilot_revoke_admin_security_definer_from_anon_authenticated.sql` — **75%**<br>&nbsp;&nbsp;↳ bateu: `revoke` `from` `authenticated` · faltou: ~~`secdef`~~<br><br>`20260605014545_revoke_fn_process_raw_v2_execute_from_anon_authenticated.sql` — **75%**<br>&nbsp;&nbsp;↳ bateu: `revoke` `from` `authenticated` · faltou: ~~`secdef`~~ | ❔ ERROR:  permission denied for schema supabase_migrations |
| `2026-06-27_quotes_status_allow_cancelled.sql` | `quotes_status_allow_cancelled`<br>`quotes` `status` `allow` `cancelled` | _(nenhum match)_ | 🟡 não promovido |

## Archived (2026-07-16 — Magazine DB Audit)

The following magazine-related drafts were moved to `_archived/` — see `_archived/README.md` for details:

| Rascunho | Motivo |
| --- | --- |
| `2026-07-12_magazines.sql` | STALE — schema divergiu do BD live (`branding` JSONB, colunas faltando) |
| `2026-07-12_magazine_reader_state.sql` | INCOMPATÍVEL — `magazine_token` vs `magazine_token_hash` |
| `2026-07-12_magazine_items_unique_product.sql` | JÁ APLICADA — constraint existe no BD |
| `2026-07-15_magazine_public_token_trigger.sql` | JÁ APLICADA — trigger existe no BD |

## Como agir

- **🟡 não promovido** → revisar o rascunho e, quando aprovado, copiar para `supabase/migrations/<timestamp>_<slug>.sql` (ver `qa/migrations-draft/README.md`).
- **🟠 versionada, não aplicada** → verificar por que o `db push` não rodou; pode ser drift real ou marker faltando em `schema_migrations`.
- **✅ aplicada** → deletar o arquivo do `qa/migrations-draft/` (dupla verdade proibida).
