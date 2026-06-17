/**
 * AccessSecurityManager — Refactored orchestrator
 * Sub-components extracted to ./access-security/
 */
import { useMemo } from 'react';
import { useAccessSecurity } from '@/hooks/auth';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, MapPin, ShieldAlert, Wifi } from 'lucide-react';
import { SecuritySettingsCard } from './access-security/SecuritySettingsCard';
import { IpWhitelistTab } from './access-security/IpWhitelistTab';
import { CityWhitelistTab } from './access-security/CityWhitelistTab';
import { BlockedLogsTab } from './access-security/BlockedLogsTab';

export function AccessSecurityManager() {
  const {
    settings,
    ips,
    cities,
    blockedLogs,
    isLoading,
    updateSettings,
    addIp,
    removeIp,
    toggleIp,
    addCity,
    removeCity,
    toggleCity,
  } = useAccessSecurity();

  const activeIpCount = useMemo(() => ips.filter((i) => i.is_active).length, [ips]);
  const activeCityCount = useMemo(() => cities.filter((c) => c.is_active).length, [cities]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SecuritySettingsCard settings={settings} onUpdate={updateSettings} />

      <Tabs defaultValue="ips" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ips" className="gap-2">
            <Wifi className="h-4 w-4" />
            IPs Permitidos
            <Badge variant="secondary" className="ml-1">
              {activeIpCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="cities" className="gap-2">
            <MapPin className="h-4 w-4" />
            Cidades Permitidas
            <Badge variant="secondary" className="ml-1">
              {activeCityCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <ShieldAlert className="h-4 w-4" />
            Acessos Bloqueados
            {blockedLogs.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {blockedLogs.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ips">
          <IpWhitelistTab ips={ips} onAdd={addIp} onRemove={removeIp} onToggle={toggleIp} />
        </TabsContent>
        <TabsContent value="cities">
          <CityWhitelistTab
            cities={cities}
            onAdd={addCity}
            onRemove={removeCity}
            onToggle={toggleCity}
          />
        </TabsContent>
        <TabsContent value="logs">
          <BlockedLogsTab logs={blockedLogs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
