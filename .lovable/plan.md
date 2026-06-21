# Global Technical Audit & Hardening Plan

Last updated: 2026-06-20 — post-audit pass (AUDIT_READONLY_2026-06-19).

## Status Legend
- ✅ Done   🔄 In progress   ⏳ Pending   🚫 Blocked

---

## 1. 🛒 Reposição / Replenishment Feature — Ondas 1-4

### Onda 1 — Variants Summary RPC + UI ✅
- `fn_get_reposicao_variants_summary(uuid[])` live in Gold (v3, 2026-06-19)
  - TZ: America/Sao_Paulo; boundary: strictly > today
  - `product_variants` + `variant_supplier_sources` UNION ALL
  - Permissions: `authenticated` + `service_role`; `anon` blocked
- `useReposicaoVariantsSummary` hook consumes via `untypedRpc`
- `ReplenishmentCards`, `ReplenishmentProductGrid`, `VirtualizedReplenishmentGrid/List` built
- `ReplenishmentToolbar`, `ReplenishmentStatsCards`, `RecentReplenishmentsWidget` built
- `ReplenishmentsPage` and `ReplenishmentBadge` complete

### Onda 2 — Badge "Reposto: X" (restocked today) ⏳
- Needs: `product_variants.last_restock_at timestamptz` column + trigger
  (fires when `stock_quantity` transitions 0 → > 0)
- Migration pending. Options evaluated in VALIDATION.md GAP-F:
  - **Recommended**: 1 column `last_restock_at` + 1 trigger (lowest schema cost)
  - Alternative: daily snapshot table (higher infra cost)
  - Heuristic fallback: fragile, not recommended

### Onda 3 — Selection mode + bulk actions 🔄
- `useReplenishmentsSelectionMode` hook built
- Bulk-action UX pending finalization

### Onda 4 — Notifications / alerting ⏳
- `ReplenishmentBadge` stub exists
- End-to-end notification flow not yet designed

---

## 2. 🔐 Database Security & Hardening

### Security Definer ACL ✅
- `audit_security_definer_acl()` returns 0 violations (verified 2026-06-20)
- Drafts reviewed: `2026-06-18_security_definer_acl.sql` and
  `2026-06-20_revoke_secdef_from_authenticated.sql` — DB already clean

### RLS & Function Grants ✅
- `search_path = public` set on critical functions
- REVOKE / GRANT aligned to `authenticated` / `service_role` policy

### Kit Dimensions Backfill 🚫 Blocked
- 42 kits missing `length_cm`, `width_cm`, or `height_cm`
- `fn_calculate_kit_dimensions` cannot fill these: 0 components have
  `is_packaging = true` (no packaging component defined for these kits)
- Requires: manual data entry or supplier enrichment

---

## 3. ⚡ Code Quality & Hook Architecture

### useNovelties split (< 500 LOC rule) ✅
- `novelty-core.ts` (338 lines) extracted: types, constants, pure fns
- `useNovelties.ts` reduced 767 → 472 lines; backward-compat re-exports in place

### AbortController on raw fetch() calls ✅
- `useIPValidation.ts` — 5 s timeout on ipify.org fallback
- `usePasswordBreachCheck.tsx` — 8 s timeout + stale-request cancellation
- All other hooks in `src/hooks/` already had AbortController

### as any / : any baseline gate ✅
- `.any-type-baseline.json` frozen at 0 production hits
- `scripts/check-any-type-baseline.mjs` (Gate 2.3) added to CI

### Event listener cleanup ✅
- `useFutureStockPreference.ts`, `ShortcutsHelpDialog.tsx`,
  `DevAccessDeniedPage.tsx` — all have `removeEventListener` in useEffect return

### useCatalogState test skip ⏳
- `useCatalogState.unit.test.tsx:100` has `describe.skip` due to memory exhaustion
- Needs DI refactor to break import chain (Supabase + multi-store deps)
- Tracked as P1-1; separate PR required

---

## 4. 🔒 Edge Function Security

### ASIA ingestion vault ✅
- `supabase/functions/asia-ingestion/index.ts` uses `resolveCredential()` —
  no more hardcoded env fallbacks

---

## 5. 🎨 Remaining Debt

| Item | File | Priority |
|------|------|----------|
| `useCatalogState` DI refactor + unskip test | `src/hooks/useCatalogState.ts` | P1 |
| `useNovelties` sub-hook further split if grows > 500 LOC | `src/hooks/products/useNovelties.ts` | P2 |
| Onda 2 `last_restock_at` migration | DB | P1 |
| Kit packaging enrichment (42 kits) | data ops | P2 |
