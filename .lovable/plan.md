# Global Technical Audit & Hardening Plan

This plan addresses critical security holes, performance bottlenecks, and code quality issues identified during a comprehensive audit of the application.

## 1. 🔐 Database Security & Hardening (Supabase)
*   **Fix Permissive RLS**: Remove `Allow initial sync insert` on the `products` table which currently allows unauthorized data injection.
*   **Function Security**: Set `search_path = public` on all public schema functions to prevent search path hijacking (fixing 300+ linter warnings).
*   **Access Control**: Revoke `EXECUTE` privileges from the `anon` role for sensitive `SECURITY DEFINER` functions that should only be accessible to authenticated users or internal systems.
*   **Privilege Audit**: Standardize grants for `authenticated` and `service_role` to ensure the principle of least privilege.

## 2. ⚡ Performance & Logic (React Hooks)
*   **Stabilize Dependencies**: Fix `exhaustive-deps` warnings in core hooks like `useProductsManager`, `useFilterPanelState`, and `useExpertChat`. This prevents infinite re-render loops and stale closure bugs.
*   **Resource Cleanup**: Fix memory leaks in `SkeletonMonitor.tsx` where timing refs were not correctly captured for cleanup.
*   **Memoization Audit**: Ensure heavy calculations in components like `ProductFiltersBar` and `MockupHistoryPanel` are correctly memoized.

## 3. 🎨 Code Quality & Maintenance
*   **Linting Compliance**: Resolve 500+ ESLint warnings by fixing naming conventions (e.g., `Icon` -> `icon` for props) and removing unsafe non-null assertions (`!`).
*   **Type Safety**: Replace `any` types with proper interfaces in diagnostic and test components.
*   **Error Handling**: Enhance fallback states in galleries and charts where API failures might currently lead to blank screens.

## Technical Details

### Database Migrations
*   Table `products`: Drop policy `Allow initial sync insert`.
*   All functions: `ALTER FUNCTION ... SET search_path = public`.
*   Revoke: `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM public, anon;`.
*   Grant: `GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;`.

### React Edits
*   Fix `useEffect` and `useCallback` dependency arrays.
*   Rename props in `KpiCard`, `FilterSection`, and other UI primitives to match camelCase conventions.
*   Add null-checks before accessing properties previously assumed via `!`.

---
This audit will significantly improve the security posture and runtime stability of the application.
