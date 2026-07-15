/**
 * MagazineEditorPage — /magazine/:id
 * Wizard 5 etapas + preview multi-página + validação por step + a11y.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Eye,
  Loader2,
  Save,
  Share2,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { PageSEO } from '@/components/seo/PageSEO';
import { cn } from '@/lib/utils';
import { useMagazineEditor } from './useMagazineEditor';
import { paginateMagazine } from './pagination';
import { PreviewSidebar } from './components/PreviewSidebar';
import { EditorHero } from './components/EditorHero';
import { IdentityStep } from './components/steps/IdentityStep';
import { ProductsStep } from './components/steps/ProductsStep';
import { ContentStep } from './components/steps/ContentStep';
import { DesignStep } from './components/steps/DesignStep';
import { LayoutStep } from './components/steps/LayoutStep';
import {
  canPublish,
  validateStep,
  type StepId,
  type StepValidation,
} from './utils/stepValidation';
import './magazine.css';

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'identity', label: 'Identidade' },
  { id: 'products', label: 'Produtos' },
  { id: 'content', label: 'Conteúdo' },
  { id: 'design', label: 'Design' },
  { id: 'layout', label: 'Layout & Gerar' },
];

/**
 * Validação neutra enquanto a revista ainda não hidratou.
 * Constante de módulo → referência estável, não gera re-render.
 */
const EMPTY_VALIDATION: StepValidation = { blocks: [], warnings: [] };

