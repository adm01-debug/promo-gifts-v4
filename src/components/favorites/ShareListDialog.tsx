import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Share2, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { FavoriteList } from '@/hooks/favorites';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  list: FavoriteList;
  onShare: (id: string, days: number) => Promise<FavoriteList>;
  onRevoke: (id: string) => Promise<void>;
}

export function ShareListDialog({ open, onOpenChange, list, onShare, onRevoke }: Props) {
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = list.shared_token
    ? `${window.location.origin}/lista-publica/${list.shared_token}`
    : null;

  const handleGenerate = async () => {
    setBusy(true);
    try {
      await onShare(list.id, days);
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Link copiado');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    setBusy(true);
    try {
      await onRevoke(list.id);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" /> Compartilhar lista
          </DialogTitle>
          <DialogDescription>
            Gere um link público para "{list.name}" — ideal para apresentar ao cliente.
          </DialogDescription>
        </DialogHeader>

        {shareUrl ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Link público</Label>
              <div className="flex gap-2">
                <Input value={shareUrl} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            {list.shared_expires_at && (
              <p className="text-xs text-muted-foreground">
                Expira em {new Date(list.shared_expires_at).toLocaleDateString('pt-BR')}
              </p>
            )}
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={handleRevoke}
              disabled={busy}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Revogar acesso
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="days">Validade do link (dias)</Label>
              <Input
                id="days"
                type="number"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(Math.max(1, Math.min(365, Number(e.target.value) || 30)))}
              />
            </div>
            <Button onClick={handleGenerate} className="w-full" disabled={busy}>
              {busy ? 'Gerando…' : 'Gerar link público'}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
