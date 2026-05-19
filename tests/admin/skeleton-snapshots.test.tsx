/**
 * Snapshots da UI dos skeletons usados como fallback de <Suspense>.
 *
 * Objetivo duplo:
 *   1. **Estabilidade visual** — qualquer alteração inesperada na estrutura
 *      DOM/classes de um skeleton quebra o snapshot e exige aprovação
 *      explícita (via `vitest -u`). Evita regressões silenciosas em layout
 *      shift, contagem de cards, alturas, etc.
 *   2. **Sem ref warning** — em paralelo, mantemos o `installReactWarningGuard`
 *      ativo durante a renderização do snapshot. Se um refactor remover o
 *      `forwardRef` do helper `makeSkeleton`, o warning aparece e o teste
 *      falha *antes* mesmo de o snapshot ser comparado.
 *
 * Como atualizar (intencionalmente):
 *   bunx vitest run tests/admin/skeleton-snapshots.test.tsx -u
 *
 * Os snapshots ficam em
 *   tests/admin/__snapshots__/skeleton-snapshots.test.tsx.snap
 * e são commitados — code review julga se a mudança é intencional.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Suspense } from "react";
import { installReactWarningGuard } from "../helpers/react-warning-guard";
import {
  CatalogSkeleton,
  ProductDetailSkeleton,
  QuotesSkeleton,
  AdminSkeleton,
  DashboardSkeleton,
  ToolsSkeleton,
  ProfileSkeleton,
  GenericSkeleton,
  getFallback,
} from "@/components/layout/SkeletonLoaders";

// SkeletonMonitor (envolvido por makeSkeleton) chama useAuth() para decidir
// se mostra o overlay de debug do tempo de skeleton. Em testes de renderização
// isolada, não temos AuthProvider — mockamos com um stub mínimo.
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ userRole: null, user: null, isLoading: false }),
}));


afterEach(() => cleanup());

const SKELETONS = [
  ["CatalogSkeleton", CatalogSkeleton],
  ["ProductDetailSkeleton", ProductDetailSkeleton],
  ["QuotesSkeleton", QuotesSkeleton],
  ["AdminSkeleton", AdminSkeleton],
  ["DashboardSkeleton", DashboardSkeleton],
  ["ToolsSkeleton", ToolsSkeleton],
  ["ProfileSkeleton", ProfileSkeleton],
  ["GenericSkeleton", GenericSkeleton],
] as const;

/**
 * Rotas representativas — mapeiam para todas as branches do `getFallback`.
 * Mantemos um snapshot por rota para detectar mudanças no roteador de
 * fallbacks (não só nos componentes em si).
 */
const ROUTE_FALLBACKS = [
  "/produtos",
  "/produto/abc-123",
  "/orcamentos",
  "/admin/usuarios",
  "/dashboard",
  "/pedidos",
  "/montar-kit",
  "/perfil",
  "/qualquer-coisa-sem-match",
] as const;

/** Suspende para sempre — força <Suspense> a renderizar o fallback. */
function SuspendForever(): never {
  throw new Promise(() => { /* never */ });
}

/**
 * Normaliza atributos não-determinísticos do output do RTL antes do snapshot:
 *   - IDs auto-gerados pelo Radix (`radix-:r1:`, `radix-:r2:` etc.)
 *   - `data-testid` injetados por libs que mudam entre runs
 *   - aria-describedby com hashes
 *
 * Mantém apenas a estrutura semântica + classes — o que de fato representa
 * a aparência do skeleton.
 */
function normalize(html: string): string {
  return html
    .replace(/radix-[a-z0-9:_-]+/gi, "radix-XXX")
    .replace(/aria-describedby="[^"]*"/g, 'aria-describedby="XXX"')
    .replace(/aria-labelledby="[^"]*"/g, 'aria-labelledby="XXX"')
    .replace(/id="[^"]*"/g, 'id="XXX"')
    // ChartSkeleton (usado em DashboardSkeleton) gera alturas das barras com
    // Math.random() — normalizamos para que o snapshot capture estrutura
    // (que o teste valida) e não os valores randômicos (que mudam por execução).
    .replace(/style="height:\s*[0-9.]+%;?"/g, 'style="height:RANDOM%"');
}

describe("Skeletons — snapshots estruturais (UI estável + sem ref warning)", () => {
  it.each(SKELETONS)("snapshot: render direto de %s", (name, Cmp) => {
    const guard = installReactWarningGuard();
    try {
      const { container } = render(<Cmp />);
      // Guard antes do snapshot: se o componente perdeu forwardRef,
      // falhamos com mensagem semântica em vez de só "snapshot mismatch".
      guard.expectNoRefWarning(`render direto de ${name}`);
      expect(normalize(container.innerHTML)).toMatchSnapshot();
    } finally {
      guard.dispose();
    }
  });

  it.each(SKELETONS)(
    "snapshot: %s como fallback de <Suspense> (caminho real)",
    (name, Cmp) => {
      const guard = installReactWarningGuard();
      try {
        const { container } = render(
          <Suspense fallback={<Cmp />}>
            <SuspendForever />
          </Suspense>,
        );
        guard.expectNoRefWarning(`<Suspense fallback={<${name} />}>`);
        expect(normalize(container.innerHTML)).toMatchSnapshot();
      } finally {
        guard.dispose();
      }
    },
  );

  it.each(ROUTE_FALLBACKS)(
    "snapshot: getFallback('%s') → skeleton apropriado",
    (path) => {
      const guard = installReactWarningGuard();
      try {
        const { container } = render(
          <Suspense fallback={getFallback(path)}>
            <SuspendForever />
          </Suspense>,
        );
        guard.expectNoRefWarning(`getFallback('${path}')`);
        expect(normalize(container.innerHTML)).toMatchSnapshot();
      } finally {
        guard.dispose();
      }
    },
  );

  it("snapshot: estrutura sumarizada de cada skeleton (forma compacta)", () => {
    // Resumo agregado: contagem de elementos por tag por skeleton. Mais
    // resiliente a microajustes de classe, mas sensível a mudanças de
    // estrutura (ex.: número de cards, presença de header/footer).
    const summary: Record<string, Record<string, number>> = {};
    for (const [name, Cmp] of SKELETONS) {
      const guard = installReactWarningGuard();
      const { container, unmount } = render(<Cmp />);
      const counts: Record<string, number> = {};
      container.querySelectorAll("*").forEach((el) => {
        const tag = el.tagName.toLowerCase();
        counts[tag] = (counts[tag] ?? 0) + 1;
      });
      summary[name] = counts;
      guard.expectNoRefWarning(`summary de ${name}`);
      guard.dispose();
      unmount();
    }
    expect(summary).toMatchSnapshot();
  });
});
