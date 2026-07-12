/**
 * MagazineEditorPage — /magazine/:id
 * Wizard 5 etapas + preview sticky da capa/primeira página + ações finais.
 */

import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Eye,
  Loader2,
  Save,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageSEO } from '@/components/seo/PageSEO';
import { useMagazineEditor } from './useMagazineEditor';
import { paginateMagazine } from './pagination';
import { MagazinePageRenderer } from './components/MagazinePageRenderer';
import { IdentityStep } from './components/steps/IdentityStep';
import { ProductsStep } from './components/steps/ProductsStep';
import { ContentStep } from './components/steps/ContentStep';
import { DesignStep } from './components/steps/DesignStep';
import { LayoutStep } from './components/steps/LayoutStep';
import './magazine.css';

const STEPS = [
  { id: 'identity', label: 'Identidade' },
  { id: 'products', label: 'Produtos' },
  { id: 'content', label: 'Conteúdo' },
  { id: 'design', label: 'Design' },
  { id: 'layout', label: 'Layout & Gerar' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

export default function MagazineEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState<StepId>('identity');
  const editor = useMagazineEditor(id);

  if (!editor.loaded) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando revista…
      </div>
    );
  }
  if (!editor.magazine) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h2 className="mb-2 text-xl font-semibold">Revista não encontrada</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Ela pode ter sido excluída ou não pertence a este usuário.
        </p>
        <Button onClick={() => navigate('/magazine')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>
    );
  }

  const magazine = editor.magazine;
  const pages = paginateMagazine(magazine);
  const previewPage = pages[0];

  const currentIdx = STEPS.findIndex((s) => s.id === step);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx < STEPS.length - 1;

  const publish = () => {
    const updated = editor.publish();
    if (updated?.publicToken) {
      const url = `${window.location.origin}/revista-publica/${updated.publicToken}`;
      navigator.clipboard.writeText(url).catch(() => undefined);
      toast.success('Revista publicada. Link copiado para a área de transferência.');
    }
  };

  const openPrint = () => window.open(`/magazine/${magazine.id}/print`, '_blank');

  return (
    <>
      <PageSEO
        title={`${magazine.title} — Magazine`}
        description="Editor de revistas de produtos personalizadas."
        path={`/magazine/${magazine.id}`}
      />

      <div className="mx-auto w-full max-w-[1920px] animate-fade-in px-4 py-4 sm:px-6 lg:px-8">
        <h1 data-testid="page-title-magazine-editor" className="sr-only">
          Editor de Magazine
        </h1>

        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/magazine" className="text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="inline h-4 w-4" /> Magazines
            </Link>
            <span className="text-muted-foreground/60">/</span>
            <span className="line-clamp-1 text-sm font-medium">{magazine.title}</span>
          </div>
          <div className="flex items-center gap-2">
            {editor.saving ? (
              <span className="flex items-center text-xs text-muted-foreground">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Salvando…
              </span>
            ) : (
              <span className="flex items-center text-xs text-muted-foreground">
                <Save className="mr-1 h-3 w-3" /> Salvo
              </span>
            )}
            <Button variant="outline" size="sm" onClick={openPrint} disabled={magazine.items.length === 0}>
              <Download className="mr-2 h-4 w-4" /> PDF
            </Button>
            <Button size="sm" onClick={publish} disabled={magazine.items.length === 0}>
              <Share2 className="mr-2 h-4 w-4" /> Publicar
            </Button>
          </div>
        </div>

        {/* Stepper */}
        <div className="mb-6 flex items-center gap-2 overflow-x-auto rounded-lg border bg-card p-2">
          {STEPS.map((s, idx) => {
            const active = s.id === step;
            const done = idx < currentIdx;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : done
                      ? 'text-foreground hover:bg-muted'
                      : 'text-muted-foreground hover:bg-muted'
                }`}
                data-testid={`magazine-step-${s.id}`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    active ? 'bg-primary-foreground text-primary' : 'border'
                  }`}
                >
                  {done ? <Check className="h-3 w-3" /> : idx + 1}
                </span>
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div>
            {step === 'identity' && (
              <IdentityStep
                magazine={magazine}
                onTitle={editor.setTitle}
                onSubtitle={editor.setSubtitle}
                onBranding={editor.setBranding}
              />
            )}
            {step === 'products' && (
              <ProductsStep
                magazine={magazine}
                onAdd={editor.addProducts}
                onRemove={editor.removeItem}
                onUpdateItem={editor.updateItem}
              />
            )}
            {step === 'content' && <ContentStep magazine={magazine} onChange={editor.setContent} />}
            {step === 'design' && <DesignStep magazine={magazine} onChange={editor.setTemplate} />}
            {step === 'layout' && (
              <LayoutStep
                magazine={magazine}
                onReorder={editor.reorderItems}
                onRemove={editor.removeItem}
              />
            )}

            <div className="mt-6 flex items-center justify-between">
              <Button
                variant="outline"
                disabled={!canPrev}
                onClick={() => setStep(STEPS[Math.max(0, currentIdx - 1)].id)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Button>
              {canNext ? (
                <Button onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, currentIdx + 1)].id)}>
                  Avançar <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={publish} disabled={magazine.items.length === 0}>
                  <Share2 className="mr-2 h-4 w-4" /> Publicar revista
                </Button>
              )}
            </div>
          </div>

          <aside className="hidden xl:block">
            <Card className="sticky top-4">
              <CardContent className="space-y-3 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Preview — Capa
                  </span>
                  <Button variant="ghost" size="sm" onClick={openPrint}>
                    <Eye className="mr-1 h-3.5 w-3.5" /> Ver todas
                  </Button>
                </div>
                {previewPage ? (
                  <MagazinePageRenderer magazine={magazine} page={previewPage} totalPages={pages.length} fitContainer />
                ) : (
                  <div className="rounded-lg border p-8 text-center text-xs text-muted-foreground">
                    Adicione produtos para gerar o preview.
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {pages.length} página(s) · {magazine.items.length} produto(s)
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </>
  );
}
