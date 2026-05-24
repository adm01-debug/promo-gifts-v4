/**
 * Recent Kits Widget for Dashboard
 * Shows draft/recent kits with quick actions
 */

import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Package, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/kit-builder';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function RecentKitsWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: recentKits = [] } = useQuery({
    queryKey: ['recent-kits-widget', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('custom_kits')
        .select('id, name, status, kit_type, total_price, updated_at, items_data')
        .order('updated_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  if (recentKits.length === 0) return null;

  const STATUS_LABELS: Record<string, string> = {
    draft: 'Rascunho',
    saved: 'Salvo',
    complete: 'Completo',
    quoted: 'Orçado',
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Kits Recentes
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => navigate('/meus-kits')} className="text-xs gap-1">
            Ver todos <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {recentKits.map((kit: { id: string; name: string; status: string; updated_at: string; total_price: number | null }) => (
          <div
            key={kit.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
            onClick={() => navigate(`/montar-kit?kit=${kit.id}`)}
          >
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{kit.name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={kit.status === 'draft' ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0">
                  {STATUS_LABELS[kit.status] || kit.status}
                </Badge>
                <span className="flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {formatDistanceToNow(new Date(kit.updated_at), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-primary">{formatCurrency(Number(kit.total_price))}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
