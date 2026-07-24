/**
 * useSkuValidation — Validates SKU uniqueness against external DB
 */
import { useState, useEffect } from 'react';

export function useSkuValidation(currentSku: string, isEdit: boolean, originalSku?: string) {
  const [status, setStatus] = useState<'checking' | 'duplicate' | 'idle' | 'valid'>('idle');
  const [duplicateName, setDuplicateName] = useState('');

  useEffect(() => {
    if (!currentSku || currentSku.length < 2) {
      setStatus('idle');
      return;
    }
    if (isEdit && currentSku === originalSku) {
      setStatus('valid');
      return;
    }

    setStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const { fetchPromobrindProducts } = await import('@/lib/external-db');
        const existing = await fetchPromobrindProducts({ search: currentSku, limit: 5 });
        const products = (
          Array.isArray(existing) ? existing : (existing as Record<string, unknown>).products || []
        ) as Array<Record<string, unknown>>;
        const dup = products.find(
          (p: Record<string, unknown>) =>
            (p.sku as string | undefined)?.toLowerCase() === currentSku.toLowerCase(),
        );
        if (dup) {
          setStatus('duplicate');
          setDuplicateName(String(dup.name || ''));
        } else {
          setStatus('valid');
          setDuplicateName('');
        }
      } catch {
        setStatus('idle');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [currentSku, isEdit, originalSku]);

  return { status, duplicateName };
}
