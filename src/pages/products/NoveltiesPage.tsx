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
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        {/* Cabeçalho da página */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1
              data-testid="page-title-novidades"
              className="font-display text-2xl font-bold tracking-tight"
            >
              Novidades
            </h1>
            <p className="text-sm text-muted-foreground">
              Produtos recém-chegados ao catálogo nos últimos 30 dias
            </p>
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
