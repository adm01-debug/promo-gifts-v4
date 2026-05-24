/**
 * PdfGenerationDialog — Modal com preview, progresso e ações pós-geração
 *
 * Fluxo: Preview → Gerar com barra de progresso → Action sheet (Download, WhatsApp, Email, Copiar Link)
 */

import { useState, useCallback, useRef } from "react";
import { Download, FileText, Loader2, Check, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { type ProposalTemplateData } from "@/components/pdf/ProposalHtmlTemplate";
import { PropostaComercialTailwind } from "@/components/pdf/PropostaComercialTailwind";
import { generateProposalPDFv2, downloadPDF } from "@/utils/proposalPdfReactGenerator";
import { toast } from "sonner";

type Stage = 'preview' | 'generating' | 'ready';

interface PdfGenerationDialogProps {
  proposalData: ProposalTemplateData | null;
  quoteNumber?: string;
  quoteStatus?: string;
  clientPhone?: string;
  approvalLink?: string | null;
  onWhatsApp?: () => void;
  onShareLink?: () => void;
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
  clientPhone: _clientPhone,
  approvalLink: _approvalLink,
  onWhatsApp: _onWhatsApp,
  onShareLink: _onShareLink,
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

  const handleGenerate = useCallback(async () => {
    if (!proposalData) return;

    setStage('generating');
    setProgress(0);
    setProgressLabel(PROGRESS_STEPS[0].label);

    try {
      // Step 1: Montando layout
      setProgress(10);
      await new Promise((r) => setTimeout(r, 300));
      setProgress(PROGRESS_STEPS[0].pct);
      setProgressLabel(PROGRESS_STEPS[1].label);

      // Step 2: Renderizando
      await new Promise((r) => setTimeout(r, 200));
      setProgress(50);

      const blob = await generateProposalPDFv2(proposalData);

      // Step 3: Finalizando
      setProgress(PROGRESS_STEPS[1].pct);
      setProgressLabel(PROGRESS_STEPS[2].label);
      await new Promise((r) => setTimeout(r, 300));
      setProgress(100);

      // Cleanup old blob URL
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }

      setPdfBlob(blob);
      blobUrlRef.current = URL.createObjectURL(blob);
      setStage('ready');
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF');
      setStage('preview');
    }
  }, [proposalData]);

  const handleDownload = () => {
    if (!pdfBlob) return;
    downloadPDF(pdfBlob, `proposta-${quoteNumber || 'sem-numero'}-v${pdfVersion}.pdf`);
    setPdfVersion((v) => v + 1);
  };

  const _handleEmail = () => {
    const subject = encodeURIComponent(`Proposta Comercial ${quoteNumber || ""}`);
    const body = encodeURIComponent(
      `Olá,\n\nSegue a proposta comercial ${quoteNumber || ''}.\n\nQualquer dúvida, estou à disposição!\n\nAtt.`,
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
  };

  const handlePrint = () => {
    if (!blobUrlRef.current) return;
    const win = window.open(blobUrlRef.current, '_blank');
    if (win) {
      win.addEventListener('load', () => {
        win.print();
      });
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset state when closing
      setStage('preview');
      setProgress(0);
      setPdfBlob(null);
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
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="border-b border-border px-6 pb-4 pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-lg font-bold">
                Proposta Comercial {quoteNumber}
              </DialogTitle>
              {isDraft && (
                <Badge
                  variant="secondary"
                  className="border-warning/30 bg-warning/10 text-xs text-warning"
                >
                  Rascunho
                </Badge>
              )}
              {pdfVersion > 1 && (
                <Badge variant="outline" className="text-xs">
                  v{pdfVersion}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {stage === 'preview' && (
            <div className="flex h-full flex-col">
              {/* Preview area — scrollable */}
              <div
                className="flex-1 overflow-auto bg-muted/30 p-4"
                style={{ maxHeight: 'calc(90vh - 160px)' }}
              >
                <div className="mx-auto" style={{ maxWidth: '794px' }}>
                  <div className="relative overflow-hidden rounded-lg bg-white shadow-lg">
                    {/* Watermark for drafts */}
                    {isDraft && (
                      <div
                        className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
                        style={{ transform: 'rotate(-35deg)' }}
                      >
                        <span
                          className="select-none text-[80px] font-black uppercase tracking-[0.3em]"
                          style={{
                            color: 'rgba(200, 0, 0, 0.08)',
                            letterSpacing: '0.3em',
                          }}
                        >
                          RASCUNHO
                        </span>
                      </div>
                    )}
                    <PropostaComercialTailwind data={proposalData} isDraft={isDraft} />
                  </div>
                </div>
              </div>

              {/* Actions footer */}
              <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-6 py-4">
                <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-warning dark:text-warning">
                  <span className="text-lg">⚠️</span>
                  <p className="text-sm font-semibold">Confira as informações antes de enviar</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="lg" className="gap-2 px-8" onClick={handleGenerate}>
                    <FileText className="h-4 w-4" />
                    Gerar PDF
                  </Button>
                </div>
              </div>
            </div>
          )}

          {stage === 'generating' && (
            <div className="flex flex-col items-center justify-center gap-6 px-6 py-20">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <div className="w-full max-w-md space-y-2 text-center">
                <p className="text-lg font-semibold">{progressLabel}...</p>
                <Progress value={progress} className="h-2" />
                <div className="flex justify-between pt-1 text-xs text-muted-foreground">
                  {PROGRESS_STEPS.map((step, i) => (
                    <span
                      key={i}
                      className={cn(
                        'transition-colors',
                        progress >= step.pct ? 'font-medium text-primary' : '',
                      )}
                    >
                      {step.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {stage === 'ready' && (
            <div className="flex flex-col items-center gap-8 px-6 py-12">
              {/* Success indicator */}
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Check className="h-8 w-8 text-primary" />
                </div>
                <p className="text-lg font-semibold">PDF pronto!</p>
              </div>

              {/* Action Grid */}
              <div className="flex w-full max-w-lg justify-center">
                <ActionButton
                  icon={<Download className="h-5 w-5" />}
                  label="Baixar"
                  onClick={handleDownload}
                  variant="primary"
                />
              </div>

              <Separator className="w-full max-w-lg" />

              {/* Secondary actions */}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="gap-2" onClick={handlePrint}>
                  <Printer className="h-4 w-4" />
                  Imprimir
                </Button>
                <Button variant="ghost" size="sm" className="gap-2" onClick={handleGenerate}>
                  <FileText className="h-4 w-4" />
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

function ActionButton({
  icon,
  label,
  onClick,
  variant = 'default',
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'whatsapp';
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border p-4 transition-all duration-200',
        'hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-40',
        variant === 'primary' && 'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20',
        variant === 'whatsapp' &&
          'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20',
        variant === 'default' && 'border-border bg-card text-foreground hover:bg-accent',
      )}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
