import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useNotifications, useToast } from '@/hooks/ui';
import {
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Smartphone,
} from 'lucide-react';

// BUG-NOTIF-006 FIX: preferências controladas com estado + persistência localStorage.
// Antes: todos os <Switch> tinham `disabled` hardcoded — UX completamente quebrada,
// usuário não conseguia personalizar quais alertas receber.
const PREFS_KEY = 'push_notification_prefs';

interface NotificationPrefs {
  loginFailures: boolean;
  newDevices: boolean;
  generalSecurity: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  loginFailures: true,
  newDevices: true,
  generalSecurity: true,
};

function loadPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

function savePrefs(prefs: NotificationPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage indisponível (ex: modo incognito com bloqueio) — ignora silenciosamente
  }
}

export function PushNotificationSettings() {
  const {
    push: { isSupported, isEnabled, permission, requestPermission, showSecurityAlert },
  } = useNotifications();
  const { toast } = useToast();
  const [isRequesting, setIsRequesting] = useState(false);
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadPrefs);

  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const togglePref = (key: keyof NotificationPrefs) => {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleEnableNotifications = async () => {
    setIsRequesting(true);
    try {
      const granted = await requestPermission();
      if (granted) {
        toast({
          title: 'Notificações ativadas',
          description: 'Você receberá alertas de segurança em tempo real.',
        });
        setTimeout(() => {
          showSecurityAlert(
            'Configuração concluída',
            'As notificações de segurança estão ativas!',
            'info',
          );
        }, 1000);
      } else {
        toast({
          title: 'Permissão negada',
          description: 'Você pode ativar as notificações nas configurações do navegador.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsRequesting(false);
    }
  };

  const handleTestNotification = () => {
    showSecurityAlert(
      'Teste de notificação',
      'Esta é uma notificação de teste do sistema de segurança.',
      'info',
    );
  };

  if (!isSupported) {
    return (
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5 text-muted-foreground" />
            Notificações Push
          </CardTitle>
          <CardDescription>Seu navegador não suporta notificações push.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
            <AlertTriangle className="h-5 w-5 text-brand-primary" />
            <div>
              <p className="text-sm font-medium">Navegador não compatível</p>
              <p className="text-xs text-muted-foreground">
                Tente usar Chrome, Firefox, Edge ou Safari para receber notificações.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificações Push
          {isEnabled && (
            <Badge variant="default" className="ml-2">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Ativo
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Receba alertas de segurança em tempo real no seu navegador.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
          <div className="flex items-center gap-3">
            {isEnabled ? (
              <div className="rounded-full bg-success/10 p-2">
                <BellRing className="h-5 w-5 text-success" />
              </div>
            ) : (
              <div className="rounded-full bg-muted p-2">
                <BellOff className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <p className="font-medium">
                {isEnabled ? 'Notificações ativas' : 'Notificações desativadas'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isEnabled
                  ? 'Você receberá alertas de segurança em tempo real'
                  : 'Ative para receber alertas importantes'}
              </p>
            </div>
          </div>
          {!isEnabled && (
            <Button onClick={handleEnableNotifications} disabled={isRequesting}>
              {isRequesting ? 'Ativando...' : 'Ativar'}
            </Button>
          )}
        </div>

        {permission === 'denied' && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <XCircle className="mt-0.5 h-5 w-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Permissão bloqueada</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Você bloqueou as notificações anteriormente. Para ativar:
              </p>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
                <li>Clique no ícone de cadeado na barra de endereço</li>
                <li>Encontre "Notificações" nas configurações do site</li>
                <li>Altere de "Bloquear" para "Permitir"</li>
                <li>Recarregue a página</li>
              </ol>
            </div>
          </div>
        )}

        {isEnabled && (
          <>
            {/* Tipos de alerta — BUG-NOTIF-006 FIX: switches controlados */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Tipos de alerta</h4>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded bg-destructive/10 p-1.5">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Tentativas de login falhas</p>
                      <p className="text-xs text-muted-foreground">
                        Alerta quando houver tentativas inválidas
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={prefs.loginFailures}
                    onCheckedChange={() => togglePref('loginFailures')}
                    aria-label="Ativar alertas de login falho"
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded bg-brand-primary/10 p-1.5">
                      <Smartphone className="h-4 w-4 text-brand-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Novos dispositivos</p>
                      <p className="text-xs text-muted-foreground">
                        Alerta quando um novo dispositivo acessar
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={prefs.newDevices}
                    onCheckedChange={() => togglePref('newDevices')}
                    aria-label="Ativar alertas de novos dispositivos"
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded bg-primary/10 p-1.5">
                      <Bell className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Alertas gerais de segurança</p>
                      <p className="text-xs text-muted-foreground">
                        Outras notificações importantes
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={prefs.generalSecurity}
                    onCheckedChange={() => togglePref('generalSecurity')}
                    aria-label="Ativar alertas gerais de segurança"
                  />
                </div>
              </div>
            </div>

            {/* Test Notification */}
            <div className="border-t pt-4">
              <Button variant="outline" onClick={handleTestNotification} className="w-full">
                <BellRing className="mr-2 h-4 w-4" />
                Enviar notificação de teste
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
