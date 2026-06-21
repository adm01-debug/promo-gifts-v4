/**
 * useSellerCartsPage — Business logic hook for SellerCartsPage
 * Extracted to follow Page → Hook → Service pattern.
 */
import { useState, useCallback, useMemo, useRef, useEffect, useContext } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useSellerCartContext } from '@/contexts/SellerCartContext';
import { useCartTemplates, type CartTemplateItem, type SellerCart } from '@/hooks/products';
import { ProductsContext } from '@/contexts/ProductsContext';
import { supabase } from '@/integrations/supabase/client';
import {
  recordAction,
  exportCartToCSV,
  exportCartToPDF,
  shareCartLink,
} from '@/components/cart/CartUtilComponents';
import { toast } from 'sonner';
import { showUndoToast } from '@/utils/undoToast';
import { differenceInDays } from 'date-fns';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

export function useSellerCartsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { cartId: routeCartId } = useParams<{ cartId?: string }>();
  const {
    carts,
    activeCart,
    activeCartId,
    isLoading,
    totalItems,
    canCreateCart,
    setActiveCartId,
    deleteCart,
    addToActiveCart,
    removeItem,
    updateItemQuantity,
    updateItemNotes,
    updateItemSortOrder,
    updateCartNotes,
    flushCartNotes,
    updateCartStatus,
    duplicateCart,
    moveItemToCart,
    duplicateItemToCart,
    clearCart,
    restoreItems,
  } = useSellerCartContext();

  const { templates, saveTemplate, deleteTemplate } = useCartTemplates();

  const productsCtx = useContext(ProductsContext);
  const allProducts = useMemo(() => productsCtx?.products ?? [], [productsCtx?.products]);
  const isLoadingProducts = productsCtx?.isLoading || false;

  const [showNewCart, setShowNewCart] = useState(false);

  useEffect(() => {
    if (location.pathname === '/carrinhos/novo') setShowNewCart(true);
  }, [location.pathname]);

  const [cartNotesOpen, setCartNotesOpen] = useState(false);
  const [localCartNotes, setLocalCartNotes] = useState('');
  const debounceNotesRef = useRef<ReturnType<typeof setTimeout>>();
  // Always mirrors localCartNotes without stale-closure risk in effects/timers.
  const localCartNotesRef = useRef(localCartNotes);
  localCartNotesRef.current = localCartNotes;

  const stockMap = useMemo(() => {
    const map = new Map<string, number>();
    allProducts.forEach((p: { id: string; stock?: number }) => {
      if (p.stock !== undefined && p.stock !== null) map.set(p.id, p.stock);
    });
    return map;
  }, [allProducts]);

  const weightVolume = useMemo(() => {
    if (!activeCart) return null;
    // O(n+m): build Map once — avoids O(n*m) repeated .find() per item
    const dimMap = new Map(allProducts.map((p) => [p.id, p] as const));
    let totalWeightG = 0;
    let totalVolumeCm3 = 0;
    let hasData = false;
    activeCart.items.forEach((item) => {
      const product = dimMap.get(item.product_id) as
        | { dimensions?: { weight_g?: number }; boxVolumeCm3?: number }
        | undefined;
      if (!product) return;
      const weight = product.dimensions?.weight_g || 0;
      const volume = product.boxVolumeCm3 || 0;
      if (weight > 0) {
        totalWeightG += weight * item.quantity;
        hasData = true;
      }
      if (volume > 0) {
        totalVolumeCm3 += volume * item.quantity;
        hasData = true;
      }
    });
    if (!hasData) return null;
    return {
      weightKg: totalWeightG / 1000,
      volumeM3: totalVolumeCm3 / 1000000,
      volumeCm3: totalVolumeCm3,
    };
  }, [activeCart, allProducts]);

  // C5: guarda o ultimo cartId que existiu para este vendedor, para distinguir
  // URL invalida/de terceiro (nunca existiu -> avisa) de carrinho deletado
  // nesta sessao (existia e sumiu -> redireciona em silencio).
  const lastResolvedCartIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!routeCartId || isLoading) return;
    if (routeCartId === 'novo') return;
    const found = carts.some((c) => c.id === routeCartId);
    if (found) {
      lastResolvedCartIdRef.current = routeCartId;
      setActiveCartId(routeCartId);
      return;
    }
    // Nao encontrado: a RLS ja oculta carrinhos de outros vendedores, entao cair
    // silenciosamente no primeiro carrinho induziria o vendedor a editar o pedido errado.
    if (lastResolvedCartIdRef.current !== routeCartId) {
      toast.error('Carrinho nao encontrado', {
        description: 'Ele pode ter sido removido ou pertence a outro vendedor.',
      });
    }
    navigate('/carrinhos', { replace: true });
  }, [routeCartId, carts, isLoading, setActiveCartId, navigate]);

  // Tracks previous cartId so we can flush notes to the OLD cart when switching.
  const prevCartIdRef = useRef<string | undefined>(undefined);

  // On cart switch: flush pending debounce to PREVIOUS cart, then reset local state.
  // Early-return when notes-only change (same cart id) avoids double-flush with the
  // server-sync effect below. activeCart?.notes is in the dep array to satisfy
  // exhaustive-deps; the guard ensures the body only runs on actual cart switch.
  useEffect(() => {
    if (activeCart?.id === prevCartIdRef.current) return;
    if (debounceNotesRef.current && prevCartIdRef.current) {
      clearTimeout(debounceNotesRef.current);
      debounceNotesRef.current = undefined;
      updateCartNotes(prevCartIdRef.current, localCartNotesRef.current);
    }
    prevCartIdRef.current = activeCart?.id;
    setLocalCartNotes(activeCart?.notes ?? '');
    setCartNotesOpen(!!activeCart?.notes);
  }, [activeCart?.id, activeCart?.notes, updateCartNotes]);

  // On server-side notes update: sync local state only when user is not typing
  // (debounce pending = user is mid-edit; overwriting would discard in-flight keystrokes).
  useEffect(() => {
    if (!debounceNotesRef.current) {
      setLocalCartNotes(activeCart?.notes ?? '');
    }
  }, [activeCart?.notes]);

  // Cleanup debounceNotesRef no unmount — evita disparo após navegar para outra página.
  useEffect(() => {
    return () => {
      if (debounceNotesRef.current) clearTimeout(debounceNotesRef.current);
    };
  }, []);

  // Flush do debounce de notas quando o usuário fecha/recarrega a aba (beforeunload).
  // Sem isso, notas editadas nos últimos 800ms antes do fechamento são perdidas.
  const activeCartIdForFlush = activeCart?.id;
  useEffect(() => {
    const flush = () => {
      if (debounceNotesRef.current && activeCartIdForFlush) {
        clearTimeout(debounceNotesRef.current);
        debounceNotesRef.current = undefined;
        updateCartNotes(activeCartIdForFlush, localCartNotesRef.current);
      }
    };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [activeCartIdForFlush, updateCartNotes]);

  const handleCartNotesChange = (value: string) => {
    setLocalCartNotes(value);
    if (debounceNotesRef.current) clearTimeout(debounceNotesRef.current);
    debounceNotesRef.current = setTimeout(() => {
      if (activeCart) updateCartNotes(activeCart.id, value);
    }, 800);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !activeCart) return;
      const items = activeCart.items;
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(items, oldIndex, newIndex);
      updateItemSortOrder(reordered.map((item, idx) => ({ id: item.id, sort_order: idx })));
    },
    [activeCart, updateItemSortOrder],
  );

  const handleRemoveItem = useCallback(
    (itemId: string, itemName: string) => {
      const item = activeCart?.items.find((i) => i.id === itemId);
      removeItem(itemId);
      if (item && activeCart) {
        const cartId = activeCart.id;
        recordAction(cartId, { type: 'remove', itemName, time: new Date() });
        showUndoToast({
          title: `${itemName} removido`,
          description: activeCart.company_name,
          onUndo: () => {
            addToActiveCart(
              {
                product_id: item.product_id,
                product_name: item.product_name,
                product_sku: item.product_sku || undefined,
                product_image_url: item.product_image_url || undefined,
                product_price: item.product_price,
                quantity: item.quantity,
                color_name: item.color_name || undefined,
                color_hex: item.color_hex || undefined,
                notes: item.notes ?? undefined,
              },
              cartId,
            );
          },
        });
      }
    },
    [removeItem, activeCart, addToActiveCart],
  );

  const handleUpdateQuantity = useCallback(
    (itemId: string, qty: number) => {
      updateItemQuantity(itemId, qty);
      const item = activeCart?.items.find((i) => i.id === itemId);
      if (item && activeCart) {
        recordAction(activeCart.id, {
          type: 'qty',
          itemName: item.product_name,
          detail: `${qty}`,
          time: new Date(),
        });
      }
    },
    [updateItemQuantity, activeCart],
  );

  const handleMoveItem = useCallback(
    (itemId: string, targetCartId: string) => {
      const item = activeCart?.items.find((i) => i.id === itemId);
      const targetCart = carts.find((c) => c.id === targetCartId);
      moveItemToCart(itemId, targetCartId);
      if (item && activeCart) {
        recordAction(activeCart.id, {
          type: 'move',
          itemName: item.product_name,
          detail: targetCart?.company_name,
          time: new Date(),
        });
      }
    },
    [moveItemToCart, activeCart, carts],
  );

  const handleDuplicateItem = useCallback(
    (itemId: string, targetCartId: string) => {
      const item = activeCart?.items.find((i) => i.id === itemId);
      const targetCart = carts.find((c) => c.id === targetCartId);
      duplicateItemToCart(itemId, targetCartId);
      if (item && activeCart) {
        recordAction(activeCart.id, {
          type: 'duplicate',
          itemName: item.product_name,
          detail: targetCart?.company_name,
          time: new Date(),
        });
      }
    },
    [duplicateItemToCart, activeCart, carts],
  );

  const handleClearCart = useCallback(async () => {
    if (!activeCart) return;
    const itemsToRestore = [...activeCart.items];
    try {
      await clearCart(activeCart.id);
    } catch {
      toast.error('Erro ao limpar carrinho. Tente novamente.');
      return;
    }
    recordAction(activeCart.id, { type: 'clear', itemName: 'todos os itens', time: new Date() });

    showUndoToast({
      title: `Carrinho limpo`,
      description: activeCart.company_name,
      onUndo: () => {
        const addItems = itemsToRestore.map((item) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku || undefined,
          product_image_url: item.product_image_url || undefined,
          product_price: item.product_price,
          quantity: item.quantity,
          color_name: item.color_name || undefined,
          color_hex: item.color_hex || undefined,
          notes: item.notes ?? undefined,
          // Preserva a ordem original ao desfazer (espelha o snapshot do CartHeaderButton):
          // sem sort_order, restoreItems insere com sort_order nulo e o trigger reatribui
          // MAX+1 em ordem não-determinística (Promise.all), embaralhando os itens.
          sort_order: item.sort_order ?? undefined,
        }));
        restoreItems(activeCart.id, addItems);
      },
    });
  }, [clearCart, activeCart, restoreItems]);

  const handleSaveTemplate = useCallback(
    (name: string, description: string) => {
      if (!activeCart) return;
      const items: CartTemplateItem[] = activeCart.items.map((i) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        product_sku: i.product_sku || undefined,
        product_image_url: i.product_image_url || undefined,
        product_price: i.product_price,
        quantity: i.quantity,
        color_name: i.color_name || undefined,
        color_hex: i.color_hex || undefined,
      }));
      saveTemplate.mutate({ name, description, items });
    },
    [activeCart, saveTemplate],
  );

  const handleLoadTemplate = useCallback(
    (items: CartTemplateItem[]) => {
      if (items.length === 0) {
        toast.warning('Template sem itens válidos', {
          description: 'Nenhum item pôde ser carregado. Verifique se o template está correto.',
        });
        return;
      }
      // silent: cada item entra sem toast individual; mostramos um único
      // toast agregado abaixo (evita empilhar N toasts ao aplicar template).
      items.forEach((item) => {
        addToActiveCart(
          {
            product_id: item.product_id,
            product_name: item.product_name,
            product_sku: item.product_sku,
            product_image_url: item.product_image_url,
            product_price: item.product_price,
            quantity: item.quantity,
            color_name: item.color_name,
            color_hex: item.color_hex,
          },
          undefined,
          { silent: true },
        );
      });
      toast.success('Template aplicado ao carrinho');
    },
    [addToActiveCart],
  );

  const [confirmQuoteCart, setConfirmQuoteCart] = useState<SellerCart | null>(null);
  const [confirmDeleteCart, setConfirmDeleteCart] = useState(false);
  const [confirmClearCart, setConfirmClearCart] = useState(false);

  const handleGenerateQuote = useCallback((cart: SellerCart) => {
    if (cart.items.length === 0) {
      toast.error('Carrinho vazio', {
        description: 'Adicione ao menos um produto antes de gerar o orçamento.',
      });
      return;
    }
    setConfirmQuoteCart(cart);
  }, []);

  const confirmGenerateQuote = useCallback(async () => {
    if (!confirmQuoteCart) return;
    const cart = confirmQuoteCart;

    // T3: produto pode ter sido descontinuado depois de entrar no carrinho (product_id
    // e TEXT sem FK e product_price e denormalizado). Valida no catalogo (fonte de
    // verdade) quais ids ainda existem, para nao gerar orcamento com produto fantasma.
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const allIds = [...new Set(cart.items.map((i) => i.product_id))];
    const uuidIds = allIds.filter((id) => uuidRe.test(id));
    // Non-UUID IDs (legacy) bypass server validation — fail-open.
    const nonUuidIds = allIds.filter((id) => !uuidRe.test(id));
    const validIds = new Set<string>(nonUuidIds.map((id) => id.toLowerCase()));
    if (uuidIds.length > 0) {
      try {
        const { data, error } = await supabase.from('products').select('id').in('id', uuidIds);
        if (error) {
          // fail-open: don't block quote on DB error
          uuidIds.forEach((id) => validIds.add(id.toLowerCase()));
        } else {
          (data ?? []).forEach((row) => validIds.add(String(row.id).toLowerCase()));
        }
      } catch {
        uuidIds.forEach((id) => validIds.add(id.toLowerCase())); // fail-open
      }
    }
    const validItems = cart.items.filter((i) => validIds.has(i.product_id.toLowerCase()));
    const staleCount = cart.items.length - validItems.length;
    if (validItems.length === 0) {
      setConfirmQuoteCart(null);
      toast.error('Nao foi possivel gerar o orcamento', {
        description: 'Nenhum item deste carrinho esta mais disponivel no catalogo.',
      });
      return;
    }
    if (staleCount > 0) {
      toast.warning(`${staleCount} item(ns) fora do catalogo ignorado(s)`, {
        description: 'Produtos descontinuados nao entram no orcamento.',
      });
    }
    setConfirmQuoteCart(null);
    // Flush das notas em debounce antes de navegar — evita perda de notas editadas
    // nos últimos 800ms (o cleanup do unmount cancela o timer sem disparar).
    if (debounceNotesRef.current && activeCartIdForFlush) {
      clearTimeout(debounceNotesRef.current);
      debounceNotesRef.current = undefined;
      await flushCartNotes(activeCartIdForFlush, localCartNotesRef.current);
    }
    // Handoff para o módulo de orçamento: navega para /orcamentos/novo com cliente e
    // itens já pré-preenchidos via location.state (fromCart). NÃO persiste nada nem
    // consome número de orçamento — o orçamento só se torna real quando o vendedor
    // preenche gravação/pagamento/entrega e clica em Salvar. O carrinho é PRESERVADO.
    navigate('/orcamentos/novo', {
      state: {
        fromCart: true,
        companyId: cart.company_id,
        companyName: cart.company_name,
        companyLocation: cart.company_location || undefined,
        items: validItems.map((i) => ({
          product_id: i.product_id,
          product_name: i.product_name,
          product_sku: i.product_sku || undefined,
          product_image_url: i.product_image_url || undefined,
          quantity: i.quantity,
          unit_price: i.product_price,
          color_name: i.color_name || undefined,
          color_hex: i.color_hex || undefined,
        })),
      },
    });
  }, [confirmQuoteCart, navigate, activeCartIdForFlush, flushCartNotes]);

  const otherCarts = useMemo(
    () => carts.filter((c) => c.id !== activeCartId),
    [carts, activeCartId],
  );
  const cartAge = activeCart ? differenceInDays(new Date(), new Date(activeCart.created_at)) : 0;
  const cartSubtotal = activeCart
    ? activeCart.items.reduce((s, i) => s + i.product_price * i.quantity, 0)
    : 0;
  const cartTotalQty = activeCart ? activeCart.items.reduce((s, i) => s + i.quantity, 0) : 0;

  return {
    navigate,
    carts,
    activeCart,
    activeCartId,
    isLoading,
    totalItems,
    canCreateCart,
    setActiveCartId,
    deleteCart,
    removeItem,
    updateItemNotes,
    updateCartStatus,
    duplicateCart,
    templates,
    deleteTemplate,
    allProducts,
    showNewCart,
    setShowNewCart,
    cartNotesOpen,
    setCartNotesOpen,
    localCartNotes,
    handleCartNotesChange,
    stockMap,
    weightVolume,
    sensors,
    handleDragEnd,
    handleRemoveItem,
    handleUpdateQuantity,
    handleMoveItem,
    handleDuplicateItem,
    handleSaveTemplate,
    handleLoadTemplate,
    confirmQuoteCart,
    setConfirmQuoteCart,
    confirmDeleteCart,
    setConfirmDeleteCart,
    confirmClearCart,
    setConfirmClearCart,
    handleGenerateQuote,
    confirmGenerateQuote,
    handleClearCart,
    otherCarts,
    cartAge,
    cartSubtotal,
    cartTotalQty,
    isLoadingProducts,
    exportCartToCSV,
    exportCartToPDF,
    shareCartLink,
  };
}
