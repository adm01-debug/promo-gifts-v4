/**
 * Integração: navega por rotas representativas dentro de um harness que
 * reusa o `RouteSuspense` real do projeto (location-aware com `getFallback`).
 * Cada página é um lazy import controlável (Promise pendente) — o que força
 * o `<Suspense>` a renderizar o skeleton correspondente. Confirmamos que
 * NENHUMA navegação dispara o warning canônico
 *   "Function components cannot be given refs".
 *
 * Por que este teste é diferente do `skeleton-fallbacks-ref-warning`?
 *  - Aquele monta cada skeleton (sozinho ou sob Radix/motion) em isolamento.
 *  - Este reproduz o caminho REAL: BrowserRouter → useLocation → getFallback
 *    → render do skeleton durante uma transição lazy, várias vezes em
 *    sequência. É o gatilho histórico do warning no preview do usuário.
 */
import { describe, it, beforeEach, afterEach, vi } from "vitest";
import * as React from "react";
import { Suspense } from "react";
import { render, cleanup, screen, act } from "@testing-library/react";
import {
  MemoryRouter,
  Routes,
  Route,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { installReactWarningGuard } from "../helpers/react-warning-guard";
import { getFallback } from "@/components/layout/SkeletonLoaders";

// SkeletonMonitor (envolvido por makeSkeleton) chama useAuth() para decidir
// se mostra o overlay de debug do tempo de skeleton. Em testes de renderização
// isolada, não temos AuthProvider — mockamos com um stub mínimo.
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ userRole: null, user: null, isLoading: false }),
}));


// ---------- Lazy controlado --------------------------------------------------
//
// Cada rota usa um `lazy()` com Promise que mantemos pendente — força o
// fallback a aparecer. Quando queremos "concluir" o load, basta resolver.
//
// IMPORTANTE: criar `lazy()` por teste para evitar cache do React entre
// runs (lazy memoiza por referência ao Promise).

interface ControlledLazy {
  Component: React.LazyExoticComponent<React.ComponentType>;
  resolve: () => void;
  resolved: boolean;
}

function createControlledLazy(label: string): ControlledLazy {
  let resolveFn!: (mod: { default: React.ComponentType }) => void;
  const promise = new Promise<{ default: React.ComponentType }>((res) => {
    resolveFn = res;
  });
  const Component = React.lazy(() => promise);
  const ctrl: ControlledLazy = {
    Component,
    resolved: false,
    resolve: () => {
      if (ctrl.resolved) return;
      ctrl.resolved = true;
      const Loaded = () => <div data-testid={`page-${label}`}>{label}</div>;
      resolveFn({ default: Loaded });
    },
  };
  return ctrl;
}

