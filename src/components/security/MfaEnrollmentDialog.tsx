/**
 * MfaEnrollmentDialog — fluxo de setup TOTP em 3 passos:
 *  1. Enroll → recebe QR code
 *  2. Usuário escaneia no app autenticador (Google Authenticator, 1Password, etc.)
 *  3. Usuário insere código de 6 dígitos para verificar e ativar
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck, Smartphone } from 'lucide-react';
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

interface MfaEnrollmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando true, fechar diálogo desloga o usuário (uso em gate de admin) */
  enforce?: boolean;
}

export function MfaEnrollmentDialog({
  open,
  onOpenChange,
  enforce = false,
}: MfaEnrollmentDialogProps) {
  const { refreshAAL, signOut } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'intro' | 'qr' | 'verify'>('intro');
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep('intro');
      setFactorId(null);
      setQrCode(null);
      setSecret(null);
      setCode('');
      setLoading(false);
    }
  }, [open]);

  async function startEnroll() {
    setLoading(true);
    try {
      // Limpa fatores não-verificados anteriores para evitar erro "factor already exists".
      // O SDK tipa totp como status:"verified", mas fatores "unverified" aparecem em
      // runtime (enroll interrompido) — cast para detectá-los e limpá-los.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const stale = existing?.totp?.find((f) => (f.status as string) === 'unverified');
      if (stale) await supabase.auth.mfa.unenroll({ factorId: stale.id });

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Promo Gifts Admin · ${new Date().toLocaleDateString('pt-BR')}`,
      });
      if (error) throw error;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setStep('qr');
    } catch {
      toast.error('Falha ao iniciar MFA', {
        description: 'Não foi possível configurar o autenticador.',
      });
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode() {
    if (!factorId || code.length !== 6) return;
    setLoading(true);
    try {
      const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeErr) throw challengeErr;
      const { error: verifyErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyErr) throw verifyErr;

      toast.success('MFA ativado com sucesso!', {
        description: 'A partir de agora seu acesso administrativo está protegido.',
      });
      await refreshAAL();
      onOpenChange(false);
      navigate('/admin', { replace: true });
    } catch {
      toast.error('Código inválido', {
        description: 'O código informado não confere. Tente novamente.',
      });
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  async function handleClose(next: boolean) {
    if (!next && enforce) {
      // Sai do app — bloqueia acesso admin sem MFA
      await signOut();
      navigate('/login', { replace: true });
      return;
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Autenticação em duas etapas
          </DialogTitle>
          <DialogDescription>
            {enforce
              ? 'Por segurança, contas com acesso administrativo precisam ter MFA ativado.'
              : 'Adicione uma camada extra de proteção à sua conta.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'intro' && (
          <div className="space-y-4">
            <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
              <div className="flex items-start gap-3">
                <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div className="space-y-1 text-sm">
                  <p className="font-medium">Você vai precisar de um app autenticador</p>
                  <p className="text-muted-foreground">
                    Google Authenticator, 1Password, Authy ou similar.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {!enforce && (
                <Button variant="ghost" onClick={() => handleClose(false)}>
                  Agora não
                </Button>
              )}
              <Button onClick={startEnroll} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Começar
              </Button>
            </div>
          </div>
        )}

        {step === 'qr' && qrCode && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Escaneie o QR code no seu app autenticador:
            </p>
            <div className="flex justify-center rounded-lg border bg-white p-4">
              <img
                src={qrCode}
                alt="QR code MFA"
                className="h-48 w-48"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
            {secret && (
              <div className="text-center text-xs text-muted-foreground">
                Ou digite manualmente:{' '}
                <code className="rounded bg-muted px-2 py-0.5 font-mono">{secret}</code>
              </div>
            )}
            <Button onClick={() => setStep('verify')} className="w-full">
              Já escaneei, continuar
            </Button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Digite o código de 6 dígitos do seu app:
            </p>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
              autoFocus
              inputMode="numeric"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setStep('qr')}>
                Voltar
              </Button>
              <Button onClick={verifyCode} disabled={loading || code.length !== 6}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verificar e ativar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
