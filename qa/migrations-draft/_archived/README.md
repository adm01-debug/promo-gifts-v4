# Archived Draft Migrations

These migrations were archived on 2026-07-16 during the Magazine DB audit
(PR #1705). They are kept for reference only — do NOT apply them.

| File | Reason |
|------|--------|
| `2026-07-12_magazines.sql` | STALE — uses `client_brand_colors` but live DB uses `branding` (JSONB). Missing `view_count`, `archived_at`, `deleted_at` columns. |
| `2026-07-12_magazine_reader_state.sql` | INCOMPATIBLE — declares `magazine_token` but live DB uses `magazine_token_hash` (SHA-256). |
| `2026-07-12_magazine_items_unique_product.sql` | ALREADY APPLIED — constraint exists in live DB. |
| `2026-07-15_magazine_public_token_trigger.sql` | ALREADY APPLIED — trigger `generate_magazine_public_token` exists in live DB. |
