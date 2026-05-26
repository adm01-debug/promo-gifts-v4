import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/ui';
import { supabase } from '@/integrations/supabase/client';
import { LogOut, AlertTriangle, Loader2 } from 'lucide-react';

export function ForceGlobalLogoutDialog() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isValid = confirmText === 'FORCE_LOGOUT_ALL';

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('force-global-logout', {
        body: { confirm: 'FORCE_LOGOUT_ALL' },
      });

      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);

      const result = data as { signed_out: number; errors: number };
      toast({
        title: 'Logout global executado',
        description: `${result.signed_out} sessões revogadas${result.errors ? `, ${result.errors} falhas` : ''}.`,
      });
      setOpen(false);
      setConfirmText('');
    } catch (err) {
      toast({
        title: 'Erro ao forçar logout',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <LogOut className="mr-2 h-4 w-4" />
          Forçar logout global
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Forçar logout global
          </DialogTitle>
          <DialogDescription>
            Revoga todas as sessões ativas de todos os usuários (exceto a sua). Use apenas em
            resposta a um incidente de segurança suspeito.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive">Esta ação não pode ser desfeita.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Todos os vendedores precisarão fazer login novamente. Recomenda-se notificar a equipe
              antes.
            </p>
          </div>
          <div>
            <Label htmlFor="confirm">
              Digite <code className="rounded bg-muted px-1 text-xs">FORCE_LOGOUT_ALL</code> para
              confirmar
            </Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="FORCE_LOGOUT_ALL"
              className="mt-1.5 font-mono"
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleSubmit} disabled={!isValid || loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            Executar logout global
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
