// Hook para gerenciar produtos recentes do usuário
// Usa localStorage para persistência simples

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

export interface RecentProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  image_url?: string | null;
  selectedAt: number; // timestamp
}

const MAX_RECENT_PRODUCTS = 5;
const STORAGE_KEY = 'simulator_recent_products';

function getStorageKey(userId: string) {
  return `${STORAGE_KEY}_${userId}`;
}

export function useRecentProducts() {
  const { user } = useAuth();
  const [recentProducts, setRecentProducts] = useState<RecentProduct[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    if (!user?.id) {
      setRecentProducts([]);
      return;
    }

    try {
      const stored = localStorage.getItem(getStorageKey(user.id));
      if (stored) {
        const parsed = JSON.parse(stored) as RecentProduct[];
        // Sort by most recent first
        parsed.sort((a, b) => b.selectedAt - a.selectedAt);
        setRecentProducts(parsed.slice(0, MAX_RECENT_PRODUCTS));
      }
    } catch (e) {
      logger.warn('Error loading recent products:', e);
      setRecentProducts([]);
    }
  }, [user?.id]);

  // Add a product to recents
  const addRecentProduct = useCallback(
    (product: {
      id: string;
      name: string;
      sku: string;
      price: number;
      image_url?: string | null;
    }) => {
      if (!user?.id) return;

      setRecentProducts((prev) => {
        // Remove if already exists
        const filtered = prev.filter((p) => p.id !== product.id);

        // Add at beginning with timestamp
        const newRecent: RecentProduct = {
          ...product,
          selectedAt: Date.now(),
        };

        const updated = [newRecent, ...filtered].slice(0, MAX_RECENT_PRODUCTS);

        // Persist to localStorage
        try {
          localStorage.setItem(getStorageKey(user.id), JSON.stringify(updated));
        } catch (e) {
          logger.warn('Error saving recent products:', e);
        }

        return updated;
      });
    },
    [user?.id],
  );

  // Clear all recents
  const clearRecentProducts = useCallback(() => {
    if (!user?.id) return;

    setRecentProducts([]);
    try {
      localStorage.removeItem(getStorageKey(user.id));
    } catch (e) {
      logger.warn('Error clearing recent products:', e);
    }
  }, [user?.id]);

  // Check if a product is recent
  const isRecent = useCallback(
    (productId: string) => {
      return recentProducts.some((p) => p.id === productId);
    },
    [recentProducts],
  );

  return useMemo(
    () => ({
      recentProducts,
      addRecentProduct,
      clearRecentProducts,
      isRecent,
      hasRecents: recentProducts.length > 0,
    }),
    [recentProducts, addRecentProduct, clearRecentProducts, isRecent],
  );
}
