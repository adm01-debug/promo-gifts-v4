import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { StockCategoryTreeSelect } from '../StockCategoryTreeSelect';
import type { CategoryNode, CategoryTreeItem } from '@/hooks/products';

// ── Mock do hook de árvore de categorias ─────────────────────────
const mockUseCategoriesTree = vi.fn();
vi.mock('@/hooks/products', () => ({
  useCategoriesTree: () => mockUseCategoriesTree(),
}));

// ── Factories ────────────────────────────────────────────────────
const node = (over: Partial<CategoryNode> & { id: string; name: string }): CategoryNode => ({
  level: 1,
  parent_id: null,
  children: [],
  ...over,
});

const flat = (n: CategoryNode): CategoryTreeItem[] => [
  { id: n.id, name: n.name, level: n.level, parent_id: n.parent_id },
  ...(n.children?.flatMap(flat) ?? []),
];

const setTree = (tree: CategoryNode[], isLoading = false) => {
  const categories = tree.flatMap(flat);
  mockUseCategoriesTree.mockReturnValue({ tree, categories, isLoading });
};

const sampleTree: CategoryNode[] = [
  node({
    id: 'cat-escritorio',
    name: 'Escritório',
    children: [
      node({ id: 'cat-canetas', name: 'Canetas', level: 2, parent_id: 'cat-escritorio' }),
      node({ id: 'cat-cadernos', name: 'Cadernos', level: 2, parent_id: 'cat-escritorio' }),
    ],
  }),
  node({ id: 'cat-bolsas', name: 'Bolsas' }),
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('StockCategoryTreeSelect', () => {
  it('mostra skeleton de carregamento quando isLoading=true', () => {
    setTree([], true);
    const { container } = render(<StockCategoryTreeSelect value={undefined} onChange={vi.fn()} />);
    // não há busca/tree no estado de loading
    expect(screen.queryByPlaceholderText('Buscar categoria...')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renderiza opção "Todas as categorias", raízes e o campo de busca', () => {
    setTree(sampleTree);
    render(<StockCategoryTreeSelect value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText('Todas as categorias')).toBeInTheDocument();
    expect(screen.getByText('Escritório')).toBeInTheDocument();
    expect(screen.getByText('Bolsas')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar categoria...')).toBeInTheDocument();
    // filhos não aparecem antes de expandir
    expect(screen.queryByText('Canetas')).not.toBeInTheDocument();
  });

  it('seleciona uma categoria folha e dispara onChange com o nome', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    setTree(sampleTree);
    render(<StockCategoryTreeSelect value={undefined} onChange={onChange} />);
    await user.click(screen.getByText('Bolsas'));
    expect(onChange).toHaveBeenCalledWith('Bolsas', 'Bolsas');
  });

  it('expande um nó com filhos ao clicar, exibindo os filhos', async () => {
    const user = userEvent.setup();
    setTree(sampleTree);
    render(<StockCategoryTreeSelect value={undefined} onChange={vi.fn()} />);
    await user.click(screen.getByText('Escritório'));
    expect(await screen.findByText('Canetas')).toBeInTheDocument();
    expect(screen.getByText('Cadernos')).toBeInTheDocument();
  });

  it('desmarca (toggle) quando clica na categoria já selecionada na árvore', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    setTree(sampleTree);
    render(<StockCategoryTreeSelect value="Bolsas" onChange={onChange} />);
    // "Bolsas" aparece tanto no chip quanto na árvore; clicamos no nó da árvore.
    const matches = screen.getAllByText('Bolsas');
    expect(matches.length).toBeGreaterThanOrEqual(2);
    await user.click(matches[matches.length - 1]);
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('mostra o indicador da categoria selecionada (nome resolvido do id) e limpa via botão X do chip', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    setTree(sampleTree);
    render(<StockCategoryTreeSelect value="cat-bolsas" onChange={onChange} />);
    // o chip resolve o nome a partir do id e aparece junto do nó da árvore
    expect(screen.getAllByText('Bolsas').length).toBeGreaterThanOrEqual(2);
    // sem busca, o único <button> é o X do chip selecionado
    const clearButtons = screen.getAllByRole('button');
    await user.click(clearButtons[0]);
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('clicar em "Todas as categorias" limpa o filtro', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    setTree(sampleTree);
    render(<StockCategoryTreeSelect value="Bolsas" onChange={onChange} />);
    await user.click(screen.getByText('Todas as categorias'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('filtra a árvore pela busca, exibindo nó correspondente e ocultando os demais', async () => {
    const user = userEvent.setup();
    setTree(sampleTree);
    render(<StockCategoryTreeSelect value={undefined} onChange={vi.fn()} />);
    await user.type(screen.getByPlaceholderText('Buscar categoria...'), 'Canetas');
    // o filho que casa aparece (via expansão automática do pai)
    expect(await screen.findByText('Canetas')).toBeInTheDocument();
    // a outra raiz sem correspondência some
    expect(screen.queryByText('Bolsas')).not.toBeInTheDocument();
    // o irmão que não casa também some
    expect(screen.queryByText('Cadernos')).not.toBeInTheDocument();
  });

  it('limpa a busca com o botão X dentro do input', async () => {
    const user = userEvent.setup();
    setTree(sampleTree);
    render(<StockCategoryTreeSelect value={undefined} onChange={vi.fn()} />);
    const input = screen.getByPlaceholderText('Buscar categoria...') as HTMLInputElement;
    await user.type(input, 'Bolsas');
    expect(input.value).toBe('Bolsas');
    // botão X de limpar busca surge ao digitar
    const clearSearch = input.parentElement?.querySelector('button');
    expect(clearSearch).toBeTruthy();
    await user.click(clearSearch!);
    expect(input.value).toBe('');
  });
});
