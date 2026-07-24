import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Shield, Wifi, MapPin } from 'lucide-react';

interface SecuritySettings {
  ip_whitelist_enabled: boolean;
  city_whitelist_enabled: boolean;
  max_failed_attempts: number;
  lockout_duration_minutes: number;
}

interface SecuritySettingsCardProps {
  settings: SecuritySettings | null;
  onUpdate: (settings: Partial<SecuritySettings>) => void;
}

export function SecuritySettingsCard({ settings, onUpdate }: SecuritySettingsCardProps) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Configurações de Segurança de Acesso
        </CardTitle>
        <CardDescription>Ative ou desative as restrições de acesso por IP e cidade</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-4">
            <div className="space-y-1">
              <Label className="flex items-center gap-2 font-medium">
                <Wifi className="h-4 w-4" />
                Whitelist de IPs
              </Label>
              <p className="text-xs text-muted-foreground">Apenas IPs cadastrados podem acessar</p>
            </div>
            <Switch
              checked={settings?.ip_whitelist_enabled ?? false}
              onCheckedChange={(checked) => onUpdate({ ip_whitelist_enabled: checked })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 p-4">
            <div className="space-y-1">
              <Label className="flex items-center gap-2 font-medium">
                <MapPin className="h-4 w-4" />
                Whitelist de Cidades
              </Label>
              <p className="text-xs text-muted-foreground">
                Apenas cidades cadastradas podem acessar
              </p>
            </div>
            <Switch
              checked={settings?.city_whitelist_enabled ?? false}
              onCheckedChange={(checked) => onUpdate({ city_whitelist_enabled: checked })}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Máx. tentativas falhadas antes do bloqueio</Label>
            <Input
              type="number"
              min={0}
              value={settings?.max_failed_attempts ?? 5}
              onChange={(e) => onUpdate({ max_failed_attempts: parseInt(e.target.value, 10) || 0 })}
              className="w-32"
            />
          </div>
          <div className="space-y-2">
            <Label>Duração do bloqueio (minutos)</Label>
            <Input
              type="number"
              min={1}
              value={settings?.lockout_duration_minutes ?? 15}
              onChange={(e) =>
                onUpdate({ lockout_duration_minutes: parseInt(e.target.value, 10) || 15 })
              }
              className="w-32"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