// ---------- Reusa o RouteSuspense real do App -------------------------------
//
// Replicamos a definição (não importamos para evitar puxar todo o App.tsx
// e seus 80+ lazy imports e providers). A lógica é IDÊNTICA — se mudar lá,
// este teste deve ser atualizado em par.
function RouteSuspense({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return <Suspense fallback={getFallback(pathname)}>{children}</Suspense>;
}

function NavigationProbe({
  onReady,
}: {
  onReady: (n: ReturnType<typeof useNavigate>) => void;
}) {
  const nav = useNavigate();
  React.useEffect(() => { onReady(nav); }, [nav, onReady]);
  return null;
}

// Rotas representativas — cobre cada heurística do `getFallback`.
const ROUTE_FIXTURES = [
  { path: "/produtos", label: "produtos" },
  { path: "/produto/abc-123", label: "produto-detalhe" },
  { path: "/orcamentos", label: "orcamentos" },
  { path: "/admin/usuarios", label: "admin-usuarios" },
  { path: "/dashboard", label: "dashboard" },
  { path: "/pedidos", label: "pedidos" },
  { path: "/montar-kit", label: "montar-kit" },
  { path: "/perfil", label: "perfil" },
  { path: "/", label: "home" },
  { path: "/qualquer-coisa-nova", label: "fallback-generico" },
] as const;

function buildHarness() {
  // Um lazy controlado por rota — assim podemos manter todas pendentes ou
  // resolver seletivamente para simular um "load" e re-renderizar.
  const lazies = new Map<string, ControlledLazy>();
  for (const { path, label } of ROUTE_FIXTURES) {
    lazies.set(path, createControlledLazy(label));
  }

  function App({
    initial,
    onNavReady,
  }: {
    initial: string;
    onNavReady?: (n: ReturnType<typeof useNavigate>) => void;
  }) {
    return (
      <MemoryRouter initialEntries={[initial]}>
        {onNavReady && <NavigationProbe onReady={onNavReady} />}
        <RouteSuspense>
          <Routes>
            {ROUTE_FIXTURES.map(({ path }) => {
              const Page = lazies.get(path)!.Component;
              return <Route key={path} path={path} element={<Page />} />;
            })}
          </Routes>
        </RouteSuspense>
      </MemoryRouter>
    );
  }

  return { App, lazies };
}

// ---------- Testes ----------------------------------------------------------

describe("Skeletons exibidos durante navegação lazy — sem ref warning", () => {
  let guard: ReturnType<typeof installReactWarningGuard>;

  beforeEach(() => {
    guard = installReactWarningGuard();
  });

  afterEach(() => {
    guard.dispose();
    cleanup();
    vi.useRealTimers();
  });

  it("deep-link em cada rota mostra o skeleton fallback sem warning", () => {
    for (const { path } of ROUTE_FIXTURES) {
      const { App } = buildHarness();
      const { unmount, container } = render(<App initial={path} />);
      // O lazy nunca resolve aqui — garante que o que está em tela é o
      // skeleton (não a página). Sanity check: deve haver pelo menos um
      // elemento com aria-hidden/data-* típico de skeleton (verificamos
      // genericamente via presença de qualquer div/svg renderizado).
      // Critério forte: nenhum testid de página apareceu.
      const anyPageMounted = ROUTE_FIXTURES.some(({ label }) =>
        screen.queryByTestId(`page-${label}`),
      );
      if (anyPageMounted) {
        unmount();
        throw new Error(
          `Esperava ver apenas o skeleton em ${path}, mas uma página foi montada.`,
        );
      }
      // Sanity: o container não está vazio (skeleton renderizou algo).
      if (container.childElementCount === 0) {
        unmount();
        throw new Error(`Skeleton de ${path} não renderizou nada.`);
      }
      guard.expectNoRefWarning(`deep-link skeleton em ${path}`);
      unmount();
    }
  });

  it("navegação sequencial entre rotas — cada transição mostra skeleton sem warning", async () => {
    const { App, lazies } = buildHarness();
    let navigate!: ReturnType<typeof useNavigate>;
    render(
      <App
        initial="/"
        onNavReady={(n) => { navigate = n; }}
      />,
    );
    await act(async () => {});

    // Trail intencional: alterna entre famílias diferentes de skeleton
    // (catalog, produto-detalhe, admin, dashboard, orçamentos, pedidos,
    // kit, perfil, genérico, home) para exercitar todas as branches do
    // `getFallback`.
    const trail = [
      "/produtos",
      "/produto/abc-123",
      "/admin/usuarios",
      "/dashboard",
      "/orcamentos",
      "/pedidos",
      "/montar-kit",
      "/perfil",
      "/qualquer-coisa-nova",
      "/",
    ];

    for (const path of trail) {
      await act(async () => { navigate(path); });
      // Confirma que o lazy daquela rota AINDA não resolveu — o que
      // está em tela é o skeleton.
      if (lazies.get(path)?.resolved) {
        throw new Error(`Lazy de ${path} foi resolvido inesperadamente.`);
      }
      guard.expectNoRefWarning(`após navegar para ${path}`);
    }
  });

  it("transição skeleton → página real (lazy resolve) — sem warning durante o swap", async () => {
    // Cobre o momento exato em que o Suspense substitui o skeleton pela
    // página carregada — historicamente, momento sensível para warnings
    // de ref se a árvore tinha um function component sob asChild/motion.
    const { App, lazies } = buildHarness();
    let navigate!: ReturnType<typeof useNavigate>;
    render(<App initial="/" onNavReady={(n) => { navigate = n; }} />);
    await act(async () => {});

    const path = "/produtos";
    await act(async () => { navigate(path); });
    // Skeleton em tela.
    guard.expectNoRefWarning(`pré-resolve em ${path}`);

    // Resolve o lazy → React troca skeleton por <page-produtos />.
    await act(async () => {
      lazies.get(path)!.resolve();
    });
    screen.getByTestId("page-produtos");
    guard.expectNoRefWarning(`pós-resolve em ${path}`);
  });

  it("re-entrada na mesma rota após resolve não dispara warning", async () => {
    // Simula usuário voltando a uma rota já carregada (cache do lazy):
    // não deve haver skeleton (sem suspensão), e a árvore continua limpa.
    const { App, lazies } = buildHarness();
    let navigate!: ReturnType<typeof useNavigate>;
    render(<App initial="/" onNavReady={(n) => { navigate = n; }} />);
    await act(async () => {});

    await act(async () => { navigate("/dashboard"); });
    await act(async () => { lazies.get("/dashboard")!.resolve(); });
    screen.getByTestId("page-dashboard");

    await act(async () => { navigate("/produtos"); });
    // Pendente novamente (lazy diferente).
    await act(async () => { lazies.get("/produtos")!.resolve(); });
    screen.getByTestId("page-produtos");

    await act(async () => { navigate("/dashboard"); });
    // Já carregada — sem skeleton, montagem direta.
    screen.getByTestId("page-dashboard");

    guard.expectNoRefWarning("ciclo dashboard → produtos → dashboard");
  });
});
