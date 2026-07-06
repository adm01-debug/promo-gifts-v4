/**
 * PdfGenerationDialog — Modal com preview, progresso e ações pós-geração
 *
 * Fluxo: Preview → Gerar com barra de progresso → Action sheet (Download, Imprimir, Regenerar)
 *
 * FIXES (2026-05):
 *  Bug #2 — Memory leak: blobUrlRef revogado ao fechar
 *  Bug #4 — Dialog não fecha durante geração → sem operação assíncrona zumbi
 *  Bug #5 — progressLabel e pdfVersion resetados ao fechar
 *  Bug #8 — Props deprecadas marcadas
 *  Bug #9 — ActionButton variante 'whatsapp' (código morto) removida
 */

import { useState, useCallback, useRef } from 'react';
import { Download, FileText, Check, Printer, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';


import { cn } from '@/lib/utils';
import { type ProposalTemplateData } from '@/components/pdf/ProposalHtmlTemplate';
import { PropostaComercialTailwind } from '@/components/pdf/PropostaComercialTailwind';
import { generateProposalPDFv2, downloadPDF } from '@/utils/proposalPdfReactGenerator';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';

const PREVIEW_SCROLL_STYLE = { maxHeight: 'calc(90vh - 160px)' } as const;
type Stage = 'generating' | 'preview' | 'ready';

interface PdfGenerationDialogProps {
  proposalData: ProposalTemplateData | null;
  quoteNumber?: string;
  quoteStatus?: string;
  trigger?: React.ReactNode;
}

const PROGRESS_STEPS = [
  { label: 'Montando layout', pct: 30 },
  { label: 'Renderizando páginas', pct: 70 },
  { label: 'Finalizando PDF', pct: 100 },
];

export function PdfGenerationDialog({
  proposalData,
  quoteNumber,
  quoteStatus,
  trigger,
}: PdfGenerationDialogProps) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>('preview');
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfVersion, setPdfVersion] = useState(1);
  const blobUrlRef = useRef<string | null>(null);

  const isDraft = quoteStatus === 'draft';

  /** FIX #2: Revogar blob URL e limpar ref — evita memory leak acumulativo */
  const revokeBlobUrl = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!proposalData) return;

    setStage('generating');
    setProgress(0);
    setProgressLabel(PROGRESS_STEPS[0].label);

    try {
      // Step 1: Montando layout
      setProgress(10);
      await new Promise((r) => {
        setTimeout(r, 300);
      });
      setProgress(PROGRESS_STEPS[0].pct);
      setProgressLabel(PROGRESS_STEPS[1].label);

      // Step 2: Renderizando
      await new Promise((r) => {
        setTimeout(r, 200);
      });
      setProgress(50);

      // CRÍTICO: propagar isDraft para que a marca d'água RASCUNHO
      // seja renderizada em cada página do PDF. Sem isso o rascunho sai
      // idêntico a uma proposta final → risco operacional grave.
      const blob = await generateProposalPDFv2(proposalData, { isDraft });

      // Step 3: Finalizando
      setProgress(PROGRESS_STEPS[1].pct);
      setProgressLabel(PROGRESS_STEPS[2].label);
      await new Promise((r) => {
        setTimeout(r, 300);
      });
      setProgress(100);

      // FIX #2: Revogar blob URL anterior antes de criar novo
      revokeBlobUrl();

      setPdfBlob(blob);
      blobUrlRef.current = URL.createObjectURL(blob);
      setStage('ready');
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      logger.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF. Tente novamente.');
      setStage('preview');
      setProgressLabel(''); // FIX #5: resetar label — evita valor antigo ao reabrir
    }
  }, [proposalData]);

  const handleDownload = () => {
    if (!pdfBlob) return;
    downloadPDF(pdfBlob, `proposta-${quoteNumber || 'sem-numero'}-v${pdfVersion}.pdf`);
    setPdfVersion((v) => v + 1);
  };

  const handlePrint = () => {
    const url = blobUrlRef.current;
    if (!url) {
      toast.error('PDF ainda não está pronto. Aguarde a geração terminar.');
      return;
    }

    // Padrão robusto: iframe oculto → contentWindow.print()
    // O evento `load` em window.open(blobUrl) NÃO dispara de forma confiável
    // para o visualizador nativo de PDF (Chrome/Firefox usam plugin externo).
    try {
      // Remove qualquer iframe anterior para evitar vazamento
      const existing = document.getElementById('pdf-print-frame');
      if (existing) existing.remove();

      const iframe = document.createElement('iframe');
      iframe.id = 'pdf-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.setAttribute('aria-hidden', 'true');

      let printed = false;
      const triggerPrint = () => {
        if (printed) return;
        printed = true;
        try {
          const cw = iframe.contentWindow;
          if (!cw) throw new Error('contentWindow indisponível');
          cw.focus();
          cw.print();
        } catch (err) {
          console.error('[PdfGenerationDialog] print via iframe falhou', err);
          // Fallback: abrir em nova aba para o usuário imprimir manualmente
          const win = window.open(url, '_blank', 'noopener,noreferrer');
          if (!win) {
            toast.error('Ative pop-ups para imprimir, ou use Baixar e imprima o arquivo.');
          } else {
            toast.info('Use Ctrl/Cmd+P na nova aba para imprimir.');
          }
        }
      };

      iframe.onload = () => {
        // Pequeno delay: alguns engines precisam de tick após load do PDF
        setTimeout(triggerPrint, 250);
      };
      // Fallback: se onload nunca disparar (raro em Safari com blob PDF), força após 2s
      setTimeout(triggerPrint, 2000);

      document.body.appendChild(iframe);
      iframe.src = url;
    } catch (err) {
      console.error('[PdfGenerationDialog] handlePrint erro', err);
      toast.error('Não foi possível iniciar a impressão. Use Baixar como alternativa.');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    // FIX #4: Impedir fechamento durante geração — evita operação assíncrona zumbi
    if (stage === 'generating') return;

    setOpen(newOpen);
    if (!newOpen) {
      // FIX #5 + FIX #2: Reset COMPLETO ao fechar
      setStage('preview');
      setProgress(0);
      setProgressLabel(''); // FIX #5
      setPdfBlob(null);
      setPdfVersion(1); // FIX #5: versão volta para 1
      revokeBlobUrl(); // FIX #2
    }
  };

  if (!proposalData) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <FileText className="h-4 w-4" />
            Gerar Proposta
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className={cn(
          'flex flex-col gap-0 p-0 transition-[max-width] duration-300',
          stage === 'generating' || stage === 'ready'
            ? 'max-h-none max-w-sm border-white/10 bg-card shadow-[0_20px_50px_hsl(var(--background)/0.7)]'
            : 'max-h-[90vh] max-w-4xl',
        )}
        // FIX #4: Bloquear interações fora do dialog durante geração
        onInteractOutside={(e) => {
          if (stage === 'generating') e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (stage === 'generating') e.preventDefault();
        }}
      >
        {/* Header — oculto nos stages compactos (generating/ready) */}
        {stage !== 'generating' && stage !== 'ready' && (
          <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="flex min-w-0 items-center gap-3">
              <DialogTitle className="truncate text-lg font-bold">
                Proposta Comercial {quoteNumber}
              </DialogTitle>
              {isDraft && (
                <Badge
                  variant="secondary"
                  className="shrink-0 border-warning/30 bg-warning/10 text-xs text-warning"
                >
                  Rascunho
                </Badge>
              )}
              {pdfVersion > 1 && (
                <Badge variant="outline" className="shrink-0 text-xs">
                  v{pdfVersion}
                </Badge>
              )}
            </div>
            {stage === 'preview' && (
              <>
                <style>{`
                  @keyframes pdfWarnShimmer {
                    0% { transform: translateX(-120%); }
                    60% { transform: translateX(220%); }
                    100% { transform: translateX(220%); }
                  }
                  @keyframes pdfWarnGlow {
                    0%, 100% { box-shadow: 0 0 0 0 hsl(var(--warning) / 0.0), 0 0 12px 0 hsl(var(--warning) / 0.25); }
                    50% { box-shadow: 0 0 0 3px hsl(var(--warning) / 0.12), 0 0 22px 2px hsl(var(--warning) / 0.45); }
                  }
                  .pdf-warn-pill { animation: pdfWarnGlow 2.4s ease-in-out infinite; }
                  .pdf-warn-shimmer {
                    position: absolute; inset: 0; overflow: hidden; border-radius: 9999px; pointer-events: none;
                  }
                  .pdf-warn-shimmer::before {
                    content: ""; position: absolute; top: 0; bottom: 0; width: 40%;
                    background: linear-gradient(90deg, transparent, hsl(var(--warning) / 0.55), transparent);
                    animation: pdfWarnShimmer 2.8s ease-in-out infinite;
                    mix-blend-mode: overlay;
                  }
                  @media (prefers-reduced-motion: reduce) {
                    .pdf-warn-pill { animation: none; }
                    .pdf-warn-shimmer::before { animation: none; opacity: 0; }
                  }
                `}</style>
                <div
                  role="status"
                  aria-live="polite"
                  aria-label="Aviso: confira as informações antes de enviar"
                  className="pdf-warn-pill relative hidden shrink-0 items-center gap-2 overflow-hidden rounded-full border border-warning/50 bg-warning/10 px-3.5 py-1.5 text-warning sm:inline-flex"
                >
                  <span className="pdf-warn-shimmer" aria-hidden="true" />
                  <Info className="relative h-3.5 w-3.5 shrink-0 drop-shadow-[0_0_6px_hsl(var(--warning)/0.7)]" strokeWidth={2.25} aria-hidden="true" />
                  <p className="relative text-xs font-medium tracking-wide">
                    <span className="hidden md:inline">Confira as informações antes de enviar</span>
                    <span className="md:hidden">Confira antes de enviar</span>
                  </p>
                </div>
              </>
            )}
          </div>
        </DialogHeader>
        )}



        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {stage === 'preview' && (
            <div className="flex h-full flex-col">
              {/* Preview area — scrollable */}
              <div className="flex-1 overflow-auto bg-muted/30 p-4" style={PREVIEW_SCROLL_STYLE}>
                <div className="mx-auto" style={{ maxWidth: '794px' }}>
                  <div className="relative overflow-hidden rounded-lg bg-white shadow-lg">
                    {/* Watermark de rascunho é renderizado por PropostaComercialTailwind
                        (uma vez por página, no meio). Não duplicar aqui. */}
                    <PropostaComercialTailwind data={proposalData} isDraft={isDraft} />
                  </div>
                </div>
              </div>

              {/* Actions footer */}
              <div className="flex items-center justify-end gap-3 border-t border-border bg-card px-4 py-3 sm:px-6 sm:py-4">
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="default"
                        className={cn(
                          'gap-2 text-sm min-h-11',
                          'px-5 sm:px-6 md:px-7',
                          'shadow-sm transition-all',
                          'hover:shadow-md hover:brightness-110 active:brightness-95 active:scale-[0.98]',
                          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card',
                        )}
                        onClick={handleGenerate}
                        data-testid="pdf-generate-confirm"
                        aria-label="Gerar e baixar PDF da proposta"
                      >
                        <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Gerar PDF</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="end">
                      Gera e baixa o PDF final da proposta
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

            </div>
          )}

          {stage === 'generating' && (
            /* v3 — Minimalista denso: card compacto ~50% menor, anel duplo,
               barra fina com glow, 3 micro-steps (LAYOUT / PÁGINAS / PDF) e
               aviso discreto com ícone. Respeita prefers-reduced-motion. */
            <div
              className="flex flex-col items-center gap-6 p-8 text-center animate-fade-in"
              role="status"
              aria-live="polite"
              aria-label={`Gerando PDF — ${progressLabel}`}
            >
              {/* Spinner: anel duplo com ponto pulsante */}
              <div className="relative flex h-12 w-12 items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                <div className="absolute inset-0 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none" />
                <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))] motion-safe:animate-pulse" />
              </div>

              {/* Heading dinâmico do step atual */}
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {progressLabel}
                <span className="text-muted-foreground">…</span>
              </h2>

              {/* Progress + micro-steps */}
              <div className="w-full space-y-4">
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.6)] transition-[width] duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {PROGRESS_STEPS.map((step, i) => {
                    const active = progress >= step.pct;
                    const shortLabel =
                      i === 0 ? 'Layout' : i === 1 ? 'Páginas' : 'PDF';
                    const align =
                      i === 0 ? 'items-start' : i === 1 ? 'items-center' : 'items-end';
                    return (
                      <div key={step.label} className={cn('flex flex-col gap-1.5', align)}>
                        <div
                          className={cn(
                            'h-1 w-full rounded-full transition-opacity duration-300',
                            active ? 'bg-primary opacity-100' : 'bg-muted opacity-40',
                          )}
                        />
                        <span
                          className={cn(
                            'text-[10px] font-medium uppercase tracking-wider transition-colors',
                            active
                              ? i === 1
                                ? 'font-bold text-primary'
                                : 'text-primary/80'
                              : 'text-muted-foreground',
                          )}
                        >
                          {shortLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Aviso discreto — FIX #4 */}
              <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground/70">
                <Info className="h-3 w-3" aria-hidden="true" />
                Aguarde, não feche esta janela
              </p>
            </div>
          )}

          {stage === 'ready' && (
            /* v3 — Minimalista denso: mesmo vocabulário visual do stage "generating".
               Anel estático com Check, barra 100% + 3 tracks todos concluídos,
               botão primário compacto e ações ghost inline. */
            <div
              className="flex flex-col items-center gap-6 p-8 text-center animate-fade-in"
              role="status"
              aria-live="polite"
              aria-label="PDF pronto para download"
            >
              {/* Success indicator — anel duplo estático com Check e glow */}
              <div className="relative flex h-12 w-12 items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-primary/30" />
                <Check
                  className="h-6 w-6 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.6)]"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
              </div>

              {/* Título */}
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                PDF pronto
              </h2>

              {/* Progress 100% + 3 micro-steps concluídos (espelha o generating) */}
              <div className="w-full space-y-4">
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div className="absolute inset-y-0 left-0 w-full rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.6)]" />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(['Layout', 'Páginas', 'PDF'] as const).map((label, i) => {
                    const align =
                      i === 0 ? 'items-start' : i === 1 ? 'items-center' : 'items-end';
                    return (
                      <div key={label} className={cn('flex flex-col gap-1.5', align)}>
                        <div className="h-1 w-full rounded-full bg-primary" />
                        <span className="text-[10px] font-medium uppercase tracking-wider text-primary/80">
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Ação principal */}
              <Button
                size="sm"
                onClick={handleDownload}
                className="h-9 w-full gap-2 px-5 shadow-sm transition-all hover:shadow-md hover:brightness-110 active:brightness-95 active:scale-[0.98]"
                data-testid="pdf-download-button"
                aria-label="Baixar PDF gerado"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Baixar</span>
              </Button>

              {/* Ações secundárias inline */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handlePrint}
                >
                  <Printer className="h-3 w-3" aria-hidden="true" />
                  Imprimir
                </Button>
                <span aria-hidden="true" className="text-muted-foreground/40">·</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleGenerate}
                >
                  <FileText className="h-3 w-3" aria-hidden="true" />
                  Regenerar
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
