/**
 * MagazineTemplatesGalleryPage — /magazine/templates
 *
 * Vitrine dos 12 templates de revista. Cada card renderiza o template REAL
 * com produtos mock, permitindo ao usuário conhecer o visual antes de aplicar.
 *
 * Se `?returnTo=/magazine/:id` estiver na URL, "Usar este template" navega
 * de volta com `?applyTemplate=<id>` — o editor aplica o template automaticamente.
 */

import { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, LayoutTemplate } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PageSEO } from '@/components/seo/PageSEO';
import { cn } from '@/lib/utils';
import {
  TEMPLATE_REGISTRY,
  listTemplates,
  type TemplateEntry,
} from '../components/templates/TemplateRegistry';
import type { MagazineTemplateFamily } from '@/types/magazine';
import { TemplateCard } from './TemplateCard';
import { TemplatePreviewDialog } from './TemplatePreviewDialog';
import { parseReturnTo } from './safeReturn';
import { useFavoriteTemplate } from './useFavoriteTemplate';

type FamilyFilter = 'all' | MagazineTemplateFamily;

const FAMILY_TABS: Array<{ id: FamilyFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'editorial', label: 'Editorial' },
  { id: 'catalog', label: 'Catálogo' },
  { id: 'corporate', label: 'Corporativo' },
];

function isValidTemplateId(id: string): id is TemplateEntry['id'] {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_REGISTRY, id);
}

export default function MagazineTemplatesGalleryPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const parsedReturn = useMemo(() => parseReturnTo(params.get('returnTo')), [params]);
  const isFromEditor = parsedReturn !== null;

  const [family, setFamily] = useState<FamilyFilter>('all');
  const [previewId, setPreviewId] = useState<TemplateEntry['id'] | null>(null);
  const { favoriteId, toggleFavorite } = useFavoriteTemplate();

  const templates = useMemo(() => {
    const all = listTemplates();
    const filtered = family === 'all' ? all : all.filter((t) => t.family === family);
    if (!favoriteId) return filtered;
    // favorito primeiro (se estiver no filtro atual), demais preservam ordem
    const fav = filtered.find((t) => t.id === favoriteId);
    if (!fav) return filtered;
    return [fav, ...filtered.filter((t) => t.id !== favoriteId)];
  }, [family, favoriteId]);

  const previewEntry = useMemo(
    () => (previewId ? listTemplates().find((t) => t.id === previewId) ?? null : null),
    [previewId],
  );

  const useLabel = isFromEditor ? 'Usar este template' : 'Criar revista';

  const handleUse = useCallback(
    (id: TemplateEntry['id']) => {
      if (!isValidTemplateId(id)) {
        toast.error('Template inválido. Escolha outro da galeria.');
        return;
      }
      if (parsedReturn) {
        navigate(`${parsedReturn.path}?applyTemplate=${encodeURIComponent(id)}`);
        return;
      }
      toast.message('Vamos criar sua revista', {
        description:
          'Abra o Magazine e crie uma nova revista — este template estará disponível na etapa "Design".',
      });
      navigate('/magazine');
    },
    [navigate, parsedReturn],
  );

  const handlePreview = useCallback((id: TemplateEntry['id']) => setPreviewId(id), []);

  return (
    <>
      <PageSEO
        title="Templates de Revista — Promo Brindes"
        description="Conheça os 12 templates de revista disponíveis: editorial, catálogo e corporativo. Preview real de cada design antes de aplicar."
        path="/magazine/templates"
      />

      <div className="mx-auto w-full max-w-[1920px] animate-fade-in px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-3">
              <LayoutTemplate className="h-8 w-8 text-primary" aria-hidden />
            </div>
            <div>
              <h1
                data-testid="page-title-magazine-templates"
                className="font-display text-3xl font-bold tracking-tight"
              >
                Templates de Revista
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Explore os 12 designs disponíveis com preview real. Escolha o que
                melhor conta a história da sua marca.
              </p>
            </div>
          </div>

          <Button variant="outline" asChild>
            <Link to={isFromEditor && returnTo ? returnTo : '/magazine'}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
              {isFromEditor ? 'Voltar ao editor' : 'Voltar para revistas'}
            </Link>
          </Button>
        </header>

        {/* Filtros por família */}
        <div
          className="mb-6 inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1"
          role="tablist"
          aria-label="Filtrar templates por família"
        >
          {FAMILY_TABS.map((tab) => {
            const active = family === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                onClick={() => setFamily(tab.id)}
                className={cn(
                  'rounded-md px-4 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                data-testid={`template-family-${tab.id}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Grid de cards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {templates.map((entry) => (
            <TemplateCard
              key={entry.id}
              entry={entry}
              onPreview={(id) => setPreviewId(id)}
              onUse={handleUse}
              useLabel={useLabel}
            />
          ))}
        </div>

        {templates.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
            Nenhum template nesta categoria.
          </div>
        )}
      </div>

      <TemplatePreviewDialog
        entry={previewEntry}
        onOpenChange={(o) => !o && setPreviewId(null)}
        onUse={(id) => {
          setPreviewId(null);
          handleUse(id);
        }}
        useLabel={useLabel}
      />
    </>
  );
}
