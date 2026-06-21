import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck, Mail, KeyRound, Loader2 } from 'lucide-react';
import { useStepUpAuth, type StepUpAction } from '@/hooks/auth';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: StepUpAction;
  targetRef?: string | null;
  actionLabel: string;
  onVerified: (token: string) => Promise<void> | void;
}

export function StepUpAuthDialog({
  open,
  onOpenChange,
  action,
  targetRef,
  actionLabel,
  onVerified,
}: Props) {
  const { state, reset, requestChallenge, verifyPassword, verifyOtp, cancel } = useStepUpAuth();
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const verifiedRef = useState({ done: false })[0];

  useEffect(() => {
    if (open && !state.challengeId) {
      verifiedRef.done = false;
      requestChallenge({ action, targetRef, actionLabel });
    }
    if (!open) {
      // Se o modal fechou sem token emitido, registra cancelamento server-side.
      if (!verifiedRef.done) {
        void cancel('user_closed_dialog');
      }
      reset();
      setPassword('');
      setOtp('');
    }
  }, [
    open,
    action,
    targetRef,
    actionLabel,
    state.challengeId,
    requestChallenge,
    reset,
    cancel,
    verifiedRef,
  ]);

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyPassword(password);
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await verifyOtp(otp);
    if (token) {
      verifiedRef.done = true;
      await onVerified(token);
      onOpenChange(false);
    }
  };

  const step: 'loading' | 'otp' | 'password' = !state.challengeId
    ? 'loading'
    : !state.passwordVerified
      ? 'password'
      : 'otp';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Verificação dupla obrigatória
          </DialogTitle>
          <DialogDescription>
            Ação sensível: <strong>{actionLabel}</strong>. Confirme com sua senha e o código enviado
            por e-mail.
          </DialogDescription>
        </DialogHeader>

        {state.error && (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        {step === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Iniciando verificação...
          </div>
        )}

        {step === 'password' && (
          <form onSubmit={handlePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="su-pwd" className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> Senha atual
              </Label>
              <Input
                id="su-pwd"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={state.loading || !password}>
                {state.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar senha'}
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={handleOtp} className="space-y-4">
            <Alert>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                Enviamos um código de 6 dígitos para seu e-mail. Válido por 5 minutos.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="su-otp">Código de verificação</Label>
              <Input
                id="su-otp"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
                className="text-center font-mono text-lg tracking-[0.5em]"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={state.loading || otp.length !== 6}>
                {state.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Liberar acesso'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
