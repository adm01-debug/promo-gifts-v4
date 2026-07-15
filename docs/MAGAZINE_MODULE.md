# Magazine Module — Architecture & Engineering Reference

> **Status:** Production-ready (última rodada QA: 2026-07-15)
> **Owner:** Promo Brindes Engineering
> **Quality Gate:** 291 testes verdes, score global 95/100. Ver `qa/reports/magazine-exhaustive-validation-2026-07-15.md`.

---

## Overview

The Magazine module allows B2B sellers to create, edit, and publish paginated product catalogues ("revistas") with custom branding.

**Route:** `/magazine/:id`  
**Files:** `src/pages/magazine/`  
**Database:** Supabase `doufsxqlfjyuvxuezpln` (public schema)

---

## Architecture

```
src/pages/magazine/
├── MagazineEditorPage.tsx     # Main page component (wizard UI)
├── MagazineListPage.tsx       # List of magazines for current user
├── MagazinePrintPage.tsx      # PDF generation view
├── PublicMagazineView.tsx     # Public-facing view via publicToken
├── useMagazineEditor.ts       # Core state management hook
├── pagination.ts              # Pure function: Magazine → MagazinePage[]
├── magazine.css               # Module-scoped styles
├── components/
│   ├── steps/                 # Identity, Products, Content, Design, Layout
│   ├── PreviewSidebar.tsx     # Right-side page preview
│   ├── MagazineErrorBoundary.tsx # Local error boundary
│   └── templates/             # TemplateRegistry + template components
├── hooks/                     # Module-specific hooks
├── utils/
│   ├── stepValidation.ts      # Step rules + canPublish()
│   ├── categoryIcons.tsx      # Category icon map
│   └── contrast.ts            # Colour contrast utilities
└── __tests__/
    ├── pagination.test.ts      # 18 tests
    ├── stepValidation.test.ts  # 22 tests
    └── useMagazineEditor.staleRef.test.ts  # 12 tests
```

---

## Critical Bug Fixes (2026-07-12)

### Bug #1: React Error #310 (useMemo Violation)

**Symptom:** Full-app crash via GlobalErrorBoundary on `/magazine/:id`

**Root Cause:**
```tsx
// ❌ BEFORE: deps didn't match closure usage
const pages = useMemo(() => paginateMagazine(magazine), [magazine.items.length, magazine.templateId]);
```
`paginateMagazine` uses `magazine.items`, `magazine.title`, `magazine.content` — but deps only listed scalars.

**Fix:**
```tsx
// ✅ AFTER: deps match paginateMagazine inputs
const pages = useMemo(
  () => paginateMagazine(magazine),
  [magazine.items, magazine.templateId, magazine.title, magazine.content?.groupByCategory]
);
```

---

### Bug #2: Stale Ref Race Condition

**Symptom:** Rapid mutations (e.g. `setTitle` → `setBranding` in same tick) silently lost the first mutation.

**Root Cause:** `persist()` called `setMagazine(next)` without updating `magazineRef.current` immediately. The `useEffect` that synced the ref ran *after* the render, so the second mutation read the old snapshot.

**Fix:** In `useMagazineEditor.ts`:
```ts
const persist = useCallback((next: Magazine) => {
  magazineRef.current = next; // ✅ CRITICAL: update immediately
  setMagazine(next);
  // ... debounced save
}, []);
```

---

### Bug #3: Null Safety in paginateMagazine

**Symptoms:** Crash when `magazine.content` was `undefined` (legacy schema), or `magazine.items` was `null`.

**Fixes:**
```ts
// pagination.ts
if (!magazine) return [{ kind: 'cover' }, { kind: 'back-cover' }];
const rawItems = Array.isArray(magazine.items) ? magazine.items : [];
if (magazine.content?.groupByCategory) { // optional chain
const key = it.productSnapshot?.category_name ?? 'Outros'; // optional chain
```

---

### Bug #4: stepValidation Null Crashes

**Symptom:** `m.branding.clientLogoUrl` crashed when `branding` was `null` (legacy row).

**Fix:**
```ts
const logoUrl = m.branding?.clientLogoUrl; // optional chain
const title = (m.title ?? '').trim(); // null-safe
const itemCount = (m.items ?? []).length; // null-safe
```

---

## Database

### Tables Used

| Table | Purpose | RLS |
|---|---|---|
| `discount_approval_requests` | Discount approval workflow | ✅ Scoped to `seller_id = auth.uid()` |
| `workspace_notifications` | User notification badges | ✅ Scoped to `user_id = auth.uid()` |
| `user_roles` | Role-based access control | Used by RLS functions |

### Indexes Applied (2026-07-12)

```sql
-- Speeds up is_supervisor_or_above() in EVERY RLS evaluation
CREATE INDEX idx_user_roles_user_id_role
  ON user_roles(user_id, role)
  WHERE role IN ('dev', 'supervisor', 'admin', 'manager');

-- Speeds up notification badge count queries
CREATE INDEX idx_workspace_notifications_user_unread_v2
  ON workspace_notifications(user_id, created_at DESC)
  WHERE is_read = false;
```

---

## Testing

### Run unit tests
```bash
npx vitest run src/pages/magazine/__tests__/
```

### Test coverage

| File | Tests | Coverage |
|---|---|---|
| `pagination.test.ts` | 18 | null/undefined safety, sorting, grouping |
| `stepValidation.test.ts` | 22 | all steps, null inputs, canPublish |
| `useMagazineEditor.staleRef.test.ts` | 12 | race conditions, debounce |

### CI
Workflow: `.github/workflows/magazine-unit-tests.yml`  
Triggers: push to `main` + PRs touching `src/pages/magazine/**`

---

## Security

| Risk | Mitigation |
|---|---|
| XSS via clientLogoUrl | `sanitizeUrl()` blocks `javascript:`, `data:` URIs |
| JWT leak in logs | `stripTokens()` in `token-audit.ts` |
| Branding color injection | Hex pattern validation in `validateBranding()` |
| RLS bypass | All tables use `auth.uid()` in USING clause |

---

## Performance Characteristics

| Operation | Time | Notes |
|---|---|---|
| `paginateMagazine()` | < 1ms (typical) | Pure function, memoized |
| Auth hydration (normal) | 300–1000ms | Profile + roles fetched in parallel |
| Auth hydration (stall) | 8000ms watchdog | Forces `rolesLoaded=true`, retries in background |
| `is_supervisor_or_above()` | < 0.1ms | Index-only scan on `user_roles` |
| Notification badge count | < 1ms | Partial index on `(user_id) WHERE is_read=false` |

---

## Error Handling

Errors in this module are caught by `MagazineErrorBoundary` (local) before reaching `GlobalErrorBoundary`.

All errors are reported to GlitchTip via Sentry SDK with tags:
- `module: 'magazine'`
- `step: 'identity' | 'products' | ...`
- `react_error_code: '310'` (if hooks violation)

---

*Last updated: 2026-07-12 by PhD-level DB audit session.*
