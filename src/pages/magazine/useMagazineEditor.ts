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

  const setTitle = useCallback(
    (title: string) => {
      if (!magazine) return;
      persist({ ...magazine, title });
    },
    [magazine, persist],
  );

  const setSubtitle = useCallback(
    (subtitle: string) => {
      if (!magazine) return;
      persist({ ...magazine, subtitle });
    },
    [magazine, persist],
  );

  const setTemplate = useCallback(
    (templateId: MagazineTemplateId) => {
      if (!magazine) return;
      persist({ ...magazine, templateId });
    },
    [magazine, persist],
  );

  const setBranding = useCallback(
    (patch: Partial<MagazineClientBranding>) => {
      if (!magazine) return;
      persist({ ...magazine, branding: { ...magazine.branding, ...patch } });
    },
    [magazine, persist],
  );

  const setContent = useCallback(
    (patch: Partial<MagazineContentSettings>) => {
      if (!magazine) return;
      persist({ ...magazine, content: { ...magazine.content, ...patch } });
    },
    [magazine, persist],
  );

  const addProducts = useCallback(
    (products: Product[]) => {
      if (!magazine) return;
      const updated = magazineService.addProducts(magazine.id, products);
      if (updated) setMagazine(updated);
    },
    [magazine],
  );

  const removeItem = useCallback(
    (itemId: string) => {
      if (!magazine) return;
      const updated = magazineService.removeItem(magazine.id, itemId);
      if (updated) setMagazine(updated);
    },
    [magazine],
  );

  const reorderItems = useCallback(
    (orderedIds: string[]) => {
      if (!magazine) return;
      const updated = magazineService.reorderItems(magazine.id, orderedIds);
      if (updated) setMagazine(updated);
    },
    [magazine],
  );

  const updateItem = useCallback(
    (itemId: string, patch: Partial<MagazineItem>) => {
      if (!magazine) return;
      const updated = magazineService.updateItem(magazine.id, itemId, patch);
      if (updated) setMagazine(updated);
    },
    [magazine],
  );

  const publish = useCallback(() => {
    if (!magazine) return null;
    const updated = magazineService.publish(magazine.id);
    if (updated) setMagazine(updated);
    return updated;
  }, [magazine]);

  const unpublish = useCallback(() => {
    if (!magazine) return;
    const updated = magazineService.unpublish(magazine.id);
    if (updated) setMagazine(updated);
  }, [magazine]);

  const isOwner = useMemo(
    () => (magazine && user ? magazine.ownerId === user.id : false),
    [magazine, user],
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
