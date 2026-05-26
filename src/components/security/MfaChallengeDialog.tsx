/**
 * MfaChallengeDialog — pede código TOTP para elevar sessão para AAL2.
 * Usado no AdminRoute quando admin/manager já tem MFA mas a sessão atual está em aal1.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface MfaChallengeDialogProps {
  open: boolean;
}

export function MfaChallengeDialog({ open }: MfaChallengeDialogProps) {
  const { refreshAAL, signOut } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setCode('');
      setFactorId(null);
      return;
    }
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = data?.totp?.find((f) => f.status === 'verified');
      setFactorId(verified?.id ?? null);
    })();
  }, [open]);

  async function verify() {
    if (!factorId || code.length !== 6) return;
    setLoading(true);
    try {
      const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (vErr) throw vErr;
      await refreshAAL();
      toast.success('Acesso administrativo liberado');
    } catch (e) {
      toast.error('Código inválido', {
        description: e instanceof Error ? e.message : 'Tente novamente',
      });
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate('/login', { replace: true });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={() => {
        /* não permite fechar sem verificar */
      }}
    >
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Verificação em duas etapas
          </DialogTitle>
          <DialogDescription>
            Para acessar a área administrativa, digite o código do seu app autenticador.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
            autoFocus
            inputMode="numeric"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && code.length === 6) verify();
            }}
          />
          <div className="flex justify-between">
            <Button variant="ghost" onClick={handleSignOut}>
              Sair
            </Button>
            <Button onClick={verify} disabled={loading || code.length !== 6}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verificar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
