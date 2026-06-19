/**
 * VideoShareWhatsAppDialog — Envio do vídeo do produto via WhatsApp.
 *
 * Fluxo (sales-first):
 *  1. Vendedor escolhe cliente (CRM via ShareContactSelector) OU digita número.
 *  2. Mensagem pré-formatada com pitch de vendas + link do vídeo + dados do produto
 *     (edição inline opcional).
 *  3. Clica "Abrir WhatsApp" → wa.me/<telefone>?text=<mensagem-encoded>.
 *
 * Mantém o player como dumb component: aceita só os dados, monta a mensagem aqui.
 */
import { useEffect, useMemo, useState } from 'react';
import { MessageCircle, Send, Phone, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/ui';
import { cn } from '@/lib/utils';
import { ShareContactSelector, type ShareContactSelection } from '../share/ShareContactSelector';
import { openWhatsAppShare } from '../share/whatsapp';
import { formatCurrency } from '@/lib/format';

interface VideoShareWhatsAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nome do produto (obrigatório p/ montar mensagem) */
  productName: string;
  /** Título do vídeo (ex.: "Garrafa Térmica em uso") */
  videoTitle?: string | null;
  /** Link público do vídeo / página do produto que o cliente vai abrir */
  shareUrl?: string | null;
  /** Preço (a partir de) */
  productPrice?: number | null;
  /** SKU para referência interna na mensagem */
  productSku?: string | null;
  /** Quantidade mínima do pedido */
  productMinQuantity?: number | null;
}

function buildSalesMessage(opts: {
  contactFirstName?: string;
  companyName?: string;
  productName: string;
  videoTitle?: string | null;
  shareUrl?: string | null;
  productPrice?: number | null;
  productSku?: string | null;
  productMinQuantity?: number | null;
}): string {
  const greetingTarget = opts.contactFirstName?.trim() || opts.companyName?.trim() || 'tudo bem?';
  const greeting = opts.contactFirstName?.trim()
    ? `Olá, ${opts.contactFirstName.trim()}! 👋`
    : opts.companyName?.trim()
      ? `Olá, equipe ${opts.companyName.trim()}! 👋`
      : `Olá! 👋`;

  const lines: string[] = [];
  lines.push(greeting);
  lines.push('');
  lines.push(`Separei um vídeo rápido desse brinde que tem tudo a ver com o que vocês buscam:`);
  lines.push('');
  lines.push(`🎁 *${opts.productName}*`);
  if (opts.videoTitle && opts.videoTitle !== opts.productName) {
    lines.push(`🎥 ${opts.videoTitle}`);
  }
  if (typeof opts.productPrice === 'number' && opts.productPrice > 0) {
    lines.push(`💰 A partir de ${formatCurrency(opts.productPrice)} /un.`);
  }
  if (opts.productMinQuantity && opts.productMinQuantity > 1) {
    lines.push(`📦 Pedido mínimo: ${opts.productMinQuantity} un.`);
  }
  if (opts.productSku) {
    lines.push(`🔖 Ref: ${opts.productSku}`);
  }
  if (opts.shareUrl) {
    lines.push('');
    lines.push(`▶️ Ver vídeo: ${opts.shareUrl}`);
  }
  lines.push('');
  lines.push(
    'Posso preparar uma proposta personalizada com personalização da sua marca? É só me chamar por aqui. 😉',
  );

  // greetingTarget kept for potential future personalization
  void greetingTarget;
  return lines.join('\n');
}

const MANUAL_PHONE_PLACEHOLDER = '(11) 91234-5678';

