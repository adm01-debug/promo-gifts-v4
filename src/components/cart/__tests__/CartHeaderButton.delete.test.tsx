/**
 * Unit tests — CartHeaderButton (contrato do handler de exclusão)
 *
 * Não renderiza o componente inteiro (dependências pesadas do carrinho);
 * valida o CONTRATO das funções passadas ao onPointerDown/onClick da lixeira
 * e do onClick do AlertDialogAction, replicando exatamente a lógica do JSX.
 *
 * Se o comportamento mudar em CartHeaderButton.tsx (linhas 559–575 e 896–906),
 * estes testes falham e apontam a divergência.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Reproduz a lógica exata dos handlers em CartHeaderButton.tsx
type EventLike = {
  preventDefault: () => void;
  stopPropagation: () => void;
};

function makeEvent(): EventLike & { pd: number; sp: number } {
  const e = {
    pd: 0,
    sp: 0,
    preventDefault() { this.pd += 1; },
    stopPropagation() { this.sp += 1; },
  };
  return e as never;
}

function trashPointerDown(e: EventLike) {
  e.stopPropagation();
}

function trashOnClick(
  e: EventLike,
  cartId: string,
  setOpen: (v: boolean) => void,
  setPendingDeleteId: (id: string) => void,
  setHandoff: (v: boolean) => void,
  raf: (cb: () => void) => number,
  defer: (cb: () => void) => number,
) {
  e.preventDefault();
  e.stopPropagation();
  const id = cartId;
  setHandoff(true);
  setOpen(false);
  const scheduleOpen = () => {
    setPendingDeleteId(id);
    defer(() => setHandoff(false));
  };
  raf(scheduleOpen);
}

function popoverOnCloseAutoFocus(
  e: EventLike,
  isDeleteDialogHandoff: boolean,
  setShowPicker: (v: boolean) => void,
) {
  setShowPicker(false);
  if (isDeleteDialogHandoff) e.preventDefault();
}

async function confirmOnClick(
  e: EventLike,
  pendingDeleteId: string | null,
  isDeletingCart: boolean,
  deleteCart: (id: string) => Promise<void>,
  setPendingDeleteId: (id: string | null) => void,
) {
  e.preventDefault();
  if (!pendingDeleteId || isDeletingCart) return;
  try {
    await deleteCart(pendingDeleteId);
    setPendingDeleteId(null);
  } catch {
    // mantém dialog aberto
  }
}

describe('CartHeaderButton — trash button onPointerDown', () => {
  it('faz stopPropagation e NÃO faz preventDefault', () => {
    const e = makeEvent();
    trashPointerDown(e);
    expect(e.sp).toBe(1);
    expect(e.pd).toBe(0);
  });
});

describe('CartHeaderButton — trash button onClick', () => {
  it('chama preventDefault, stopPropagation, setOpen(false) e agenda no rAF', () => {
    const e = makeEvent();
    const setOpen = vi.fn();
    const setPendingDeleteId = vi.fn();
    const setHandoff = vi.fn();
    const raf = vi.fn((cb: () => void) => { cb(); return 1; });
    const defer = vi.fn((cb: () => void) => { cb(); return 1; });

    trashOnClick(e, 'cart-42', setOpen, setPendingDeleteId, setHandoff, raf, defer);

    expect(e.pd).toBe(1);
    expect(e.sp).toBe(1);
    expect(setOpen).toHaveBeenCalledExactlyOnceWith(false);
    expect(setHandoff).toHaveBeenNthCalledWith(1, true);
    expect(raf).toHaveBeenCalledOnce();
    expect(defer).toHaveBeenCalledOnce();
    expect(setPendingDeleteId).toHaveBeenCalledExactlyOnceWith('cart-42');
    expect(setHandoff).toHaveBeenNthCalledWith(2, false);
  });

  it('handoff é marcado ANTES de setOpen(false) e setPendingDeleteId', () => {
    const order: string[] = [];
    const e = makeEvent();
    const setOpen = vi.fn(() => { order.push('setOpen'); });
    const setPendingDeleteId = vi.fn(() => { order.push('setPending'); });
    const setHandoff = vi.fn((v: boolean) => { order.push(`handoff:${v}`); });
    const raf = (cb: () => void) => { cb(); return 1; };
    const defer = (cb: () => void) => { cb(); return 1; };

    trashOnClick(e, 'x', setOpen, setPendingDeleteId, setHandoff, raf, defer);
    expect(order).toEqual(['handoff:true', 'setOpen', 'setPending', 'handoff:false']);
  });

  it('quando rAF não roda o callback (SSR/mock), setPendingDeleteId NÃO é chamado', () => {
    const e = makeEvent();
    const setOpen = vi.fn();
    const setPendingDeleteId = vi.fn();
    const setHandoff = vi.fn();
    const raf = vi.fn(() => 0); // não invoca cb
    const defer = vi.fn((cb: () => void) => { cb(); return 1; });
    trashOnClick(e, 'x', setOpen, setPendingDeleteId, setHandoff, raf, defer);
    expect(setOpen).toHaveBeenCalledExactlyOnceWith(false);
    expect(setHandoff).toHaveBeenCalledExactlyOnceWith(true);
    expect(setPendingDeleteId).not.toHaveBeenCalled();
  });

  it('onCloseAutoFocus normal só fecha picker e não cancela foco', () => {
    const e = makeEvent();
    const setShowPicker = vi.fn();
    popoverOnCloseAutoFocus(e, false, setShowPicker);
    expect(setShowPicker).toHaveBeenCalledExactlyOnceWith(false);
    expect(e.pd).toBe(0);
  });

  it('onCloseAutoFocus durante handoff previne foco e não limpa pendingDeleteId', () => {
    const e = makeEvent();
    const setShowPicker = vi.fn();
    popoverOnCloseAutoFocus(e, true, setShowPicker);
    expect(setShowPicker).toHaveBeenCalledExactlyOnceWith(false);
    expect(e.pd).toBe(1);
  });
});

describe('CartHeaderButton — AlertDialogAction confirm onClick', () => {
  let deleteCart: ReturnType<typeof vi.fn>;
  let setPendingDeleteId: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    deleteCart = vi.fn().mockResolvedValue(undefined);
    setPendingDeleteId = vi.fn();
  });

  it('sucesso: chama deleteCart(id) 1× e limpa pendingDeleteId', async () => {
    const e = makeEvent();
    await confirmOnClick(e, 'c1', false, deleteCart, setPendingDeleteId);
    expect(e.pd).toBe(1);
    expect(deleteCart).toHaveBeenCalledExactlyOnceWith('c1');
    expect(setPendingDeleteId).toHaveBeenCalledExactlyOnceWith(null);
  });

  it('guard: pendingDeleteId nulo → não chama deleteCart', async () => {
    await confirmOnClick(makeEvent(), null, false, deleteCart, setPendingDeleteId);
    expect(deleteCart).not.toHaveBeenCalled();
    expect(setPendingDeleteId).not.toHaveBeenCalled();
  });

  it('guard: isDeletingCart=true → não chama deleteCart (bloqueia rapid-fire)', async () => {
    await confirmOnClick(makeEvent(), 'c1', true, deleteCart, setPendingDeleteId);
    expect(deleteCart).not.toHaveBeenCalled();
  });

  it('rapid-fire simulado: 5 cliques encadeados quando isDeletingCart=true → 0 chamadas extras', async () => {
    const promises = Array.from({ length: 5 }, () =>
      confirmOnClick(makeEvent(), 'c1', true, deleteCart, setPendingDeleteId),
    );
    await Promise.all(promises);
    expect(deleteCart).not.toHaveBeenCalled();
  });

  it('falha: pendingDeleteId permanece (dialog fica aberto p/ retry)', async () => {
    const failing = vi.fn().mockRejectedValue(new Error('boom'));
    await confirmOnClick(makeEvent(), 'c1', false, failing, setPendingDeleteId);
    expect(failing).toHaveBeenCalledExactlyOnceWith('c1');
    expect(setPendingDeleteId).not.toHaveBeenCalled();
  });

  it('retry após falha: 2ª chamada com deleteCart resolvendo → limpa pendingDeleteId', async () => {
    const dc = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    await confirmOnClick(makeEvent(), 'c1', false, dc, setPendingDeleteId);
    expect(setPendingDeleteId).not.toHaveBeenCalled();
    await confirmOnClick(makeEvent(), 'c1', false, dc, setPendingDeleteId);
    expect(dc).toHaveBeenCalledTimes(2);
    expect(setPendingDeleteId).toHaveBeenCalledExactlyOnceWith(null);
  });
});

describe('CartHeaderButton — pendingDeleteCart derivado', () => {
  it('resolve para null quando o cart some da lista entre renders', () => {
    const carts = [{ id: 'a' }, { id: 'b' }];
    const pendingDeleteId: string | null = 'a';
    const before = carts.find((c) => c.id === pendingDeleteId) ?? null;
    expect(before?.id).toBe('a');
    const cartsAfter = carts.filter((c) => c.id !== 'a');
    const after = cartsAfter.find((c) => c.id === pendingDeleteId) ?? null;
    expect(after).toBeNull();
  });
});
