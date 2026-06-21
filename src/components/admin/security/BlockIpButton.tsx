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
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/ui';
import { supabase } from '@/integrations/supabase/client';
import { Ban, Loader2 } from 'lucide-react';

interface BlockIpButtonProps {
  defaultIp?: string;
  defaultReason?: string;
  size?: 'default' | 'sm';
  variant?: 'destructive' | 'ghost' | 'outline';
  onBlocked?: () => void;
}

export function BlockIpButton({
  defaultIp = '',
  defaultReason = '',
  size = 'sm',
  variant = 'outline',
  onBlocked,
}: BlockIpButtonProps) {
  const [open, setOpen] = useState(false);
  const [ip, setIp] = useState(defaultIp);
  const [reason, setReason] = useState(defaultReason);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const submit = async () => {
    if (!ip.trim()) {
      toast({ title: 'IP obrigatório', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('block-ip-temporarily', {
        body: { ip: ip.trim(), reason: reason.trim() || undefined, hours },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast({
        title: 'IP bloqueado',
        description: `${ip} bloqueado por ${hours}h`,
      });
      setOpen(false);
      onBlocked?.();
    } catch {
      toast({
        title: 'Erro ao bloquear',
        description: 'Não foi possível bloquear o IP.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setIp(defaultIp);
          setReason(defaultReason);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size={size} variant={variant} className="gap-1.5">
          <Ban className="h-3.5 w-3.5" /> Bloquear IP
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bloquear IP temporariamente</DialogTitle>
          <DialogDescription>
            Adiciona o IP à blocklist com expiração automática. Auditoria completa registrada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="block-ip">IP (IPv4, IPv6 ou CIDR)</Label>
            <Input
              id="block-ip"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="192.168.1.1"
              maxLength={45}
            />
          </div>
          <div>
            <Label htmlFor="block-hours">Duração (horas, 1-720)</Label>
            <Input
              id="block-hours"
              type="number"
              min={1}
              max={720}
              value={hours}
              onChange={(e) => setHours(Math.max(1, Math.min(720, Number(e.target.value) || 24)))}
            />
          </div>
          <div>
            <Label htmlFor="block-reason">Motivo (opcional, máx 500 chars)</Label>
            <Textarea
              id="block-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Ex: brute-force em /login (12 falhas em 5min)"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={submit} disabled={loading}>
            {loading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Confirmar bloqueio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
