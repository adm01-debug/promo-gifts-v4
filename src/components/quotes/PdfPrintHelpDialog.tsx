/**
 * PdfPrintHelpDialog — Fallback guiado quando a impressão direta falha
 *
 * Substitui os toasts opacos anteriores por um modal com:
 *  - Ícone e título contextual (por reason)
 *  - Passo a passo curto (Ctrl+P / ⌘+P)
 *  - Ação primária destacada: Baixar PDF
 *  - Ações secundárias: Tentar novamente, Abrir em nova aba
 *
 * Reason values (telemetria + copy):
 *  - popup-blocked   → pop-ups bloqueados no navegador
 *  - safari          → detectado Safari/WebKit (bug conhecido de print em iframe blob)
 *  - watchdog-timeout→ iframe.onload não disparou em 3s
 *  - print-exception → contentWindow.print() lançou exceção
 *  - iframe-exception→ criação do iframe falhou (CSP, DOM, etc.)
 *  - not-ready       → PDF ainda não terminou de gerar
 */

import { AlertCircle, Download, ExternalLink, Info, Printer, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type PdfPrintFallbackReason =
  'iframe-exception' | 'not-ready' | 'popup-blocked' | 'print-exception' | 'safari' | 'watchdog-timeout';

interface CopySpec {
  icon: typeof Info;
  iconTone: 'error' | 'info' | 'warn';
  title: string;
  description: string;
  steps: string[];
  showRetry: boolean;
  showOpenTab: boolean;
}

// Detecta plataforma sem depender de navigator.platform (deprecated).
// Usado apenas para copy — nunca para lógica de negócio.
const isMacLike = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /mac|iphone|ipad|ipod/i.test(ua);
};

const shortcut = (): string => (isMacLike() ? '⌘+P' : 'Ctrl+P');

const COPY: Record<PdfPrintFallbackReason, (sc: string) => CopySpec> = {
  'popup-blocked': (sc) => ({
    icon: AlertCircle,
    iconTone: 'error',
    title: 'Pop-ups bloqueados',
    description:
      'O navegador bloqueou a janela de impressão. Recomendamos baixar o PDF — é a forma mais confiável.',
    steps: [
      'Clique em "Baixar PDF" abaixo (opção recomendada).',
      `Ou libere pop-ups para este site e clique em "Tentar novamente".`,
      `Após abrir, use ${sc} para imprimir.`,
    ],
    showRetry: true,
    showOpenTab: false,
  }),
  safari: (sc) => ({
    icon: Info,
    iconTone: 'info',
    title: 'Imprimir no Safari',
    description:
      'O Safari precisa abrir o PDF em nova aba para imprimir corretamente. Ou baixe direto — funciona em qualquer navegador.',
    steps: [
      'Clique em "Baixar PDF" (mais rápido).',
      `Ou abra em nova aba e use ${sc} para imprimir.`,
    ],
    showRetry: false,
    showOpenTab: true,
  }),
  'watchdog-timeout': (sc) => ({
    icon: AlertCircle,
    iconTone: 'warn',
    title: 'Impressão não iniciou',
    description:
      'O visualizador de PDF demorou demais para responder. Baixar o arquivo é a forma mais segura.',
    steps: [
      'Clique em "Baixar PDF" abaixo.',
      `Abra o arquivo e use ${sc} para imprimir.`,
      'Se preferir, tente novamente ou abra em nova aba.',
    ],
    showRetry: true,
    showOpenTab: true,
  }),
  'print-exception': (sc) => ({
    icon: AlertCircle,
    iconTone: 'warn',
    title: 'Erro ao imprimir',
    description:
      'Seu navegador não permitiu abrir o diálogo de impressão. Baixe o PDF e imprima pelo leitor do sistema.',
    steps: [
      'Clique em "Baixar PDF".',
      `Abra o arquivo baixado e use ${sc}.`,
    ],
    showRetry: true,
    showOpenTab: true,
  }),
  'iframe-exception': () => ({
    icon: AlertCircle,
    iconTone: 'error',
    title: 'Impressão indisponível',
    description:
      'Não foi possível preparar a impressão neste navegador. Baixe o PDF — funciona sempre.',
    steps: ['Clique em "Baixar PDF" abaixo.'],
    showRetry: false,
    showOpenTab: false,
  }),
  'not-ready': () => ({
    icon: Info,
    iconTone: 'info',
    title: 'PDF ainda não está pronto',
    description: 'Aguarde a geração terminar antes de imprimir.',
    steps: ['A barra de progresso mostra o status da geração.'],
    showRetry: false,
    showOpenTab: false,
  }),
};

interface Props {
  open: boolean;
  reason: PdfPrintFallbackReason | null;
  onOpenChange: (open: boolean) => void;
  onDownload: () => void;
  onRetry: () => void;
  onOpenInNewTab: () => void;
}

export function PdfPrintHelpDialog({
  open,
  reason,
  onOpenChange,
  onDownload,
  onRetry,
  onOpenInNewTab,
}: Props) {
  if (!reason) return null;
  const spec = COPY[reason](shortcut());
  const Icon = spec.icon;
  const toneClasses = {
    error: 'bg-destructive/10 text-destructive',
    warn: 'bg-warning/10 text-warning',
    info: 'bg-primary/10 text-primary',
  }[spec.iconTone];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        data-testid="pdf-print-help-dialog"
        data-reason={reason}
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                toneClasses,
              )}
              aria-hidden="true"
            >
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base">{spec.title}</DialogTitle>
              <DialogDescription className="mt-1 text-sm">
                {spec.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Passo-a-passo numerado */}
        <ol
          className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm"
          data-testid="pdf-print-help-steps"
        >
          {spec.steps.map((step, i) => (
            <li key={i} className="flex gap-2.5">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground"
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <span className="text-foreground">{step}</span>
            </li>
          ))}
        </ol>

        <DialogFooter className="gap-2 sm:justify-between">
          {/* Ações secundárias à esquerda */}
          <div className="flex flex-wrap gap-2">
            {spec.showRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                data-testid="pdf-print-retry"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Tentar novamente
              </Button>
            )}
            {spec.showOpenTab && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenInNewTab}
                data-testid="pdf-print-open-tab"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                Abrir em nova aba
              </Button>
            )}
          </div>
          {/* Ação primária destacada */}
          {reason !== 'not-ready' && (
            <Button
              size="sm"
              onClick={onDownload}
              data-testid="pdf-print-download-primary"
              className="gap-1.5"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Baixar PDF
            </Button>
          )}
          {reason === 'not-ready' && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              data-testid="pdf-print-help-close"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Entendi
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
