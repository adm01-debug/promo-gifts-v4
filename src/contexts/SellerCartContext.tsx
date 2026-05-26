/**
 * SellerCartContext - Contexto global para carrinhos de vendedor
 * Expõe dados e operações do carrinho em toda a aplicação
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import {
  useSellerCarts,
  type SellerCart,
  type AddToCartInput,
  type CreateCartInput,
  type CartStatus,
} from '@/hooks/products';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface SellerCartContextType {
  // Data
  carts: SellerCart[];
  activeCart: SellerCart | null;
  activeCartId: string | null;
  isLoading: boolean;
  totalItems: number;
  canCreateCart: boolean;

  // Active cart management
  setActiveCartId: (id: string | null) => void;

  // Operations
  createCart: (input: CreateCartInput) => Promise<SellerCart | undefined>;
  deleteCart: (cartId: string) => void;
  addToActiveCart: (item: AddToCartInput) => void;
  removeItem: (itemId: string) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;
  updateItemNotes: (itemId: string, notes: string) => void;
  updateItemSortOrder: (items: { id: string; sort_order: number }[]) => void;
  updateCartNotes: (cartId: string, notes: string) => void;
  updateCartStatus: (cartId: string, status: CartStatus) => void;
  duplicateCart: (cartId: string) => void;
  moveItemToCart: (itemId: string, targetCartId: string) => void;
  duplicateItemToCart: (itemId: string, targetCartId: string) => void;
  clearCart: (cartId: string) => void;
  restoreItems: (cartId: string, items: AddToCartInput[]) => void;
}

const SellerCartContext = createContext<SellerCartContextType | undefined>(undefined);
const ACTIVE_CART_STORAGE_KEY = 'seller:active-cart-id';

export function SellerCartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const {
    carts,
    isLoading,
    totalItems,
    canCreateCart,
    createCart: createCartMutation,
    deleteCart: deleteCartMutation,
    addItem,
    removeItem: removeItemMutation,
    updateItemQuantity: updateQtyMutation,
    updateItemNotes: updateNotesMutation,
    updateItemSortOrder: updateSortMutation,
    updateCartNotes: updateCartNotesMutation,
    updateCartStatus: updateCartStatusMutation,
    duplicateCart: duplicateCartMutation,
    moveItemToCart: moveItemMutation,
    duplicateItemToCart: duplicateItemMutation,
    clearCart: clearCartMutation,
    restoreItems: restoreItemsMutation,
  } = useSellerCarts();

  const [activeCartId, setActiveCartId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_CART_STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const resolvedActiveCartId =
    activeCartId && carts.find((c) => c.id === activeCartId)
      ? activeCartId
      : carts.length > 0
        ? carts[0].id
        : null;

  const activeCart = carts.find((c) => c.id === resolvedActiveCartId) || null;

  useEffect(() => {
    if (!user?.id) return;
    try {
      if (resolvedActiveCartId) {
        localStorage.setItem(ACTIVE_CART_STORAGE_KEY, resolvedActiveCartId);
      } else {
        localStorage.removeItem(ACTIVE_CART_STORAGE_KEY);
      }
    } catch {
      // no-op: storage unavailable
    }
  }, [resolvedActiveCartId, user?.id]);

  const createCart = useCallback(
    async (input: CreateCartInput) => {
      try {
        const result = await createCartMutation.mutateAsync(input);
        if (result) {
          setActiveCartId(result.id);
          toast.success(`Carrinho criado para ${input.company_name}`);
        }
        return result;
      } catch {
        return undefined;
      }
    },
    [createCartMutation],
  );

  const deleteCart = useCallback(
    (cartId: string) => {
      deleteCartMutation.mutate(cartId);
      if (activeCartId === cartId) {
        setActiveCartId(null);
      }
    },
    [deleteCartMutation, activeCartId],
  );

  const addToActiveCart = useCallback(
    (item: AddToCartInput) => {
      if (!resolvedActiveCartId) {
        toast.error('Selecione uma empresa antes de adicionar produtos', {
          description: 'Crie um carrinho vinculado a uma empresa primeiro.',
        });
        return;
      }
      addItem.mutate(
        { cartId: resolvedActiveCartId, item },
        {
          onSuccess: () => {
            toast.success(`${item.product_name} adicionado ao carrinho`, {
              description: activeCart?.company_name,
            });
          },
        },
      );
    },
    [resolvedActiveCartId, addItem, activeCart],
  );

  const removeItem = useCallback(
    (itemId: string) => {
      removeItemMutation.mutate(itemId);
    },
    [removeItemMutation],
  );

  const updateItemQuantity = useCallback(
    (itemId: string, quantity: number) => {
      updateQtyMutation.mutate({ itemId, quantity });
    },
    [updateQtyMutation],
  );

  const updateItemNotes = useCallback(
    (itemId: string, notes: string) => {
      updateNotesMutation.mutate({ itemId, notes });
    },
    [updateNotesMutation],
  );

  const updateItemSortOrder = useCallback(
    (items: { id: string; sort_order: number }[]) => {
      updateSortMutation.mutate(items);
    },
    [updateSortMutation],
  );

  const updateCartNotes = useCallback(
    (cartId: string, notes: string) => {
      updateCartNotesMutation.mutate({ cartId, notes });
    },
    [updateCartNotesMutation],
  );

  const updateCartStatus = useCallback(
    (cartId: string, status: CartStatus) => {
      updateCartStatusMutation.mutate({ cartId, status });
    },
    [updateCartStatusMutation],
  );

  const duplicateCartFn = useCallback(
    (cartId: string) => {
      duplicateCartMutation.mutate(cartId);
    },
    [duplicateCartMutation],
  );

  const moveItemToCart = useCallback(
    (itemId: string, targetCartId: string) => {
      moveItemMutation.mutate({ itemId, targetCartId });
    },
    [moveItemMutation],
  );

  const duplicateItemToCart = useCallback(
    (itemId: string, targetCartId: string) => {
      duplicateItemMutation.mutate({ itemId, targetCartId });
    },
    [duplicateItemMutation],
  );

  const clearCart = useCallback(
    async (cartId: string) => {
      try {
        await clearCartMutation(cartId);
        setActiveCartId(cartId);
        toast.success('Carrinho limpo');
      } catch {
        toast.error('Erro ao limpar carrinho');
      }
    },
    [clearCartMutation],
  );

  const restoreItems = useCallback(
    (cartId: string, items: AddToCartInput[]) => {
      restoreItemsMutation.mutate({ cartId, items });
    },
    [restoreItemsMutation],
  );

  return (
    <SellerCartContext.Provider
      value={{
        carts,
        activeCart,
        activeCartId: resolvedActiveCartId,
        isLoading,
        totalItems,
        canCreateCart,
        setActiveCartId,
        createCart,
        deleteCart,
        addToActiveCart,
        removeItem,
        updateItemQuantity,
        updateItemNotes,
        updateItemSortOrder,
        updateCartNotes,
        updateCartStatus,
        duplicateCart: duplicateCartFn,
        moveItemToCart,
        duplicateItemToCart,
        clearCart,
        restoreItems,
      }}
    >
      {children}
    </SellerCartContext.Provider>
  );
}

export function useSellerCartContext() {
  const context = useContext(SellerCartContext);
  if (!context) {
    throw new Error('useSellerCartContext must be used within SellerCartProvider');
  }
  return context;
}
