// Barrel exports for collections hooks
//
// IMPORTANT — name clash guard (fix 2026-06-01):
// Both files previously exported useCollections(). To avoid last-write-wins
// ambiguity in bundlers, useExternalCollections.ts was refactored:
//   - useCollections()  → useExternalCollectionsManager()  (external/tanstack-query)
//   - added             → useExternalCollectionProductCounts()
//
// The only useCollections() in scope is now the one from useCollections.ts
// (local Supabase + useState, used by CollectionsContext).
export * from '@/hooks/collections/useCollections';
export * from '@/hooks/collections/useExternalCollections';
