/**
 * Regressao: React #310 — "Rendered more hooks than during the previous render".
 *
 * O QUE ACONTECEU
 * ---------------
 * `MagazineEditorPage` tinha dois `useMemo` (paginacao e validacao do passo) DEPOIS dos
 * early-returns `if (!editor.loaded)` e `if (!editor.magazine)`. Como `loaded` comeca
 * `false` e vira `true` no efeito de carga, o primeiro render executava N hooks e o
 * segundo N+2. O React aborta com o #310 e o editor caia em 100% das montagens.
 *
 * O QUE ESTE TESTE TRAVA
 * ----------------------
 * Que TODOS os hooks rodem antes de qualquer early-return, atravessando a transicao
 * loading -> loaded. Qualquer hook reintroduzido abaixo de um `return` derruba a suite.
 *
 * Cobre tambem os shapes degenerados que chegam de linhas legadas do banco
 * (items/title/branding/content nulos) — foi assim que apareceu o segundo bug,
 * um null-deref em `magazine.items.length`.
 */
import { Component, type ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type * as ReactRouterDom from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BRANDING,
  DEFAULT_MAGAZINE_CONTENT,
  type Magazine,
  type MagazineItem,
} from '@/types/magazine';

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockGet = vi.fn<(id: string) => Promise<Magazine | null>>();

vi.mock('@/services/magazineService', () => ({
  magazineService: {
    get: (id: string) => mockGet(id),
    update: () => Promise.resolve(null),
    addProducts: () => Promise.resolve(null),
    removeItem: () => Promise.resolve(null),
    reorderItems: () => Promise.resolve(null),
    updateItem: () => Promise.resolve(null),
    publish: () => Promise.resolve(null),
    unpublish: () => Promise.resolve(null),
    updateContent: () => Promise.resolve(null),
    updateBranding: () => Promise.resolve(null),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, loading: false }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/components/seo/PageSEO', () => ({ PageSEO: () => null }));
vi.mock('../components/PreviewSidebar', () => ({ PreviewSidebar: () => <aside /> }));
vi.mock('../components/steps/IdentityStep', () => ({ IdentityStep: () => <div /> }));
vi.mock('../components/steps/ProductsStep', () => ({ ProductsStep: () => <div /> }));
vi.mock('../components/steps/ContentStep', () => ({ ContentStep: () => <div /> }));
vi.mock('../components/steps/DesignStep', () => ({ DesignStep: () => <div /> }));
vi.mock('../components/steps/LayoutStep', () => ({ LayoutStep: () => <div /> }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof ReactRouterDom>('react-router-dom');
  return { ...actual, useParams: () => ({ id: 'mag-1' }), useNavigate: () => vi.fn() };
});

const MagazineEditorPage = (await import('../MagazineEditorPage')).default;

// ── Fixtures ─────────────────────────────────────────────────────────────────
const makeItem = (i: number): MagazineItem =>
  ({
    id: `item-${i}`,
    position: i,
    productSnapshot: {
      id: `p-${i}`,
      name: `Produto ${i}`,
      category_name: 'Canetas',
      image_url: null,
      price: 10 + i,
    },
  }) as unknown as MagazineItem;

const baseMagazine = (over: Partial<Magazine> = {}): Magazine =>
  ({
    id: 'mag-1',
    ownerId: 'user-1',
    title: 'Revista de Teste',
    status: 'draft',
    templateId: 'classic',
    items: [makeItem(0), makeItem(1), makeItem(2)],
    branding: { ...DEFAULT_BRANDING },
    content: { ...DEFAULT_MAGAZINE_CONTENT },
    publicToken: null,
    viewCount: 0,
    publishedAt: null,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...over,
  }) as unknown as Magazine;

// ── Error boundary: transforma crash de render em assercao legivel ───────────
class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return <div data-testid="crash">{this.state.error.message}</div>;
    }
    return this.props.children;
  }
}

/** Monta o editor e falha se o React reclamar de ordem de hooks ou se algo estourar. */
async function mountAndAssertStable(magazine: Magazine | null) {
  mockGet.mockResolvedValue(magazine);
  const errors: string[] = [];
  const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(' '));
  });

  render(
    <MemoryRouter>
      <Boundary>
        <MagazineEditorPage />
      </Boundary>
    </MemoryRouter>,
  );

  // A transicao loading -> loaded e o momento exato do #310: e' quando a contagem
  // de hooks mudava entre um render e o seguinte.
  await waitFor(() => {
    expect(mockGet).toHaveBeenCalled();
  });
  await waitFor(() => {
    expect(screen.queryByText(/Carregando/i)).not.toBeInTheDocument();
  });

  spy.mockRestore();

  const hookError = errors.find((e) => /Rendered (more|fewer) hooks/i.test(e));
  expect(hookError, `React reclamou da ordem de hooks:\n${hookError}`).toBeUndefined();
  expect(screen.queryByTestId('crash'), 'o componente estourou durante o render').toBeNull();
}

// ── Suite ────────────────────────────────────────────────────────────────────
describe('MagazineEditorPage — ordem de hooks (React #310)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('atravessa loading -> loaded sem mudar a contagem de hooks', async () => {
    await mountAndAssertStable(baseMagazine());
  });

  it('sobrevive a items vazio', async () => {
    await mountAndAssertStable(baseMagazine({ items: [] }));
  });

  // Linhas legadas do banco chegam com colunas nulas mesmo o tipo dizendo o contrario.
  // paginateMagazine e stepValidation ja usavam `?? []`; o componente nao — e estourava.
  it('sobrevive a items null (linha legada)', async () => {
    await mountAndAssertStable(baseMagazine({ items: null as unknown as MagazineItem[] }));
  });

  it('sobrevive a title null', async () => {
    await mountAndAssertStable(baseMagazine({ title: null as unknown as string }));
  });

  it('sobrevive a branding null', async () => {
    await mountAndAssertStable(baseMagazine({ branding: null as unknown as Magazine['branding'] }));
  });

  it('sobrevive a content null', async () => {
    await mountAndAssertStable(baseMagazine({ content: null as unknown as Magazine['content'] }));
  });

  it('sobrevive a revista inexistente (early-return de "nao encontrada")', async () => {
    mockGet.mockResolvedValue(null);
    const errors: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
      errors.push(a.map(String).join(' '));
    });
    render(
      <MemoryRouter>
        <Boundary>
          <MagazineEditorPage />
        </Boundary>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalled();
    });
    spy.mockRestore();
    expect(errors.find((e) => /Rendered (more|fewer) hooks/i.test(e))).toBeUndefined();
  });
});
