/**
 * useMagazineEditor — carrega/edita/salva uma revista. v1 usa localStorage
 * via magazineService com autosave debounced.
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

  useEffect(() => {
    if (!id) {
      setLoaded(true);
      return;
    }
    setMagazine(magazineService.get(id));
    setLoaded(true);
  }, [id]);

  const persist = useCallback(
    (next: Magazine) => {
      setMagazine(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaving(true);
      saveTimer.current = setTimeout(() => {
        magazineService.update(next.id, next);
        setSaving(false);
      }, 400);
    },
    [],
  );

  const magazineRef = useRef(magazine);
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
    (products: Product[]) => {
      const current = magazineRef.current;
      if (!current) return;
      const updated = magazineService.addProducts(current.id, products);
      if (updated) setMagazine(updated);
    },
    [],
  );

  const removeItem = useCallback(
    (itemId: string) => {
      const current = magazineRef.current;
      if (!current) return;
      const updated = magazineService.removeItem(current.id, itemId);
      if (updated) setMagazine(updated);
    },
    [],
  );

  const reorderItems = useCallback(
    (orderedIds: string[]) => {
      const current = magazineRef.current;
      if (!current) return;
      const updated = magazineService.reorderItems(current.id, orderedIds);
      if (updated) setMagazine(updated);
    },
    [],
  );

  const updateItem = useCallback(
    (itemId: string, patch: Partial<MagazineItem>) => {
      const current = magazineRef.current;
      if (!current) return;
      const updated = magazineService.updateItem(current.id, itemId, patch);
      if (updated) setMagazine(updated);
    },
    [],
  );

  const publish = useCallback(() => {
    const current = magazineRef.current;
    if (!current) return null;
    const updated = magazineService.publish(current.id);
    if (updated) setMagazine(updated);
    return updated;
  }, []);

  const unpublish = useCallback(() => {
    const current = magazineRef.current;
    if (!current) return;
    const updated = magazineService.unpublish(current.id);
    if (updated) setMagazine(updated);
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
