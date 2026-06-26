/**
 * QuoteRowQuickActions — botões inline na linha do orçamento.
 * Duplicar · Compartilhar link · WhatsApp · Marcar ganho.
 * Visíveis no hover da linha (desktop) ou sempre (mobile).
 */
import type { MouseEvent as ReactMouseEvent } from 'react';
import { Copy, Share2, MessageCircle, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Quote } from '@/hooks/quotes';

interface QuoteRowQuickActionsProps {
  quote: Quote;
  onDuplicate: (id: string) => void;
  onMarkApproved: (id: string) => void;
}

const APP_BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

function buildShareUrl(quote: Quote) {
  return `${APP_BASE_URL}/orcamentos/${quote.id}`;
}

function buildWhatsappUrl(quote: Quote) {
  const link = buildShareUrl(quote);
  const name = quote.client_name || quote.client_company || 'Cliente';
  const number = quote.quote_number || '';
  const text = encodeURIComponent(
    `Olá ${name}! Segue o orçamento ${number} para sua avaliação:\n${link}`,
  );
  const phone = (quote.client_phone || '').replace(/\D/g, '');
  return phone ? `https://wa.me/55${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function QuoteRowQuickActions({
  quote,
  onDuplicate,
  onMarkApproved,
}: QuoteRowQuickActionsProps) {
  const isClosed =
    quote.status === 'approved' || quote.status === 'converted' || quote.status === 'rejected';

  const handleCopyLink = async (e: ReactMouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(buildShareUrl(quote));
      toast.success('Link copiado', { description: 'Cole onde precisar.' });
    } catch {
      toast.error('Falha ao copiar link');
    }
  };

  const handleWhatsapp = (e: ReactMouseEvent) => {
    e.stopPropagation();
    window.open(buildWhatsappUrl(quote), '_blank', 'noopener,noreferrer');
  };

  const handleDuplicate = (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (!quote.id) return;
    onDuplicate(quote.id);
  };

  const handleApprove = (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (!quote.id) return;
    onMarkApproved(quote.id);
  };

  return (
    <div
      className="flex items-center gap-0 opacity-40 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
      onClick={(e) => e.stopPropagation()}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground/50 hover:bg-muted/40 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            onClick={handleDuplicate}
            aria-label="Duplicar orçamento"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Duplicar</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground/50 hover:bg-muted/40 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            onClick={handleCopyLink}
            aria-label="Copiar link do orçamento"
          >
            <Share2 className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Copiar link</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground/50 hover:bg-muted/40 hover:text-success focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            onClick={handleWhatsapp}
            aria-label="Enviar por WhatsApp"
          >
            <MessageCircle className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Enviar por WhatsApp</TooltipContent>
      </Tooltip>

      {!isClosed && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground/50 hover:bg-muted/40 hover:text-success focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              onClick={handleApprove}
              aria-label="Marcar como ganho"
            >
              <Trophy className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Marcar como ganho</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