export default function MagazineEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState<StepId>('identity');
  const [previewIdx, setPreviewIdx] = useState(0);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const [previewSheetOpen, setPreviewSheetOpen] = useState(false);
  const editor = useMagazineEditor(id);

  // `magazine` é null enquanto carrega e quando o id não existe.
  const magazine = editor.magazine;

  // ───────────────────────────────────────────────────────────────────────
  // CORREÇÃO CRÍTICA — React error #310
  // ("Rendered more hooks than during the previous render")
  //
  // Antes: os dois useMemo abaixo ficavam DEPOIS dos early returns
  // (`if (!editor.loaded) return …` e `if (!editor.magazine) return …`).
  //
  //   Render 1 (loaded = false) → early return  → N hooks executados
  //   Render 2 (loaded = true)  → segue o corpo → N + 2 hooks executados
  //
  // React compara a ordem/contagem de hooks entre renders → crash em 100%
  // dos mounts da página, capturado por MagazineErrorBoundary/ProtectedRoute.
  //
  // Agora: TODOS os hooks rodam incondicionalmente, no topo. `paginateMagazine`
  // já aceita null e `validateStep` recebe fallback neutro. Os early returns
  // ficam ABAIXO de todos os hooks.
  //
  // Guard-rail permanente: `react-hooks/rules-of-hooks` já é 'error' no
  // eslint.config.js — qualquer regressão desse tipo reprova no CI.
  // ───────────────────────────────────────────────────────────────────────

  // Atalhos globais leves — Cmd/Ctrl+S salva imediato (autosave já roda)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd && e.key === 's') {
        e.preventDefault();
        toast('Alterações salvas automaticamente.');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Deps enxutas: a referência de `items` já cobre mudança de contagem
  // (magazineService sempre devolve array novo); templateId/title são escalares;
  // content.groupByCategory cobre o agrupamento por categoria.
  const pages = useMemo(
    () => paginateMagazine(magazine),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      magazine?.items,
      magazine?.templateId,
      magazine?.title,
      magazine?.content?.groupByCategory,
    ],
  );

  // Deps espelham os campos realmente lidos por validateStep:
  // identity → title + branding.clientLogoUrl | products/design/layout → items.length
  const validation = useMemo(
    () => (magazine ? validateStep(step, magazine) : EMPTY_VALIDATION),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      step,
      magazine?.title,
      magazine?.items?.length,
      magazine?.branding?.clientLogoUrl,
    ],
  );

  // Onda 1 — hover em produto no LayoutStep → salta preview p/ página que o contém.
  useEffect(() => {
    if (!highlightedItemId) return;
    const idx = pages.findIndex((p) => p.items.some((it) => it.id === highlightedItemId));
    if (idx >= 0) setPreviewIdx(idx);
  }, [highlightedItemId, pages]);



  // ── A PARTIR DAQUI NENHUM HOOK PODE SER CHAMADO ────────────────────────
  if (!editor.loaded) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground" role="status">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando revista…
      </div>
    );
  }
  if (!magazine) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="mb-2 text-xl font-semibold">Revista não encontrada</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Ela pode ter sido excluída ou não pertence a este usuário.
        </p>
        <Button onClick={() => navigate('/magazine')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
      </div>
    );
  }

  const safePreviewIdx = Math.min(previewIdx, Math.max(0, pages.length - 1));

  const currentIdx = STEPS.findIndex((s) => s.id === step);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx < STEPS.length - 1;

  const publishable = canPublish(magazine);

  const goToStep = (target: StepId) => {
    // Se pular para Design/Layout sem produtos, avisa mas permite (soft-block)
    const targetIdx = STEPS.findIndex((s) => s.id === target);
    if (targetIdx > currentIdx) {
      const blocking = validation.blocks;
      if (blocking.length > 0) {
        toast.warning(blocking[0]);
      }
    }
    setStep(target);
  };

  const publish = async () => {
    if (!publishable) {
      toast.error('Complete título e adicione produtos antes de publicar.');
      return;
    }
    const updated = await editor.publish();
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

      <div className="mx-auto w-full max-w-[1920px] animate-fade-in px-4 pb-4 pt-2 sm:px-6 lg:px-8">
       <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start xl:gap-6">
        <div className="min-w-0" data-testid="magazine-editor-main-col">
        {/* Hero premium — miniatura real da capa + template ativo + swap inline */}
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start" data-testid="magazine-editor-hero-row">
          <div className="min-w-0 flex-1">
            <EditorHero magazine={magazine} onChangeTemplate={editor.setTemplate} />
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end lg:pt-7">
            <span
              role="status"
              aria-live="polite"
              className="flex items-center text-xs text-muted-foreground"
            >
              {editor.saving ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Salvando…
                </>
              ) : (
                <>
                  <Save className="mr-1 h-3 w-3" /> Salvo
                </>
              )}
            </span>
            {/* Onda 1 — Preview drawer para telas < xl (aside some) */}
            <Sheet open={previewSheetOpen} onOpenChange={setPreviewSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="xl:hidden">
                  <Eye className="mr-2 h-4 w-4" /> Preview
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="flex h-full w-[min(560px,100vw)] max-w-full flex-col gap-0 p-4 sm:max-w-none"
              >
                <SheetHeader className="mb-3 shrink-0">
                  <SheetTitle className="text-sm">Preview da revista</SheetTitle>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <PreviewSidebar
                    magazine={magazine}
                    pages={pages}
                    activeIdx={safePreviewIdx}
                    onSelect={setPreviewIdx}
                    onOpenAll={openPrint}
                    highlightedItemId={highlightedItemId}
                    variant="drawer"
                  />
                </div>
              </SheetContent>
            </Sheet>
            <Button
              variant="outline"
              size="sm"
              onClick={openPrint}
              disabled={(magazine.items ?? []).length === 0}
            >
              <Download className="mr-2 h-4 w-4" /> PDF
            </Button>
            <Button size="sm" onClick={publish} disabled={!publishable}>
              <Share2 className="mr-2 h-4 w-4" /> Publicar
            </Button>
          </div>
        </div>

        {/* Stepper com barra de progresso */}
        <nav
          aria-label="Etapas do editor"
          className="mb-6 overflow-hidden rounded-lg border bg-card"
        >
          <div
            className="h-1 bg-primary transition-all"
            style={{ width: `${((currentIdx + 1) / STEPS.length) * 100}%` }}
            aria-hidden
          />
          <ol className="flex items-center gap-1 overflow-x-auto p-2">
            {STEPS.map((s, idx) => {
              const active = s.id === step;
              const done = idx < currentIdx;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => goToStep(s.id)}
                    aria-current={active ? 'step' : undefined}
                    aria-label={`Etapa ${idx + 1} de ${STEPS.length}: ${s.label}${done ? ' (concluída)' : active ? ' (atual)' : ''}`}
                    className={cn(
                      'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : done
                          ? 'text-foreground hover:bg-muted'
                          : 'text-muted-foreground hover:bg-muted',
                    )}
                    data-testid={`magazine-step-${s.id}`}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                        active ? 'bg-primary-foreground text-primary' : 'border',
                      )}
                      aria-hidden
                    >
                      {done ? <Check className="h-3 w-3" /> : idx + 1}
                    </span>
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* aria-live para anunciar mudança de etapa a leitores de tela */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          Etapa {currentIdx + 1} de {STEPS.length}: {STEPS[currentIdx].label}
        </div>

        {/* Alertas suaves de validação */}
        {(validation.blocks.length > 0 || validation.warnings.length > 0) && (
          <div
            className={cn(
              'mb-4 flex items-start gap-3 rounded-md border px-3 py-2 text-sm',
              validation.blocks.length > 0
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200'
                : 'border-muted bg-muted/40 text-muted-foreground',
            )}
            role="status"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <ul className="space-y-0.5">
              {validation.blocks.map((b) => (
                <li key={b}>{b}</li>
              ))}
              {validation.warnings.map((w) => (
                <li key={w} className="opacity-80">{w}</li>
              ))}
            </ul>
          </div>
        )}

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
          {step === 'design' && (
            <DesignStep
              magazine={magazine}
              onChange={editor.setTemplate}
              onCategoryChange={(category) => editor.setBranding({ category })}
            />
          )}
          {step === 'layout' && (
            <LayoutStep
              magazine={magazine}
              onReorder={editor.reorderItems}
              onRemove={editor.removeItem}
              onItemHover={setHighlightedItemId}
              highlightedItemId={highlightedItemId}
            />
          )}

          <div className="mt-6 flex items-center justify-between">
            <Button
              variant="outline"
              disabled={!canPrev}
              onClick={() => goToStep(STEPS[Math.max(0, currentIdx - 1)].id)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Button>
            {canNext ? (
              <Button
                onClick={() =>
                  goToStep(STEPS[Math.min(STEPS.length - 1, currentIdx + 1)].id)
                }
              >
                Avançar <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={publish} disabled={!publishable}>
                <Share2 className="mr-2 h-4 w-4" /> Publicar revista
              </Button>
            )}
          </div>
        </div>
        </div>

        <aside className="hidden xl:block xl:self-start" data-testid="magazine-preview-aside">
          <PreviewSidebar
            magazine={magazine}
            pages={pages}
            activeIdx={safePreviewIdx}
            onSelect={setPreviewIdx}
            onOpenAll={openPrint}
            highlightedItemId={highlightedItemId}
          />
        </aside>
       </div>
      </div>
    </>
  );
}
