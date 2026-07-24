import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, ShieldCheck, ShieldOff, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/ui';
import { use2FA } from '@/hooks/auth';
import { useAuth } from '@/contexts/AuthContext';

interface TwoFactorSetupProps {
  targetUserId?: string;
  targetUserEmail?: string;
}

export function TwoFactorSetup({ targetUserId, targetUserEmail }: TwoFactorSetupProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { is2FAEnabled, isLoading, generateSecret, enable2FA, disable2FA } = use2FA(targetUserId);

  const isManagingOther = !!targetUserId && targetUserId !== user?.id;

  const [setupMode, setSetupMode] = useState(false);
  const [disableMode, setDisableMode] = useState(false);
  const [qrData, setQrData] = useState<{ secret: string; uri: string } | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleStartSetup = () => {
    const email = targetUserEmail || user?.email;
    if (!email) return;
    const data = generateSecret(email);
    setQrData(data);
    setSetupMode(true);
  };

  const handleCopySecret = async () => {
    if (!qrData) return;
    await navigator.clipboard.writeText(qrData.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEnable = async () => {
    if (verificationCode.length !== 6) return;

    setIsSubmitting(true);
    const result = await enable2FA(verificationCode);
    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: '2FA Ativado',
        description: 'Autenticação de dois fatores foi ativada com sucesso.',
      });
      setSetupMode(false);
      setQrData(null);
      setVerificationCode('');
    } else {
      toast({
        title: 'Erro',
        description: result.error || 'Não foi possível ativar o 2FA.',
        variant: 'destructive',
      });
    }
  };

  const handleDisable = async () => {
    setIsSubmitting(true);

    // Admin desativando de outro usuário não precisa de token
    if (isManagingOther) {
      const result = await disable2FA();
      setIsSubmitting(false);
      if (result.success) {
        toast({
          title: '2FA Desativado',
          description: 'Autenticação de dois fatores foi desativada para este usuário.',
        });
        setDisableMode(false);
        setVerificationCode('');
      } else {
        toast({
          title: 'Erro',
          description: result.error || 'Não foi possível desativar o 2FA.',
          variant: 'destructive',
        });
      }
      return;
    }

    if (verificationCode.length !== 6) {
      setIsSubmitting(false);
      return;
    }

    const result = await disable2FA(verificationCode);
    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: '2FA Desativado',
        description: 'Autenticação de dois fatores foi desativada.',
      });
      setDisableMode(false);
      setVerificationCode('');
    } else {
      toast({
        title: 'Erro',
        description: result.error || 'Não foi possível desativar o 2FA.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {is2FAEnabled ? (
            <ShieldCheck className="h-5 w-5 text-success" />
          ) : (
            <Shield className="h-5 w-5 text-muted-foreground" />
          )}
          <CardTitle>Autenticação de Dois Fatores (2FA)</CardTitle>
        </div>
        <CardDescription>
          {isManagingOther
            ? 'Gerencie a autenticação de dois fatores deste usuário.'
            : 'Adicione uma camada extra de segurança à sua conta usando um aplicativo autenticador.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {is2FAEnabled ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3 text-success">
              <ShieldCheck className="h-5 w-5" />
              <span className="font-medium">2FA está ativo</span>
            </div>

            {isManagingOther ? (
              <Dialog open={disableMode} onOpenChange={setDisableMode}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="text-destructive">
                    <ShieldOff className="mr-2 h-4 w-4" />
                    Desativar 2FA (Admin)
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Desativar 2FA</DialogTitle>
                    <DialogDescription>
                      Tem certeza que deseja desativar o 2FA deste usuário? Isso reduzirá a
                      segurança da conta.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <Button
                      onClick={handleDisable}
                      disabled={isSubmitting}
                      className="w-full"
                      variant="destructive"
                    >
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Confirmar Desativação
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            ) : (
              <Dialog open={disableMode} onOpenChange={setDisableMode}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="text-destructive">
                    <ShieldOff className="mr-2 h-4 w-4" />
                    Desativar 2FA
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Desativar 2FA</DialogTitle>
                    <DialogDescription>
                      Digite o código do seu aplicativo autenticador para confirmar.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={verificationCode}
                        onChange={setVerificationCode}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <Button
                      onClick={handleDisable}
                      disabled={verificationCode.length !== 6 || isSubmitting}
                      className="w-full"
                      variant="destructive"
                    >
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Confirmar Desativação
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        ) : (
          <Dialog
            open={setupMode}
            onOpenChange={(open) => {
              setSetupMode(open);
              if (!open) {
                setQrData(null);
                setVerificationCode('');
              }
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={handleStartSetup}>
                <Shield className="mr-2 h-4 w-4" />
                Configurar 2FA
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Configurar 2FA</DialogTitle>
                <DialogDescription>
                  Escaneie o QR code com seu aplicativo autenticador (Google Authenticator, Authy,
                  etc.)
                </DialogDescription>
              </DialogHeader>
              {qrData && (
                <div className="space-y-6 py-4">
                  <div className="flex justify-center">
                    <div className="rounded-lg bg-white p-4">
                      <QRCodeSVG value={qrData.uri} size={200} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Ou digite o código manualmente:</Label>
                    <div className="flex gap-2">
                      <Input value={qrData.secret} readOnly className="font-mono text-sm" />
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Confirmar"
                        onClick={handleCopySecret}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Digite o código de 6 dígitos:</Label>
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={verificationCode}
                        onChange={setVerificationCode}
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                  </div>

                  <Button
                    onClick={handleEnable}
                    disabled={verificationCode.length !== 6 || isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Ativar 2FA
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
