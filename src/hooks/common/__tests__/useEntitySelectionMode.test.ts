/**
 * Testes unitários — useEntitySelectionMode
 * Hook genérico de seleção em lote para grids de entidades.
 * Extrai da duplicação entre useNoveltiesSelectionMode e useReplenishmentsSelectionMode.
 *
 * Cobertura: estado inicial, toggleSelect, selectAll, clearSelection,
 * limpeza ao sair do modo, remoção de IDs obsoletos, ações em lote,
 * handleWizardComplete (quote/cart), selectedProducts derivação.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { toast } from 'sonner';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';
import {
  useEntitySelectionMode,
  type SelectableEntity,
  type UseEntitySelectionModeParams,
} from '../useEntitySelectionMode';
import type { Product } from '@/hooks/products';
import type { BulkVariantSelection } from '@/components/catalog/BulkVariantWizard';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock('@/components/catalog/BulkVariantWizard', () => ({}));

interface TestEntity extends SelectableEntity {
  name: string;
}

function makeEntity(id: string, name = `P${id}`): TestEntity {
  return { product_id: id, name };
}
function makeProduct(id: string): Product {
  return {
    id,
    name: `P${id}`,
    sku: `SKU-${id}`,
    price: 10,
    image_url: '',
    category_name: 'T',
    brand: '',
    description: '',
    supplier_reference: '',
    stock_status: 'in_stock',
  } as unknown as Product;
}
function makeParams(
  entities: TestEntity[] = [],
  mode = true,
): UseEntitySelectionModeParams<TestEntity> {
  return {
    selectionMode: mode,
    filteredProducts: entities,
    entityToProduct: (e) => makeProduct(e.product_id),
  };
}

beforeEach(() => {
  useFavoritesStore.setState({ favorites: [], favoriteCount: 0, isLoaded: true });
  useComparisonStore.setState({
    compareItems: [],
    compareIds: [],
    compareCount: 0,
    canAddMore: true,
    isLoaded: true,
  });
  mockNavigate.mockClear();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});
afterEach(() => vi.clearAllMocks());

describe('estado inicial', () => {
  it('selectedCount=0, sem IDs', () => {
    const { result } = renderHook(() => useEntitySelectionMode(makeParams([makeEntity('e1')])));
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.selectedIds.size).toBe(0);
  });
  it('modais fechados', () => {
    const { result } = renderHook(() => useEntitySelectionMode(makeParams()));
    expect(result.current.collectionModalOpen).toBe(false);
    expect(result.current.cartModalOpen).toBe(false);
    expect(result.current.variantWizardOpen).toBe(false);
  });
  it('selectedProducts vazio', () => {
    const { result } = renderHook(() => useEntitySelectionMode(makeParams([makeEntity('e1')])));
    expect(result.current.selectedProducts).toHaveLength(0);
  });
});

describe('toggleSelect', () => {
  it('adiciona ID', () => {
    const { result } = renderHook(() => useEntitySelectionMode(makeParams([makeEntity('e1')])));
    act(() => {
      result.current.toggleSelect('e1');
    });
    expect(result.current.selectedIds.has('e1')).toBe(true);
    expect(result.current.selectedCount).toBe(1);
  });
  it('remove ID já selecionado', () => {
    const { result } = renderHook(() => useEntitySelectionMode(makeParams([makeEntity('e1')])));
    act(() => {
      result.current.toggleSelect('e1');
    });
    act(() => {
      result.current.toggleSelect('e1');
    });
    expect(result.current.selectedCount).toBe(0);
  });
  it('múltiplos IDs independentes', () => {
    const entities = [makeEntity('e1'), makeEntity('e2'), makeEntity('e3')];
    const { result } = renderHook(() => useEntitySelectionMode(makeParams(entities)));
    act(() => {
      result.current.toggleSelect('e1');
      result.current.toggleSelect('e3');
    });
    expect(result.current.selectedCount).toBe(2);
    expect(result.current.selectedIds.has('e2')).toBe(false);
  });
});

describe('selectAll', () => {
  it('seleciona todas as entidades', () => {
    const entities = [makeEntity('e1'), makeEntity('e2'), makeEntity('e3')];
    const { result } = renderHook(() => useEntitySelectionMode(makeParams(entities)));
    act(() => {
      result.current.selectAll();
    });
    expect(result.current.selectedCount).toBe(3);
  });
  it('lista vazia não quebra', () => {
    const { result } = renderHook(() => useEntitySelectionMode(makeParams([])));
    act(() => {
      result.current.selectAll();
    });
    expect(result.current.selectedCount).toBe(0);
  });
});

describe('clearSelection', () => {
  it('limpa todos os IDs', () => {
    const entities = [makeEntity('e1'), makeEntity('e2')];
    const { result } = renderHook(() => useEntitySelectionMode(makeParams(entities)));
    act(() => {
      result.current.selectAll();
    });
    act(() => {
      result.current.clearSelection();
    });
    expect(result.current.selectedCount).toBe(0);
  });
});

describe('limpeza ao desativar selection mode', () => {
  it('limpa selectedIds quando selectionMode → false', () => {
    const entities = [makeEntity('e1')];
    const { result, rerender } = renderHook(
      ({ m }: { m: boolean }) =>
        useEntitySelectionMode({ ...makeParams(entities, true), selectionMode: m }),
      { initialProps: { m: true } },
    );
    act(() => {
      result.current.toggleSelect('e1');
    });
    expect(result.current.selectedCount).toBe(1);
    rerender({ m: false });
    expect(result.current.selectedCount).toBe(0);
  });
});

describe('remoção de IDs obsoletos', () => {
  it('remove IDs que saíram de filteredProducts', () => {
    const entities = [makeEntity('e1'), makeEntity('e2')];
    const { result, rerender } = renderHook(
      ({ e }: { e: TestEntity[] }) => useEntitySelectionMode(makeParams(e)),
      { initialProps: { e: entities } },
    );
    act(() => {
      result.current.selectAll();
    });
    expect(result.current.selectedCount).toBe(2);
    rerender({ e: [makeEntity('e1')] });
    expect(result.current.selectedIds.has('e2')).toBe(false);
    expect(result.current.selectedCount).toBe(1);
  });
});

describe('handleBulk* — abre wizard', () => {
  it.each([
    ['handleBulkFavorite', 'favorite'],
    ['handleBulkCompare', 'compare'],
    ['handleBulkCollection', 'collection'],
    ['handleBulkCart', 'cart'],
    ['handleBulkQuote', 'quote'],
  ] as const)(`%s → variantWizardOpen=true, wizardMode='%s'`, (handler, mode) => {
    const { result } = renderHook(() => useEntitySelectionMode(makeParams()));
    act(() => {
      (result.current[handler] as () => void)();
    });
    expect(result.current.variantWizardOpen).toBe(true);
    expect(result.current.wizardMode).toBe(mode);
  });
});

describe('handleWizardComplete quote', () => {
  it('navega para /orcamentos/novo', () => {
    const { result } = renderHook(() => useEntitySelectionMode(makeParams([makeEntity('e1')])));
    act(() => {
      result.current.handleBulkQuote();
    });
    act(() => {
      result.current.handleWizardComplete([
        { product: makeProduct('e1'), variant: null } satisfies BulkVariantSelection,
      ]);
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const [path] = mockNavigate.mock.calls[0];
    expect(path).toMatch(/^\/orcamentos\/novo\?/);
    expect(decodeURIComponent(path)).toContain('e1');
  });
  it('noop se selections vazio', () => {
    const { result } = renderHook(() => useEntitySelectionMode(makeParams()));
    act(() => {
      result.current.handleBulkQuote();
    });
    act(() => {
      result.current.handleWizardComplete([]);
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

describe('handleWizardComplete cart', () => {
  it('abre cartModal e salva selections', () => {
    const { result } = renderHook(() => useEntitySelectionMode(makeParams()));
    act(() => {
      result.current.handleBulkCart();
    });
    act(() => {
      result.current.handleWizardComplete([
        { product: makeProduct('e1'), variant: null } satisfies BulkVariantSelection,
      ]);
    });
    expect(result.current.cartModalOpen).toBe(true);
    expect(result.current.wizardSelections).toHaveLength(1);
  });
});

describe('selectedProducts derivação', () => {
  it('filtra e converte via entityToProduct', () => {
    const entities = [makeEntity('e1'), makeEntity('e2')];
    const { result } = renderHook(() => useEntitySelectionMode(makeParams(entities)));
    act(() => {
      result.current.toggleSelect('e2');
    });
    expect(result.current.selectedProducts).toHaveLength(1);
    expect(result.current.selectedProducts[0].id).toBe('e2');
    expect(result.current.bulkCartProducts).toHaveLength(1);
  });
  it('firstSelectedProduct', () => {
    const entities = [makeEntity('e1'), makeEntity('e2')];
    const { result } = renderHook(() => useEntitySelectionMode(makeParams(entities)));
    act(() => {
      result.current.toggleSelect('e1');
    });
    expect(result.current.firstSelectedId).toBe('e1');
    expect(result.current.firstSelectedProduct?.product_id).toBe('e1');
  });
});
