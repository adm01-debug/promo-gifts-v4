-- Migration: fix_c07_new_chain_violations_20260620
-- Purpose: Repair 2 new C07 chain violations (depth-2 canonical chains) discovered 2026-06-20.
--
-- Root cause: On 2026-06-19 ~11:45 UTC, a "claude" session set canonical_image_id on two rows
-- pointing to intermediate nodes. Later that same day (20:34 and 21:50 UTC), separate migrations
-- made those intermediate nodes into deps (linked to their true roots). This created depth-2
-- chains: orphan-dep → intermediate-dep → root.
--
-- Fix: Re-point each orphan-dep directly to its canonical root (skip the intermediate).
--
-- Chain 1 (hash 7c2c81a56e80b1dd...):
--   45c83c45 → d39af6e6 → 254dea34 (ROOT)
--   Fix: 45c83c45 → 254dea34
--
-- Chain 2 (hash 6c2644f5380d97c9...):
--   918192cc → c9d485ea → 2238f75c (ROOT)
--   Fix: 918192cc → 2238f75c

BEGIN;

-- Chain 1: re-point 45c83c45 directly to root 254dea34
UPDATE public.product_images
SET
  canonical_image_id = '254dea34-123d-45ca-9a93-1901c81bc4ef',
  last_modified_source = 'migration',
  updated_at = NOW()
WHERE id = '45c83c45-fbc5-45b2-bed2-0f8a7f32b48a'
  AND canonical_image_id = 'd39af6e6-2b2a-418b-a139-0acda20cb6af'
  AND is_shared = true;

-- Chain 2: re-point 918192cc directly to root 2238f75c
UPDATE public.product_images
SET
  canonical_image_id = '2238f75c-800f-4d18-a499-bddd253824fc',
  last_modified_source = 'migration',
  updated_at = NOW()
WHERE id = '918192cc-6714-452d-9886-f1eb5edc2988'
  AND canonical_image_id = 'c9d485ea-4d41-4873-8ce6-990d1e0f793b'
  AND is_shared = true;

-- Self-test: C07 must be 0 after repair
DO $$
DECLARE
  chain_count int;
  c07_status  text;
  c07_value   int;
BEGIN
  -- Count remaining chain violations directly
  SELECT COUNT(*) INTO chain_count
  FROM public.product_images pi
  JOIN public.product_images root ON root.id = pi.canonical_image_id
  WHERE pi.is_shared = true
    AND pi.canonical_image_id IS NOT NULL
    AND root.canonical_image_id IS NOT NULL;  -- root is itself a dep → chain

  IF chain_count <> 0 THEN
    RAISE EXCEPTION 'C07 still has % chain violation(s) after migration', chain_count;
  END IF;

  -- Verify via health check function
  SELECT status::text, value::int
  INTO c07_status, c07_value
  FROM fn_product_images_health_check()
  WHERE check_name = 'c07_canonical_chains_flat';

  IF c07_status <> 'OK' THEN
    RAISE EXCEPTION 'C07 health check still FAIL: value=%, expected OK', c07_value;
  END IF;

  RAISE NOTICE 'C07 repair verified: % chain violations remain (expected 0)', chain_count;
END;
$$;

COMMIT;
