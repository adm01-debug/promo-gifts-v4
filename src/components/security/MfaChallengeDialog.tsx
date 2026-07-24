/**
 * MfaChallengeDialog — pede código TOTP para elevar sessão para AAL2.
 * Usado no AdminRoute quando admin/manager já tem MFA mas a sessão atual está em aal1.
 */
import { useEffect, useRef, useState } from 'react';
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
  const [verified, setVerified] = useState(false);
  // Trava sincrona contra double-submit: o state (loading) atualiza de forma assincrona,
  // entao Enter repetido durante a requisicao poderia disparar verify() de novo (challenge+verify
  // duplicados -> 422). O ref e setado no mesmo tick e e a fonte de verdade do gate.
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setCode('');
      setFactorId(null);
      setVerified(false);
      inFlightRef.current = false;
      return;
    }
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      const verifiedFactor = data?.totp?.find((f) => f.status === 'verified');
      setFactorId(verifiedFactor?.id ?? null);
    })();
  }, [open]);

  async function verify() {
    // Gate idempotente: bloqueia codigo invalido, requisicao em andamento e pos-sucesso.
    if (!factorId || code.length !== 6 || inFlightRef.current || verified) return;
    inFlightRef.current = true;
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
      setVerified(true); // trava a UI; inFlightRef permanece travado ate o dialog fechar
      await refreshAAL();
      toast.success('Acesso administrativo liberado');
    } catch {
      inFlightRef.current = false; // libera para nova tentativa
      toast.error('Código inválido', {
        description: 'Tente novamente',
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
            disabled={loading || verified}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && code.length === 6 && !loading && !verified) verify();
            }}
          />
          <div className="flex justify-between">
            <Button variant="ghost" onClick={handleSignOut}>
              Sair
            </Button>
            <Button onClick={verify} disabled={loading || verified || code.length !== 6}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verificar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
