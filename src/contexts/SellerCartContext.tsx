/**
 * SellerCartContext - Contexto global para carrinhos de vendedor
 * Expõe dados e operações do carrinho em toda a aplicação
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
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
import { clearActionHistory } from '@/components/cart/CartUtilComponents';

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
  addToActiveCart: (item: AddToCartInput, cartId?: string, options?: { silent?: boolean }) => void;
  removeItem: (itemId: string) => void;
  updateItemQuantity: (itemId: string, quantity: number) => void;
  updateItemNotes: (itemId: string, notes: string) => void;
  updateItemSortOrder: (items: { id: string; sort_order: number }[]) => void;
  updateCartNotes: (cartId: string, notes: string) => void;
  flushCartNotes: (cartId: string, notes: string) => Promise<boolean>;
  updateCartStatus: (cartId: string, status: CartStatus) => void;
  duplicateCart: (cartId: string) => void;
  moveItemToCart: (itemId: string, targetCartId: string) => void;
  duplicateItemToCart: (itemId: string, targetCartId: string) => void;
  clearCart: (cartId: string) => Promise<void>;
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

  const [activeCartId, setActiveCartId] = useState<string | null>(null);

  // Hidrata o carrinho ativo persistido com chave namespeada por usuario — evita que,
  // numa estacao compartilhada, um vendedor herde o carrinho ativo de outro. Enquanto
  // nao hidrata, resolvedActiveCartId ja cai em carts[0] (sem UX quebrada).
  useEffect(() => {
    if (!user?.id) {
      setActiveCartId(null);
      return;
    }
    try {
      setActiveCartId(localStorage.getItem(`${ACTIVE_CART_STORAGE_KEY}:${user.id}`));
    } catch {
      setActiveCartId(null);
    }
  }, [user?.id]);

  const resolvedActiveCartId = useMemo(
    () =>
      activeCartId && carts.find((c) => c.id === activeCartId)
        ? activeCartId
        : carts.length > 0
          ? carts[0].id
          : null,
    [activeCartId, carts],
  );

  const activeCart = useMemo(
    () => carts.find((c) => c.id === resolvedActiveCartId) ?? null,
    [carts, resolvedActiveCartId],
  );

  // Persiste apenas selecoes explicitas (nao-nulas) sob a chave do usuario. Nao
  // persistir null impede o clobber do valor recem-hidratado no primeiro render.
  useEffect(() => {
    if (!user?.id || !activeCartId) return;
    try {
      localStorage.setItem(`${ACTIVE_CART_STORAGE_KEY}:${user.id}`, activeCartId);
    } catch {
      // no-op: storage unavailable
    }
  }, [activeCartId, user?.id]);

  const createCart = useCallback(
    async (input: CreateCartInput) => {
      try {
        const result = await createCartMutation.mutateAsync(input);
        if (result) {
          setActiveCartId(result.id);
          toast.success(`Carrinho criado para ${input.company_name}`);
        }
        return result;
      } catch (err) {
        toast.error('Erro ao criar carrinho', {
          description: err instanceof Error ? err.message : 'Tente novamente',
        });
        return undefined;
      }
    },
    [createCartMutation],
  );

  const deleteCart = useCallback(
    (cartId: string) => {
      deleteCartMutation.mutate(cartId);
      clearActionHistory(cartId);
      if (activeCartId === cartId) {
        setActiveCartId(null);
        // Remove explicitamente o ID salvo para não herdar referência obsoleta após reload.
        if (user?.id) {
          try {
            localStorage.removeItem(`${ACTIVE_CART_STORAGE_KEY}:${user.id}`);
          } catch {
            // no-op: storage unavailable
          }
        }
      }
    },
    [deleteCartMutation, activeCartId, user?.id],
  );

  const addToActiveCart = useCallback(
    (item: AddToCartInput, cartId?: string, options?: { silent?: boolean }) => {
      const targetId = cartId || resolvedActiveCartId;

      if (!targetId) {
        toast.error('Selecione uma empresa antes de adicionar produtos', {
          description: 'Crie um carrinho vinculado a uma empresa primeiro.',
        });
        return;
      }

      const targetCart = carts.find((c) => c.id === targetId);

      addItem.mutate(
        { cartId: targetId, item },
        {
          onSuccess: () => {
            // silent: usado em lote (template/bulk) onde o chamador exibe um
            // único toast agregado — evita N toasts empilhados.
            if (!options?.silent) {
              toast.success(`${item.product_name} adicionado ao carrinho`, {
                description: targetCart?.company_name,
              });
            }
            // Update active cart if we explicitly added to a specific one
            if (cartId && cartId !== resolvedActiveCartId) {
              setActiveCartId(cartId);
            }
          },
        },
      );
    },
    [resolvedActiveCartId, addItem, carts],
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

  // Awaitable version of updateCartNotes for the pre-navigation flush path.
  // Returns true when the save succeeds, false on error — caller decides
  // whether to warn the user. Navigation always proceeds (non-blocking).
  const flushCartNotes = useCallback(
    async (cartId: string, notes: string): Promise<boolean> => {
      try {
        await updateCartNotesMutation.mutateAsync({ cartId, notes });
        return true;
      } catch {
        return false;
      }
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
      } catch (err) {
        toast.error('Erro ao limpar carrinho');
        throw err; // propaga para o caller poder abortar o fluxo pós-clear (ex: undo toast)
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
        flushCartNotes,
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

/** useSellerCartContext — lança erro se o contexto estiver ausente (uso normal). */
export function useSellerCartContext() {
  const context = useContext(SellerCartContext);
  if (!context) {
    throw new Error('useSellerCartContext must be used within SellerCartProvider');
  }
  return context;
}

/**
 * useSellerCartContextSafe — retorna null em vez de lançar erro quando o contexto está ausente.
 *
 * Usar em componentes que precisam renderizar dentro de Suspense fallbacks, durante HMR
 * ou em qualquer contexto onde o SellerCartProvider pode não ter montado ainda.
 * O componente consumidor é responsável por lidar com o retorno null.
 *
 * Resolve: 21.664 unhandled_error + 5.123 React_Boundary_Error em frontend_telemetry.
 */
export function useSellerCartContextSafe() {
  return useContext(SellerCartContext) ?? null;
}
