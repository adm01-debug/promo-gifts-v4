import { useEffect, useState } from 'react';
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import { CheckCircle2, Database, Globe, Wifi, Search, Activity, Server } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

import { logger } from '@/lib/logger';
export const SupabaseConnectionDebug = () => {
  const [info, setInfo] = useState<{
    url: string;
    envUrl: string;
    isCanonical: boolean;
    isFallbackActive: boolean;
    projectRef: string;
    clientReady: boolean;
  } | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const client = await getSupabaseClient();
        const url = (client as unknown as { supabaseUrl?: string }).supabaseUrl || 'N/A';
        const envUrl = import.meta.env.VITE_SUPABASE_URL || 'N/A';
        const projectRef = url.split('//')[1]?.split('.')[0] || 'N/A';
        const isCanonical = projectRef === 'doufsxqlfjyuvxuezpln';
        const isFallbackActive = isCanonical && !envUrl.includes('doufsxqlfjyuvxuezpln');

        setInfo({
          url,
          envUrl,
          isCanonical,
          isFallbackActive,
          projectRef,
          clientReady: !!client,
        });
      } catch (e) {
        logger.error('Debug check failed', e);
      }
    };
    check();
  }, []);

  if (!info) return null;

  return (
    <Card className="mt-8 border-white/5 bg-black/40 p-4 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-blue-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/70">
            Conexão Supabase
          </span>
        </div>
        {info.clientReady ? (
          <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-400">
            <CheckCircle2 className="mr-1 h-3 w-3" /> ATIVO
          </Badge>
        ) : (
          <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-400">
            <Activity className="mr-1 h-3 w-3" /> DESCONECTADO
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <p className="text-[10px] uppercase text-white/40">URL Ativa (Client)</p>
          <div className="flex items-center gap-2 rounded bg-white/5 p-2 font-mono text-[11px] text-white/90">
            <Globe className="h-3 w-3 text-white/30" />
            {info.url}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-[10px] uppercase text-white/40">Configuração .env</p>
          <div className="flex items-center gap-2 rounded bg-white/5 p-2 font-mono text-[11px] text-white/90">
            <Wifi className="h-3 w-3 text-white/30" />
            {info.envUrl}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-blue-500/10 bg-blue-500/5 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/10">
            <Search className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-tighter text-blue-400">
              Project Ref
            </p>
            <p className="text-sm font-bold text-white">{info.projectRef}</p>
          </div>
        </div>

        {info.isCanonical ? (
          <div className="flex items-center gap-2">
            <Badge className="border-green-500/30 bg-green-500/20 text-green-400">
              <CheckCircle2 className="mr-1 h-3 w-3" /> CANÔNICO OK
            </Badge>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Badge className="border-blue-500/30 bg-blue-500/20 text-blue-400">
              <Server className="mr-1 h-3 w-3" /> AMBIENTE CUSTOM
            </Badge>
          </div>
        )}
      </div>
    </Card>
  );
};
