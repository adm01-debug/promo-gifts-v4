import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useNotifications, useToast } from "@/hooks/ui";
import { 
  Bell, 
  BellOff, 
  BellRing,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Smartphone,
  Volume2,
  VolumeX
} from 'lucide-react';

export function PushNotificationSettings() {
  const {
    push: {
      isSupported,
      isEnabled,
      permission,
      requestPermission,
      showSecurityAlert,
    },
  } = useNotifications();
  const { toast } = useToast();
  const [isRequesting, setIsRequesting] = useState(false);

  const handleEnableNotifications = async () => {
    setIsRequesting(true);
    try {
      const granted = await requestPermission();
      if (granted) {
        toast({
          title: 'Notificações ativadas',
          description: 'Você receberá alertas de segurança em tempo real.',
        });
        // Show test notification
        setTimeout(() => {
          showSecurityAlert(
            'Configuração concluída',
            'As notificações de segurança estão ativas!',
            'info'
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
      'info'
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
          <CardDescription>
            Seu navegador não suporta notificações push.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
            <AlertTriangle className="h-5 w-5 text-orange" />
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
              <CheckCircle2 className="h-3 w-3 mr-1" />
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
        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
          <div className="flex items-center gap-3">
            {isEnabled ? (
              <div className="p-2 rounded-full bg-success/10">
                <BellRing className="h-5 w-5 text-success" />
              </div>
            ) : (
              <div className="p-2 rounded-full bg-muted">
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
            <Button
              onClick={handleEnableNotifications}
              disabled={isRequesting}
            >
              {isRequesting ? 'Ativando...' : 'Ativar'}
            </Button>
          )}
        </div>

        {permission === 'denied' && (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/20 bg-destructive/5">
            <XCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Permissão bloqueada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Você bloqueou as notificações anteriormente. Para ativar:
              </p>
              <ol className="text-sm text-muted-foreground mt-2 list-decimal list-inside space-y-1">
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
            {/* Notification Types */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Tipos de alerta</h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-destructive/10">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Tentativas de login falhas</p>
                      <p className="text-xs text-muted-foreground">Alerta quando houver tentativas inválidas</p>
                    </div>
                  </div>
                  <Switch defaultChecked disabled />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-orange/10">
                      <Smartphone className="h-4 w-4 text-orange" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Novos dispositivos</p>
                      <p className="text-xs text-muted-foreground">Alerta quando um novo dispositivo acessar</p>
                    </div>
                  </div>
                  <Switch defaultChecked disabled />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-primary/10">
                      <Bell className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Alertas gerais de segurança</p>
                      <p className="text-xs text-muted-foreground">Outras notificações importantes</p>
                    </div>
                  </div>
                  <Switch defaultChecked disabled />
                </div>
              </div>
            </div>

            {/* Test Notification */}
            <div className="pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={handleTestNotification}
                className="w-full"
              >
                <BellRing className="h-4 w-4 mr-2" />
                Enviar notificação de teste
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
