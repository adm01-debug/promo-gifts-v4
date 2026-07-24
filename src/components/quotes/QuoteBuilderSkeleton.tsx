/**
 * QuoteBuilderSkeleton — placeholder com a MESMA geometria do Novo Orçamento
 * (3 colunas: 3/5/4) usado enquanto `useQuoteBuilderState.loadingQuote` é true.
 *
 * Objetivo: zerar CLS no primeiro paint — o último CTA renderiza na mesma
 * posição Y do estado carregado, evitando "pulo" durante a hidratação.
 */
import { Skeleton } from '@/components/ui/skeleton';

export function QuoteBuilderSkeleton() {
  return (
    <div
      data-testid="quote-builder-skeleton"
      aria-busy="true"
      aria-label="Carregando Novo Orçamento"
      className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 sm:space-y-4 sm:px-4 sm:pb-24 sm:pt-4 lg:px-6 lg:pb-28 xl:px-8"
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>

      {/* Stepper */}
      <Skeleton className="h-16 w-full rounded-xl" />

      {/* 3-column layout (mesma proporção do estado carregado) */}
      <div data-testid="quote-builder-skeleton-grid" className="grid min-w-0 gap-4 lg:grid-cols-12">
        {/* COL 1 — Cliente + Condições */}
        <div className="space-y-3 lg:col-span-3">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </div>

        {/* COL 2 — Itens */}
        <div className="lg:col-span-5">
          <Skeleton className="h-[460px] w-full rounded-2xl" />
        </div>

        {/* COL 3 — Resumo */}
        <div className="min-w-0 lg:col-span-4">
          <div className="space-y-3 lg:sticky lg:top-[calc(var(--header-h,56px)+var(--breadcrumb-h,40px)+1rem)] lg:h-[calc(100vh-var(--header-h,56px)-var(--breadcrumb-h,40px)-2rem)] lg:self-start lg:overflow-hidden">
            <Skeleton className="h-[320px] w-full rounded-2xl" />
            <div className="sticky bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-10 space-y-3 rounded-2xl border border-border/50 bg-card/95 p-4 shadow-[0_-16px_24px_-24px_hsl(var(--foreground)/0.55)] backdrop-blur supports-[backdrop-filter]:bg-card/85">
              <Skeleton className="h-16 w-full rounded-2xl" />
              {/* CTA final — mesma altura/posição do botão "Criar/Salvar Rascunho" */}
              <Skeleton
                data-testid="quote-builder-skeleton-cta"
                className="h-11 w-full rounded-md"
              />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
