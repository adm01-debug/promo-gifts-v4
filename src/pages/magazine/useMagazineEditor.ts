/**
 * useMagazineEditor — carrega/edita/salva uma revista. v1 usa localStorage
 * via magazineService com autosave debounced.
 *
 * CRITICAL FIX: magazineRef stale-read race condition
 * ─────────────────────────────────────────────────────
 * Before: magazineRef.current was updated ONLY in a useEffect (deferred).
 * This meant two rapid mutations (e.g. setTitle → setBranding in same tick)
 * would both read the OLD ref, causing the second mutation to LOSE the
 * first's changes (title would disappear after branding update).
 *
 * After: persist() updates magazineRef.current IMMEDIATELY before setState,
 * so the next mutation always reads the latest snapshot, even in the same tick.
 * The useEffect remains as a safety net for external state changes (e.g. from
 * magazineService calls that bypass persist()).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { magazineService } from '@/services/magazineService';
import { useAuth } from '@/contexts/AuthContext';
import type {
  Magazine,
  MagazineClientBranding,
  MagazineContentSettings,
  MagazineItem,
  MagazineTemplateId,
} from '@/types/magazine';
import type { Product } from '@/types/product-catalog';

export function useMagazineEditor(id: string | undefined) {
  const { user } = useAuth();
  const [magazine, setMagazine] = useState<Magazine | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // CRITICAL FIX: Declare ref BEFORE persist so persist can update it immediately.
  // Using useRef<Magazine | null>(null) — initial value set in useEffect below.
  const magazineRef = useRef<Magazine | null>(null);

  useEffect(() => {
    if (!id) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    (async () => {
      const loaded = await magazineService.get(id);
      if (cancelled) return;
      magazineRef.current = loaded;
      setMagazine(loaded);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const persist = useCallback(
    (next: Magazine) => {
      // CRITICAL FIX: Update ref IMMEDIATELY before calling setMagazine.
      // React batches setState calls; useEffect (which previously synced the ref)
      // runs AFTER the render, meaning two persist() calls in the same tick
      // would both read the old ref. This fix ensures each call sees fresh data.
      magazineRef.current = next;
      setMagazine(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaving(true);
      saveTimer.current = setTimeout(() => {
        void magazineService.update(next.id, next).finally(() => setSaving(false));
      }, 400);
    },
    [],
  );

  // Safety net: keeps ref in sync for external state changes
  // (e.g. magazineService calls that bypass persist, HMR, test overrides)
  useEffect(() => {
    magazineRef.current = magazine;
  }, [magazine]);

  const setTitle = useCallback(
    (title: string) => {
      const current = magazineRef.current;
      if (!current) return;
      persist({ ...current, title });
    },
    [persist],
  );

  const setSubtitle = useCallback(
    (subtitle: string) => {
      const current = magazineRef.current;
      if (!current) return;
      persist({ ...current, subtitle });
    },
    [persist],
  );

  const setTemplate = useCallback(
    (templateId: MagazineTemplateId) => {
      const current = magazineRef.current;
      if (!current) return;
      persist({ ...current, templateId });
    },
    [persist],
  );

  const setBranding = useCallback(
    (patch: Partial<MagazineClientBranding>) => {
      const current = magazineRef.current;
      if (!current) return;
      persist({ ...current, branding: { ...current.branding, ...patch } });
    },
    [persist],
  );

  const setContent = useCallback(
    (patch: Partial<MagazineContentSettings>) => {
      const current = magazineRef.current;
      if (!current) return;
      persist({ ...current, content: { ...current.content, ...patch } });
    },
    [persist],
  );

  const addProducts = useCallback(
    async (products: Product[]) => {
      const current = magazineRef.current;
      if (!current) return;
      const updated = await magazineService.addProducts(current.id, products);
      if (updated) {
        magazineRef.current = updated;
        setMagazine(updated);
      }
    },
    [],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      const current = magazineRef.current;
      if (!current) return;
      const updated = await magazineService.removeItem(current.id, itemId);
      if (updated) {
        magazineRef.current = updated;
        setMagazine(updated);
      }
    },
    [],
  );

  const reorderItems = useCallback(
    async (orderedIds: string[]) => {
      const current = magazineRef.current;
      if (!current) return;
      const updated = await magazineService.reorderItems(current.id, orderedIds);
      if (updated) {
        magazineRef.current = updated;
        setMagazine(updated);
      }
    },
    [],
  );

  const updateItem = useCallback(
    async (itemId: string, patch: Partial<MagazineItem>) => {
      const current = magazineRef.current;
      if (!current) return;
      const updated = await magazineService.updateItem(current.id, itemId, patch);
      if (updated) {
        magazineRef.current = updated;
        setMagazine(updated);
      }
    },
    [],
  );

  const publish = useCallback(async () => {
    const current = magazineRef.current;
    if (!current) return null;
    const updated = await magazineService.publish(current.id);
    if (updated) {
      magazineRef.current = updated;
      setMagazine(updated);
    }
    return updated;
  }, []);

  const unpublish = useCallback(async () => {
    const current = magazineRef.current;
    if (!current) return;
    const updated = await magazineService.unpublish(current.id);
    if (updated) {
      magazineRef.current = updated;
      setMagazine(updated);
    }
  }, []);

  const isOwner = useMemo(
    () => (magazine && user ? magazine.ownerId === user.id : false),
    [magazine?.id, magazine?.ownerId, user?.id],
  );

  return {
    magazine,
    loaded,
    saving,
    isOwner,
    setTitle,
    setSubtitle,
    setTemplate,
    setBranding,
    setContent,
    addProducts,
    removeItem,
    reorderItems,
    updateItem,
    publish,
    unpublish,
  };
}
