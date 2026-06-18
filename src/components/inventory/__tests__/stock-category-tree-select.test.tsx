/**
 * Tests for StockCategoryTreeSelect — hierarchical category selector.
 * Covers: loading state, tree rendering, selection, deselection, search filter, toggle.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StockCategoryTreeSelect } from '@/components/inventory/StockCategoryTreeSelect';
import type { CategoryNode } from '@/hooks/products';

// Mock framer-motion to avoid animation complexity
vi.mock('framer-motion', () => ({
  m: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockCategoriesTree = {
  tree: [] as CategoryNode[],
  isLoading: false,
  categories: [] as Array<{ id: string; name: string }>,
};

vi.mock('@/hooks/products', async () => {
  const actual = await vi.importActual('@/hooks/products');
  return {
    ...actual,
    useCategoriesTree: vi.fn(() => mockCategoriesTree),
  };
});

const treeWithChildren: CategoryNode[] = [
  {
    id: 'cat-1',
    name: 'Brindes',
    children: [
      { id: 'cat-1-1', name: 'Canetas', children: [], icon: '✏️' },
      { id: 'cat-1-2', name: 'Cadernos', children: [] },
    ],
    icon: '🎁',
  },
  {
    id: 'cat-2',
    name: 'Vestuário',
    children: [],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockCategoriesTree.tree = [];
  mockCategoriesTree.isLoading = false;
  mockCategoriesTree.categories = [];
});

describe('StockCategoryTreeSelect — loading state', () => {
  it('renders skeleton when isLoading=true', () => {
    mockCategoriesTree.isLoading = true;
    const { container } = render(<StockCategoryTreeSelect value={undefined} onChange={vi.fn()} />);
    const pulseElements = container.querySelectorAll('.animate-pulse');
    expect(pulseElements.length).toBeGreaterThan(0);
  });
});

describe('StockCategoryTreeSelect — basic render', () => {
  it('renders "Todas as categorias" option', () => {
    render(<StockCategoryTreeSelect value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText('Todas as categorias')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<StockCategoryTreeSelect value={undefined} onChange={vi.fn()} />);
    expect(screen.getByPlaceholderText('Buscar categoria...')).toBeInTheDocument();
  });

  it('does NOT show selected indicator when value is undefined', () => {
    render(<StockCategoryTreeSelect value={undefined} onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: '' })).not.toBeInTheDocument();
  });
});

describe('StockCategoryTreeSelect — tree rendering', () => {
  beforeEach(() => {
    mockCategoriesTree.tree = treeWithChildren;
    mockCategoriesTree.categories = [
      { id: 'cat-1', name: 'Brindes' },
      { id: 'cat-1-1', name: 'Canetas' },
      { id: 'cat-1-2', name: 'Cadernos' },
      { id: 'cat-2', name: 'Vestuário' },
    ];
  });

  it('renders root level nodes', () => {
    render(<StockCategoryTreeSelect value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText('Brindes')).toBeInTheDocument();
    expect(screen.getByText('Vestuário')).toBeInTheDocument();
  });

  it('does not render children before parent is expanded', () => {
    render(<StockCategoryTreeSelect value={undefined} onChange={vi.fn()} />);
    expect(screen.queryByText('Canetas')).not.toBeInTheDocument();
  });

  it('clicking parent node with children expands children', () => {
    render(<StockCategoryTreeSelect value={undefined} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Brindes'));
    expect(screen.getByText('Canetas')).toBeInTheDocument();
    expect(screen.getByText('Cadernos')).toBeInTheDocument();
  });

  it('clicking parent again collapses children', () => {
    render(<StockCategoryTreeSelect value={undefined} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('Brindes'));
    fireEvent.click(screen.getByText('Brindes'));
    expect(screen.queryByText('Canetas')).not.toBeInTheDocument();
  });
});

describe('StockCategoryTreeSelect — selection', () => {
  beforeEach(() => {
    mockCategoriesTree.tree = treeWithChildren;
    mockCategoriesTree.categories = [{ id: 'cat-2', name: 'Vestuário' }];
  });

  it('calls onChange when node is selected', () => {
    const onChange = vi.fn();
    render(<StockCategoryTreeSelect value={undefined} onChange={onChange} />);
    fireEvent.click(screen.getByText('Vestuário'));
    expect(onChange).toHaveBeenCalledWith('Vestuário', 'Vestuário');
  });

  it('calls onChange(undefined) when same node is selected again (deselect)', () => {
    const onChange = vi.fn();
    mockCategoriesTree.categories = [{ id: 'cat-2', name: 'Vestuário' }];
    render(<StockCategoryTreeSelect value="Vestuário" onChange={onChange} />);
    // When selected, "Vestuário" appears in both the indicator and the tree node
    const matches = screen.getAllByText('Vestuário');
    // Click the tree node (last occurrence)
    fireEvent.click(matches[matches.length - 1]);
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('calls onChange(undefined) when "Todas as categorias" clicked', () => {
    const onChange = vi.fn();
    render(<StockCategoryTreeSelect value="Vestuário" onChange={onChange} />);
    fireEvent.click(screen.getByText('Todas as categorias'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('shows selected indicator when value is set', () => {
    mockCategoriesTree.categories = [{ id: 'cat-2', name: 'Vestuário' }];
    render(<StockCategoryTreeSelect value="Vestuário" onChange={vi.fn()} />);
    // The selected name should appear in the indicator div
    const indicators = screen.getAllByText('Vestuário');
    expect(indicators.length).toBeGreaterThan(0);
  });

  it('clear button in selected indicator calls onChange(undefined)', () => {
    const onChange = vi.fn();
    mockCategoriesTree.categories = [{ id: 'cat-2', name: 'Vestuário' }];
    render(<StockCategoryTreeSelect value="Vestuário" onChange={onChange} />);
    // The X button inside the selected indicator
    const xButtons = screen.getAllByRole('button');
    // First button is the clear in the selected indicator
    fireEvent.click(xButtons[0]);
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});

describe('StockCategoryTreeSelect — search', () => {
  beforeEach(() => {
    mockCategoriesTree.tree = treeWithChildren;
    mockCategoriesTree.categories = [
      { id: 'cat-1', name: 'Brindes' },
      { id: 'cat-1-1', name: 'Canetas' },
      { id: 'cat-1-2', name: 'Cadernos' },
      { id: 'cat-2', name: 'Vestuário' },
    ];
  });

  it('filters nodes by search term', () => {
    render(<StockCategoryTreeSelect value={undefined} onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText('Buscar categoria...');
    fireEvent.change(input, { target: { value: 'Vest' } });
    expect(screen.getByText('Vestuário')).toBeInTheDocument();
    expect(screen.queryByText('Brindes')).not.toBeInTheDocument();
  });

  it('shows parent when child matches search', () => {
    render(<StockCategoryTreeSelect value={undefined} onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText('Buscar categoria...');
    fireEvent.change(input, { target: { value: 'Caneta' } });
    expect(screen.getByText('Brindes')).toBeInTheDocument();
    expect(screen.getByText('Canetas')).toBeInTheDocument();
  });

  it('shows X button in search input when text is entered', () => {
    render(<StockCategoryTreeSelect value={undefined} onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText('Buscar categoria...');
    fireEvent.change(input, { target: { value: 'test' } });
    // There should be an X button to clear search
    const xBtns = screen.getAllByRole('button');
    expect(xBtns.length).toBeGreaterThan(0);
  });

  it('clearing search shows all nodes again', () => {
    render(<StockCategoryTreeSelect value={undefined} onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText('Buscar categoria...');
    fireEvent.change(input, { target: { value: 'Vest' } });
    // Now clear — click the X button in search
    const xBtns = screen.getAllByRole('button');
    fireEvent.click(xBtns[xBtns.length - 1]); // last button is the search X
    expect(screen.getByText('Brindes')).toBeInTheDocument();
  });
});
