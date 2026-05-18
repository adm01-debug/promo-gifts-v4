# Padrão de Estrutura de Páginas

SSOT para toda nova página (ou refactor) em `src/pages/**`. Garante consistência
de layout, SEO, acessibilidade e testes E2E.

## Checklist obrigatório

Use este checklist em todo PR que crie ou altere uma página:

- [ ] **Sem `<MainLayout>` no arquivo da página.** O layout é aplicado uma única
      vez como *layout route* em `src/routes/AppRoutes.tsx`. Páginas internas
      nunca importam nem renderizam `MainLayout` (evita sidebar duplicado).
- [ ] **`<PageSEO>` no topo do retorno** com `title`, `description` e `path`
      preenchidos (ver `src/components/seo/PageSEO.tsx`). Para conteúdo privado,
      manter `description` curta (<160 chars) mesmo assim — alimenta o `<title>`.
- [ ] **Container padrão** envolvendo o conteúdo:
      `w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4`.
      Páginas full-bleed (mapas, editores) podem omitir `max-w-[1920px]` mas
      precisam justificar no PR.
- [ ] **`animate-fade-in`** no container raiz para entrada suave.
- [ ] **Exatamente um `<h1>`** com `data-testid="page-title-<slug>"` e classe
      `font-display`. O `<slug>` segue `PageSlug` em `e2e/fixtures/selectors.ts`.
- [ ] **Retorno como Fragment (`<>…</>`)** quando `<PageSEO>` e o container são
      irmãos (caso comum).
- [ ] **Lazy load** registrado em `src/routes/lazy-pages.ts` via
      `lazyWithRetry(() => import(...))`.
- [ ] **Sem chamadas diretas a `MainLayout`, `Sidebar`, `AppShell`** dentro da
      página.
- [ ] **Tokens semânticos** (`bg-background`, `text-foreground`, `border-border`,
      `var(--primary)`) — nunca cores hardcoded.

## Template canônico

```tsx
import { PageSEO } from "@/components/seo/PageSEO";

export default function MinhaPagina() {
  return (
    <>
      <PageSEO
        title="Minha Página"
        description="Descrição curta para SEO/título do navegador."
        path="/minha-pagina"
      />
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-4 animate-fade-in">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <h1
            data-testid="page-title-minha-pagina"
            className="font-display text-xl sm:text-2xl lg:text-3xl font-bold"
          >
            Minha Página
          </h1>
          {/* ações da página (botões, filtros rápidos) */}
        </header>

        {/* conteúdo */}
      </div>
    </>
  );
}
```

## Onde o `MainLayout` mora

Único ponto de uso (não duplicar):

```tsx
// src/routes/AppRoutes.tsx
<Route element={<MainLayout />}>
  {/* rotas protegidas */}
</Route>
```

## Páginas relacionadas a filtros (status)

| Página                       | MainLayout | PageSEO | h1 + testid | Container 1920 |
|------------------------------|:----------:|:-------:|:-----------:|:--------------:|
| `FiltersPage`                | ✅         | ✅      | ✅          | ➖ (layout próprio com sidebar interno) |
| `ProductMatchPage`           | ✅         | ✅      | ✅          | ✅ (após refactor) |
| `AdvancedPriceSearchPage`    | ✅         | ✅      | ✅          | ✅             |
| `NoveltiesPage`              | ✅         | ✅      | ✅          | ✅             |
| `ReplenishmentsPage`         | ✅         | ✅      | ✅ (após refactor) | ✅      |

## Testes recomendados

- E2E (`e2e/flows/20-all-features-smoke.spec.ts`): valida `page-title-<slug>`.
- Unit: `src/pages/__tests__/FiltersPage.no-duplicate-sidebar.test.tsx` mostra o
  padrão de teste que protege contra `MainLayout` duplicado.
