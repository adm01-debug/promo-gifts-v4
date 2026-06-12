import { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { PageSEO } from '@/components/seo/PageSEO';
import { NoveltyStatsCards } from '@/components/novelties/NoveltyStatsCards';
import { NoveltyProductGrid } from '@/components/novelties/NoveltyProductGrid';
import { ExpiringNoveltiesWidget } from '@/components/novelties/ExpiringNoveltiesWidget';

export default function NoveltiesPage() {
  const stickyRef = useRef<HTMLDivElement | null>(null);

  // Mede a altura do bloco sticky (header + KPIs) e expõe via CSS var
  // para que a toolbar do grid possa se ancorar logo abaixo dele.
  useEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    const update = () => {
      const h = el.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--novelty-sticky-h', `${Math.round(h)}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
      document.documentElement.style.removeProperty('--novelty-sticky-h');
    };
  }, []);

  return (
    <>
      <PageSEO
        title="Novidades"
        description="Confira os produtos mais recentes adicionados ao catálogo de brindes promocionais."
        path="/novidades"
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-4 px-4 py-4 pb-24 lg:px-6 xl:px-8">
        {/* Topo fixo da página — cabeçalho + KPIs juntos (mesmo padrão do Super Filtro) */}
        <div
          ref={stickyRef}
          className="sticky top-[calc(var(--header-h,56px)+var(--breadcrumb-h,0px))] z-30 -mx-4 space-y-3 border-b border-border/40 bg-background/95 px-4 pb-3 pt-2 backdrop-blur-md lg:-mx-6 lg:px-6 xl:-mx-8 xl:px-8"
        >
          {/* Cabeçalho oculto — mantém h1 para SEO/E2E sem ocupar espaço visual */}
          <h1 data-testid="page-title-novidades" className="sr-only">
            Novidades
          </h1>


          {/* KPIs focados em chegadas */}
          <NoveltyStatsCards />
        </div>

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
