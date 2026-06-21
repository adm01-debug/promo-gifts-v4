/**
 * RealtimeBadge — indicador "ao vivo" com contador de eventos dos últimos 5 min.
 * Usa Supabase Realtime para escutar inserts em product_views e search_analytics.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Radio } from 'lucide-react';

const WINDOW_MS = 5 * 60 * 1000;

export function RealtimeBadge() {
  const [count, setCount] = useState(0);
  const [, setEvents] = useState<number[]>([]);

  useEffect(() => {
    const channel = supabase
      // BUG-RT-CHANNEL FIX: tópico único por montagem — evita reaproveitar canal já inscrito
      // (crash "postgres_changes ... after subscribe()") se duas instâncias montarem juntas.
      .channel(`trends-realtime:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'product_views' }, () => {
        setEvents((e) => [...e, Date.now()]);
      })
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'search_analytics' },
        () => {
          setEvents((e) => [...e, Date.now()]);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Limpa eventos antigos a cada 10s
  useEffect(() => {
    const tick = () => {
      const cutoff = Date.now() - WINDOW_MS;
      setEvents((prev) => {
        const fresh = prev.filter((ts) => ts >= cutoff);
        setCount(fresh.length);
        return fresh;
      });
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Badge
      variant="outline"
      className="gap-1.5 border-success/30 bg-success/10 font-medium text-success"
      title={`${count} eventos nos últimos 5 minutos`}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
      </span>
      <Radio className="h-3 w-3" />
      ao vivo · {count}
    </Badge>
  );
}
