# Kit Enrichment — Permanent Hardening (Post-QA)

**Date:** 2026-06-11 | **Goal achieved:** 10/10 with permanent guardrails

## Gap Simulation Findings (before execution)

Master gap-scan revealed 3 critical infrastructure gaps that QA data-fixes alone missed:
1. `v_kit_component_complete` had been DROPPED via CASCADE during QA and never recreated
2. `typical_dims` was a TEMP TABLE — lost on session end, unusable by future pipelines
3. **ZERO database constraints** — all 13 fixed bug classes could silently return
4. **n8n MCP `n8n_import_workflow` fails silently** — 3 workflows "imported" in prior
   sessions never existed (verified: 226 workflows listed, none of them present)

## Improvements Executed (M-A → M-H)

### M-A: v_kit_component_complete recreated
44 columns + computed `volume_cm3` and `density_g_cm3`. 3,419 rows, 100% with volume.

### M-B: kit_typical_dims persistent table
60 component types with typical dims, shape, weight AND validation ranges
(d_min/d_max, l_min/l_max, p_min/p_max). Single source of truth for typicals.

### M-C: 6 CHECK constraints (adversarially tested)
- chk_pkc_weight_sane (1–50,000g) — blocks the 1,584 KG bug class
- chk_pkc_{length,width,height}_sane (1–1,500mm) — blocks the 3m dims bug class
- chk_pkc_diameter_sane (1–800mm) — blocks the D=690 bug class
- chk_pkc_confidence_range (0–1)
Adversarial test: weight 1,584,000 / width 3,050 / confidence 5.0 → ALL REJECTED by DB.

### M-D: Asia validated — 106/106 complete, 0 anomalies

### M-E: XBZ scraping run3 complete
{kits:165, matches:144, promoted:144}. Post-run audit: zero anomalies reintroduced
(constraints + corrected logic held).

### M-F: Daily enrichment automation (REAL this time)
- Discovery: `SPOT - ATUALIZAÇÃO ESTOQUE` (active, 30min cron) already covers Spot
  stock via fn_spot_stock_fast_sync — fn_import_stock_from_spot pending was OBSOLETE
- Created `fn_enrich_kits_daily()`: consolidated RPC calling all 3 bronze extractors
  + typical-dims application for future missing components. Returns JSONB metrics.
- Created n8n workflow **KITS - ENRIQUECER DIMENSOES DIARIO** (id TI1uvqVI1uRAKrMu)
  via REST API (the MCP import tool is broken), cron 02:30 daily, ACTIVE,
  **verified server-side** + E2E tested (HTTP 200, 0.57s).

### M-G: Master battery — 25/25 checks PASS
Status, weights, densities, dims, constraints, views, typicals, daily-fn idempotency,
circumferences, inversions, sources: all clean.

## Architecture Lesson
**Silent tool failures are the most dangerous gap class.** The n8n import tool returned
success-shaped responses while creating nothing. Rule going forward: every
infrastructure mutation must be verified by independent read-back.