export function VideoShareWhatsAppDialog({
  open,
  onOpenChange,
  productName,
  videoTitle,
  shareUrl,
  productPrice,
  productSku,
  productMinQuantity,
}: VideoShareWhatsAppDialogProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<'crm' | 'manual'>('crm');
  const [selection, setSelection] = useState<ShareContactSelection | null>(null);
  const [manualPhone, setManualPhone] = useState('');
  const [message, setMessage] = useState('');
  const [edited, setEdited] = useState(false);

  // Compute the default message based on current selection / props.
  const defaultMessage = useMemo(() => {
    const firstName = selection?.contactName?.split(' ')[0];

    // Sanitize shareUrl to remove tracking or auth bypass params
    let sanitizedShareUrl = shareUrl;
    if (sanitizedShareUrl) {
      try {
        const url = new URL(sanitizedShareUrl);
        url.searchParams.delete('bypass_auth');
        url.searchParams.delete('utm_source');
        url.searchParams.delete('utm_medium');
        url.searchParams.delete('utm_campaign');
        sanitizedShareUrl = url.toString();
      } catch {
        // Keep as is if not a valid URL
      }
    }

    return buildSalesMessage({
      contactFirstName: firstName,
      companyName: selection?.companyName,
      productName,
      videoTitle,
      shareUrl: sanitizedShareUrl,
      productPrice,
      productSku,
      productMinQuantity,
    });
  }, [selection, productName, videoTitle, shareUrl, productPrice, productSku, productMinQuantity]);

  // Keep message in sync with selection unless the user manually edited it.
  useEffect(() => {
    if (!edited) setMessage(defaultMessage);
  }, [defaultMessage, edited]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelection(null);
      setManualPhone('');
      setEdited(false);
      setTab('crm');
    }
  }, [open]);

  const phoneFromCrm = selection?.contactPhone?.trim() ?? '';
  const phoneToSend = tab === 'crm' ? phoneFromCrm : manualPhone.trim();
  const canSend = message.trim() !== '';

  const handleSend = () => {
    if (!canSend) {
      toast({
        title: 'Mensagem vazia',
        description: 'Escreva uma mensagem antes de enviar.',
        variant: 'destructive',
      });
      return;
    }
    const { opened } = openWhatsAppShare({
      message,
      phone: phoneToSend || undefined,
    });
    if (opened) {
      toast({
        title: 'WhatsApp aberto',
        description: phoneToSend
          ? 'A conversa do cliente foi aberta com a mensagem pronta.'
          : 'Escolha o contato no WhatsApp e envie a mensagem.',
      });
      onOpenChange(false);
    } else {
      toast({
        title: 'Não foi possível abrir o WhatsApp',
        description: 'Verifique se o navegador permite popups ou copie a mensagem manualmente.',
        variant: 'destructive',
      });
    }
  };

  const handleResetMessage = () => {
    setMessage(defaultMessage);
    setEdited(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="border-b border-border/40 px-5 pb-3 pt-5">
          <DialogTitle className="flex items-center gap-2 font-display text-base">
            <MessageCircle className="h-5 w-5 text-primary" />
            Enviar vídeo pelo WhatsApp
          </DialogTitle>
          <DialogDescription className="text-xs">
            Escolha o cliente e envie o vídeo já com pitch de vendas pronto.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(92vh-180px)] overflow-y-auto px-5 py-4">
          {/* Destinatário */}
          <div className="mb-4">
            <Label className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Para quem enviar
            </Label>
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="grid h-9 w-full grid-cols-2">
                <TabsTrigger value="crm" className="gap-1.5 text-xs">
                  Cliente do CRM
                </TabsTrigger>
                <TabsTrigger value="manual" className="gap-1.5 text-xs">
                  <Phone className="h-3.5 w-3.5" />
                  Número manual
                </TabsTrigger>
              </TabsList>

              <TabsContent value="crm" className="mt-3">
                <ShareContactSelector selection={selection} onSelect={(s) => setSelection(s)} />
                {selection && !phoneFromCrm && (
                  <p className="mt-2 text-[11px] text-warning">
                    Esse contato não tem telefone cadastrado. O WhatsApp abrirá sem destinatário —
                    escolha outro contato ou use a aba "Número manual".
                  </p>
                )}
              </TabsContent>

              <TabsContent value="manual" className="mt-3">
                <Input
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder={MANUAL_PHONE_PLACEHOLDER}
                  inputMode="tel"
                  className="h-9"
                />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Pode digitar com ou sem máscara. DDI 55 é adicionado automaticamente para números
                  brasileiros.
                </p>
              </TabsContent>
            </Tabs>
          </div>

          {/* Mensagem */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Mensagem
              </Label>
              {edited && (
                <button
                  type="button"
                  onClick={handleResetMessage}
                  className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" />
                  Restaurar padrão
                </button>
              )}
            </div>
            <Textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setEdited(true);
              }}
              rows={10}
              className="min-h-[220px] resize-y font-mono text-[12.5px] leading-relaxed"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              O cliente recebe o link do vídeo e abre direto no navegador.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border/40 bg-muted/20 px-5 py-3">
          <div className="text-[11px] text-muted-foreground">
            {phoneToSend ? (
              <>
                Enviando para <span className="font-mono text-foreground">{phoneToSend}</span>
              </>
            ) : (
              'Sem destinatário — você escolhe no WhatsApp'
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!canSend}
              className={cn('gap-1.5 bg-[#25D366] text-white hover:bg-[#1ebe57]')}
            >
              <Send className="h-3.5 w-3.5" />
              Abrir WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
