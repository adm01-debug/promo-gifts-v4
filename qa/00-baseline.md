# QA Baseline — promo-gifts-v4
> Generated: 2026-06-02

## Build
- **Status:** SUCCESS (built in ~66s)
- **Warnings:** Deprecated `@types/dompurify` (stub — dompurify provides own types)
- **Large bundles (>400KB):**
  - `export-vendor`: 619KB
  - `useSparklineSales`: 577KB
  - `xlsx`: 499KB
  - `hls`: 523KB
  - `charts-vendor`: 455KB
  - `icons-vendor`: 441KB
  - `AdminConexoesPage`: 425KB
  - `pptx-vendor`: 369KB
  - `sentry-vendor`: 359KB

## TypeScript (`tsc --noEmit`)
- **337 type errors** across **79 files**
- Key problem areas:
  - `src/components/novelties/` — Wrong types on query data (NoveltyWithDetails missing fields)
  - `src/components/products/EnhancedProductCard.tsx` — Wrong property names (imageUrl vs image_url, salePrice/listPrice/minOrder not in Product type)
  - `src/components/collections/ExternalCollectionCard.tsx` — `icon_color` not in ExternalCollection type
  - `src/components/products/ProductCard.tsx` — Variable used before declaration
  - `src/components/products/ProductStatusBadge.tsx` — "out-of-stock" not in ProductStatusBadgeType
  - `src/components/search/AdvancedSearch.tsx` — SearchResult type mismatch
  - `src/components/pdf/__tests__/` — Mock type incompatibilities
  - `src/components/admin/products/` — Record<string, unknown> not assignable to Supabase types

## ESLint
- **83 errors, 218 warnings** (301 total)
- Top categories:
  - `@typescript-eslint/no-unused-vars` — unused imports
  - `react-hooks/exhaustive-deps` — missing dependencies in useEffect
  - `@typescript-eslint/no-explicit-any` — any types in tests
  - `@typescript-eslint/naming-convention` — parameter naming (Icon, duration_ms)
  - `no-console` — console.log in non-test code

## npm audit
- **0 vulnerabilities**

## Outdated dependencies
- Major upgrades available: react (18→19), framer-motion (11→12), date-fns (3→4), lucide-react (0.309→1.17), @sentry/react (8→10)
- Minor/patch: @supabase/supabase-js, @tanstack/react-query, @playwright/test, fuse.js
