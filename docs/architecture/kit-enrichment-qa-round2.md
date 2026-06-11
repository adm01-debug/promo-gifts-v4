# Kit Enrichment — QA Round 2 (Auditing the QA Round 1 Fixes)

**Date:** 2026-06-10 | **Scope:** auditing round-1 corrections + new attack surfaces

## New Bugs Found (Round 2)

### B9 — Kit-level weight incoherence (CRITICAL)
Σ(component weights) vs real kit weight from bronze:
- Só Marcas: 255/520 kits >50% off (avg deviation 96%)
- XBZ: 56/120 kits >50% off (avg deviation 114%)
**Cause**: typical weights (M4) don't sum to real kit weight.
**Fix**: proportional rebalance → Σ = bronze kit weight. Result: 707/710 kits within 15%.
(2 remaining have implausible bronze weights — gold kept.)

### B10 — Impossible densities (288 denser than steel)
**Cause**: uniform weight quotas on tiny items (keychain 0.77cm³ @ 200g = density 260).
**Fix**: volume-share redistribution (weight_i = kit_weight × vol_i/Σvol) + density caps.

### B11 — cm-as-mm dimensions (34+ items)
Dims like "2×5×18mm" = 2cm×5cm×18cm. **Fix**: ×10 + weight recalc.

### B12 — mm×10 inflated dimensions (19 items, weights up to 1,584 KG!)
"KIT CANETINHAS" at 800×3050×1700mm (3 meters!). density_capped then computed
weight for 4m³ of solid material → 1.5 tonnes.
**Fix**: ÷10 + weight by volume×0.35, global cap at 3kg/component.

### B13 — Packaging escaped cm→mm fix (9 items)
Round-1 fix filtered is_packaging=FALSE; CAIXA/ESTOJO/NECESSAIRE packagings
with cm-as-mm dims escaped. **Fix**: ×10 + pkg_ext + weight recalc.

## Round 2 Verification Results

| Check | Result |
|-------|--------|
| pt-BR fix audit (independent parser) | 863/863 match ✅ |
| Kit-level coherence (3 suppliers) | 707/710 within 15% ✅ |
| Density: denser than steel | 0 ✅ |
| Density: lighter than foam | 0 ✅ |
| Median density | 0.40 g/cm³ (promo mix) ✅ |
| Weight range | 5g — 2,875g ✅ |
| Trigger INSERT protection (fake status) | corrected to missing ✅ |
| Status integrity after ~900 QA2 fixes | 3,419/3,419 complete ✅ |
| Dimensions > 120cm | 0 ✅ |
| Sources populated | 100% ✅ |

## Cumulative QA Statistics (Rounds 1+2)

- **13 distinct bug classes** found and fixed
- **~2,800 records corrected** (82% of table had at least one latent issue)
- **Root causes**: pt-BR number formats (×2 variants), unit confusion (cm/mm ×2 directions),
  kit-dims-as-component-dims contamination, height-in-diameter-column, redistribution
  side-effects (density), trigger/batch logic drift
