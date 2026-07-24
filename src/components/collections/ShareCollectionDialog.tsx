/**
 * ShareCollectionDialog — Generates public share token for a collection.
 * Espelha o fluxo de favoritos.
 */
import { useState } from 'react';
import { Copy, Link2, RefreshCw, Loader2, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useCollectionsContext } from '@/contexts/CollectionsContext';
import { toErrorMessage } from '@/lib/to-error-message';

interface Props {
  open: boolean;
  onClose: () => void;
  collectionId: string;
  collectionName: string;
  shareToken?: string | null;
  shareExpiresAt?: string | null;
  isPublic?: boolean;
}

export function ShareCollectionDialog({
  open,
  onClose,
  collectionId,
  collectionName,
  shareToken,
  shareExpiresAt,
  isPublic,
}: Props) {
  const { updateCollection } = useCollectionsContext();
  const [busy, setBusy] = useState(false);

  const publicUrl = shareToken ? `${window.location.origin}/colecao-publica/${shareToken}` : null;

  const generateToken = async () => {
    setBusy(true);
    try {
      const expires = new Date();
      expires.setDate(expires.getDate() + 30);
      const { data, error } = await supabase
        .from('collections')
        .update({
          share_token: crypto.randomUUID(),
          share_expires_at: expires.toISOString(),
          is_public: true,
        })
        .eq('id', collectionId)
        .select('share_token, share_expires_at, is_public')
        .single();
      if (error) throw error;
      updateCollection(collectionId, {
        shareToken: data.share_token,
        shareExpiresAt: data.share_expires_at,
        isPublic: true,
      });
      const url = `${window.location.origin}/colecao-publica/${data.share_token}`;
      await navigator.clipboard.writeText(url);
      toast.success('Link público gerado e copiado!');
    } catch (e) {
      toast.error(`Erro ao gerar link: ${toErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const revokeToken = async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from('collections')
        .update({ share_token: null, share_expires_at: null, is_public: false })
        .eq('id', collectionId);
      if (error) throw error;
      updateCollection(collectionId, {
        shareToken: null,
        shareExpiresAt: null,
        isPublic: false,
      });
      toast.success('Link público revogado');
    } catch (e) {
      toast.error(`Erro ao revogar: ${toErrorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success('Link copiado!');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Compartilhar coleção
          </DialogTitle>
          <DialogDescription>
            Gere um link público (válido por 30 dias) para "{collectionName}". Qualquer pessoa com o
            link poderá visualizar e reagir aos produtos.
          </DialogDescription>
        </DialogHeader>

        {publicUrl && isPublic ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input value={publicUrl} readOnly className="text-xs" />
              <Button variant="outline" size="icon" onClick={copyUrl} aria-label="Copiar link">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {shareExpiresAt && (
              <p className="text-xs text-muted-foreground">
                Expira em{' '}
                {new Date(shareExpiresAt).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={generateToken}
                disabled={busy}
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Renovar
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2 text-destructive hover:text-destructive"
                onClick={revokeToken}
                disabled={busy}
              >
                <ShieldOff className="h-4 w-4" />
                Revogar
              </Button>
            </div>
          </div>
        ) : (
          <Button onClick={generateToken} disabled={busy} className="w-full gap-2">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Gerar link público
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
