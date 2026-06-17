import { useCallback, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDeviceDetection } from '@/hooks/admin/useDeviceDetection';
import { useToast } from '@/hooks/ui/use-toast';
import {
  Monitor,
  Smartphone,
  Tablet,
  Trash2,
  Shield,
  ShieldCheck,
  Globe,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface KnownDevice {
  id: string;
  device_fingerprint: string;
  ip_address: string;
  user_agent: string | null;
  browser_name: string | null;
  os_name: string | null;
  device_type: string | null;
  location: string | null;
  first_seen_at: string;
  last_seen_at: string;
  is_trusted: boolean;
}

interface KnownDevicesManagerProps {
  targetUserId?: string;
}

export function KnownDevicesManager({ targetUserId }: KnownDevicesManagerProps) {
  const [devices, setDevices] = useState<KnownDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getKnownDevices, removeDevice, trustDevice, getDeviceInfo } =
    useDeviceDetection(targetUserId);
  const { toast } = useToast();
  const currentFingerprint = getDeviceInfo().fingerprint;
  const isManagingOther = !!targetUserId;

  const loadDevices = useCallback(async () => {
    setIsLoading(true);
    const data = await getKnownDevices();
    setDevices(data as unknown as KnownDevice[]);
    setIsLoading(false);
  }, [getKnownDevices]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  const handleRemoveDevice = async (deviceId: string) => {
    const success = await removeDevice(deviceId);
    if (success) {
      toast({
        title: 'Dispositivo removido',
        description: 'O dispositivo foi removido com sucesso.',
      });
      loadDevices();
    } else {
      toast({
        title: 'Erro',
        description: 'Não foi possível remover o dispositivo.',
        variant: 'destructive',
      });
    }
  };

  const handleTrustDevice = async (deviceId: string) => {
    const success = await trustDevice(deviceId);
    if (success) {
      toast({
        title: 'Dispositivo confiável',
        description: 'O dispositivo foi marcado como confiável.',
      });
      loadDevices();
    } else {
      toast({
        title: 'Erro',
        description: 'Não foi possível marcar o dispositivo como confiável.',
        variant: 'destructive',
      });
    }
  };

  const getDeviceIcon = (deviceType: string | null) => {
    switch (deviceType?.toLowerCase()) {
      case 'mobile':
        return <Smartphone className="h-5 w-5" />;
      case 'tablet':
        return <Tablet className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  const isCurrentDevice = (device: KnownDevice) => {
    if (isManagingOther) return false;
    return device.device_fingerprint === currentFingerprint;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dispositivos Conhecidos</CardTitle>
          <CardDescription>Carregando...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Dispositivos Conhecidos
        </CardTitle>
        <CardDescription>
          {isManagingOther
            ? 'Dispositivos que têm acesso à conta deste usuário'
            : 'Gerencie os dispositivos que têm acesso à sua conta'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum dispositivo registrado ainda.</p>
        ) : (
          devices.map((device) => (
            <div
              key={device.id}
              className={cn(
                'flex items-center justify-between rounded-lg border p-4',
                isCurrentDevice(device) ? 'border-primary bg-primary/5' : '',
              )}
            >
              <div className="flex items-center gap-4">
                <div className="rounded-full bg-muted p-2">{getDeviceIcon(device.device_type)}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {device.browser_name || 'Navegador desconhecido'} -{' '}
                      {device.os_name || 'SO desconhecido'}
                    </span>
                    {isCurrentDevice(device) && <Badge variant="secondary">Este dispositivo</Badge>}
                    {device.is_trusted && (
                      <Badge variant="default" className="gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        Confiável
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" />
                      {device.ip_address}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Último acesso:{' '}
                      {formatDistanceToNow(new Date(device.last_seen_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!device.is_trusted && !isCurrentDevice(device) && (
                  <Button variant="outline" size="sm" onClick={() => handleTrustDevice(device.id)}>
                    <ShieldCheck className="mr-1 h-4 w-4" />
                    Confiar
                  </Button>
                )}
                {!isCurrentDevice(device) && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveDevice(device.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
