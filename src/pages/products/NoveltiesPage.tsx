import { Sparkles } from 'lucide-react';
import { PageSEO } from '@/components/seo/PageSEO';
import { NoveltyStatsCards } from '@/components/novelties/NoveltyStatsCards';
import { NoveltyProductGrid } from '@/components/novelties/NoveltyProductGrid';
import { ExpiringNoveltiesWidget } from '@/components/novelties/ExpiringNoveltiesWidget';

export default function NoveltiesPage() {
  return (
    <>
      <PageSEO
        title="Novidades"
        description="Confira os produtos mais recentes adicionados ao catálogo de brindes promocionais."
        path="/novidades"
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-4 px-4 py-4 pb-24 lg:px-6 xl:px-8">
        {/* Cabeçalho da página */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h1
                data-testid="page-title-novidades"
                className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              >
                Novidades
              </h1>
              <p 
                data-testid="novelty-description"
                className="mt-1 text-sm font-medium text-muted-foreground sm:text-base"
              >
                Produtos recém-chegados ao catálogo nos últimos 30 dias
              </p>
            </div>
          </div>
        </div>

        {/* KPIs focados em chegadas */}
        <NoveltyStatsCards />

        {/* Layout principal — grid ocupa mais espaço */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 xl:grid-cols-[1fr_280px]">
          {/* Grid de produtos */}
          <div className="order-2 min-w-0 xl:order-1">
            <NoveltyProductGrid />
          </div>

          {/* Widget sidebar — compacto */}
          <div className="order-1 xl:sticky xl:top-4 xl:order-2 xl:self-start">
            <ExpiringNoveltiesWidget />
          </div>
        </div>
      </div>
    </>
  );
}
