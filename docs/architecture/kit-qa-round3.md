# Kit Architecture — QA Round 3 (Auditing P0–P8 Integration)

**Date:** 2026-06-11 | **Verdict:** 5 new bug classes found, all fixed, E2E proven

## Bugs Found Auditing My Own P0–P8 Work

### B14 — Coherence regression from density fixes (84 kits)
QA2 density caps + P0 ran at different times → 84 kits lost Σ(w×q)=bronze coherence.
**Fix**: unified final reconciliation (volume-share, qty-aware, density-capped).
Result: 559→634/643 kits coherent (98.6%). 3 remaining have implausible bronze.

### B15 — Single-component-is-kit modeling flaw (9 kits)
"KIT CANETAS 12 CORES" = 1 component with single-pen dims (D=12,H=50) but bronze
weight 140g → density cap forced 45g. Component IS the kit (estojo of 12).
**Fix**: rectangular estojo dims + weight = bronze.

### B16 — Docs' parser lost first dimension (17 kits)
"42,5 x 33,0 x 27,0 cm" → L=33, W=33 (lost 42.5, duplicated 33). Comma-decimal
first-token bug. **Fix**: direct regex re-parse d1/d2/d3.
Also: regenerated 12 garbage "0,0 x 0,0" displays from real dims.

### B17 — My P4 fits: ROUND(vol,2) zeroed items < 5cm³
Pen drive (2.6cm³) → product_volume 0.00 → fits=NULL (should be TRUE).
**Fix v3**: full-precision internal math, ROUND only on output (4 decimals).

### B18 — PRODUCTION BUG: custom_kits INSERT trigger broken
fn_custom_kits_sync_user_id references NEW.created_by — column no longer exists.
**Every INSERT into custom_kits failed** → kit builder was doubly broken
(no internals + broken trigger). Docs schema ≠ real schema (box_data/items_data,
no reference_code). **Fix**: trigger rewritten for real schema (auth.uid() fallback).

### Process lesson — transaction rollback hazard
A failed statement later in the same execute_sql request ROLLED BACK an earlier
CREATE OR REPLACE in that request. Rule: DDL goes in its own request, then verify
via read-back (position() on pg_get_functiondef) before testing.

## Final E2E (proves builder works end-to-end)
list packagings (with internals) → fits(tiny item) TRUE → fits(item2, used vol)
→ fits(kit w/o dims via pkc fallback) → INSERT custom_kit (real schema) → read-back
→ DELETE. **ALL PASS.**

## Final State
- pkc: 3,419/3,419 complete, densities within [0.005, 12.5]
- Kit-level coherence: 634/643 (98.6%) within 15% of bronze
- products: 962/962 kits with weight, 696 with dims (was 466)
- 13 packagings operational, custom_kits insertable, fits v3 precise
