# Kit Architecture — Two-Layer Integration (P0–P7)

**Date:** 2026-06-11 | **Trigger:** Joaquim's jan/2026 docs review
**Verdict:** docs described EXISTING infra; value was in integration gaps. All bridged.

## Discovery
All jan/2026 doc artifacts already exist in DB: custom_kits, v_products_kit_builder,
v_kit_max_quantity, fn_check_item_fits, fn_parse/update/format_dimensions,
products.*_cm fields, pkc structural fields (quantity, personalization, identity constraint).
BUT: kit builder was inoperative (0 custom_kits ever created).

## Fixes Executed

### P0 — CRITICAL: quantity semantics bug in component weights
QA2 rebalance ignored `quantity`. Bronze-discriminated test on 233 kits:
228 (98%) matched "weight_g = line total" hypothesis → divided by quantity.
Result: 208/233 kits coherent as Σ(weight×qty)=bronze within 15%. Semantics
restored: weight_g = UNIT weight. Zero density side-effects.

### P1 — Kit builder UNBLOCKED
13 packagings had zero internal_*_cm → fn_check_item_fits dead → 0 custom kits.
Applied internal = external − 0.8cm (cardboard walls). E2E: fits=true working.

### P2 — Kit dimensions: 466 → 661 (+42%)
- Ran docs' own fn_update_product_dimensions(): 1,206 products parsed, 0 errors
- **BUG FOUND in docs' parser**: "Copo: 330ml" → height_cm=330 (capacity-as-dimension).
  Cleaned 21 contaminated kits.
- **Parser gap**: multi-segment displays picked first segment (component) not "Caixa:"
  segment (the kit). Re-parsed with Caixa/Estojo priority regex.
- Fallback: pkg_ext from our enrichment layer → 141 more kits.
- 301 kits remain without dims (no reliable source; refused weak heuristics —
  bounding-box validated at only 16% accuracy vs ground truth).

### P3 — Kit weights: 933 → 962 (100%)
products.weight_g = Σ(component weight × quantity) for 29 missing.

### P4 — fn_check_item_fits v2 (3 bugs fixed)
1. Product without dims returned fits=TRUE (dangerous false positive) → now NULL
2. Cylindrical products had volume=0 → now π(D/2)²H
3. NEW: kits without products dims fall back to Σ pkc component volumes
4/4 adversarial scenarios pass. Signature unchanged (frontend compatible).

### P6 — v_kit_component_complete v2
Now exposes BOTH layers: structural (quantity, is_optional, allows_personalization,
personalization_notes, component_product_id, material, color) + enrichment
(dims, shape, density) + computed line_weight_g (weight×qty).

### P7 — Master battery: 10 layers verified
pkc integrity, densities, kit weights 100%, packaging internals, no giant dims,
new view, v_kit_max_quantity alive, v_products_kit_builder alive, no false
positives in fits, P3 backfill exact.

## Obsolete in docs
ANALISE_EXAUSTIVA lists products.supplier_id as TEXT / category_id as INTEGER —
both are different in current schema. Other docs match DB.
