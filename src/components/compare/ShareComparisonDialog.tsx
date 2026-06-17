/**
 * ShareComparisonDialog — Gera link público para a comparação atual.
 * Cria registro em user_comparisons com share_token + is_public + expiração.
 */
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, Check, Share2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { CompareItem } from '@/stores/useComparisonStore';

import { logger } from '@/lib/logger';
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  compareItems: CompareItem[];
  clientId?: string | null;
  clientName?: string | null;
}

export function ShareComparisonDialog({
  open,
  onOpenChange,
  compareItems,
  clientId,
  clientName,
}: Props) {
  const [generating, setGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState('30');

  const generateLink = async () => {
    setGenerating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('Faça login para compartilhar');
        return;
      }
      const days = parseInt(expiresIn, 10);
      const expiresAt = new Date(Date.now() + days * 86400000).toISOString();

      const { data, error } = await supabase
        .from('user_comparisons')
        .insert({
          user_id: userData.user.id,
          client_id: clientId ?? null,
          client_name: clientName ?? null,
          items: structuredClone(compareItems),
          is_public: true,
          share_expires_at: expiresAt,
        })
        .select('id, share_token')
        .single();

      if (error || !data) {
        toast.error('Falha ao gerar link público');
        return;
      }
      const url = `${window.location.origin}/comparar-publica/${data.share_token}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link público gerado e copiado!');
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      logger.error('Failed to generate share link', e);
      toast.error('Erro ao gerar link');
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />
            Compartilhar Comparação
          </DialogTitle>
          <DialogDescription>
            Gere um link público para enviar essa comparação ao seu cliente. Ele poderá visualizar e
            reagir aos produtos sem precisar de conta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Validade do link</Label>
            <Select value={expiresIn} onValueChange={setExpiresIn} disabled={!!shareUrl}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="15">15 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="60">60 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {shareUrl ? (
            <div className="space-y-2">
              <Label>Link público</Label>
              <div className="flex gap-2">
                <Input readOnly value={shareUrl} className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={copyLink}>
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {clientName && (
                <p className="text-xs text-muted-foreground">
                  Curadoria vinculada a <strong>{clientName}</strong>
                </p>
              )}
            </div>
          ) : (
            <Button onClick={generateLink} disabled={generating} className="w-full">
              {generating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="mr-2 h-4 w-4" />
              )}
              Gerar link público
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
