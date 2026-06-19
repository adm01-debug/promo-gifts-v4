import { useEffect } from 'react';
import { Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const QUERY_KEY = ['pending-discount-approvals-count'];

export function DiscountApprovalHeaderBadge() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { count: approvalCount } = await supabase
        // rls-allow: admin-only via has_role; RLS filtra
        .from('discount_approval_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      return approvalCount || 0;
    },
    enabled: Boolean(isAdmin), // força boolean estável — evita re-trigger em undefined→false
    retry: 0, // sem retries: falha = falha, não flood de HEAD requests
    retryOnMount: false, // não re-tenta ao remontar o componente
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

  // Realtime: invalidate on any change
  useEffect(() => {
    if (!isAdmin) return;
    const channelName = `discount-approvals-badge-${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'discount_approval_requests',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: QUERY_KEY });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, queryClient]);

  if (!isAdmin || count === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full"
          onClick={() => navigate('/admin/usuarios?tab=discounts')}
          aria-label={`${count} aprovações de desconto pendentes`}
        >
          <Shield className="h-4 w-4 text-amber-500" />
          <Badge
            className={cn(
              'absolute -right-0.5 -top-0.5 h-4 min-w-4 px-1 text-[10px] font-bold',
              'animate-pulse border-0 bg-amber-500 text-white',
            )}
          >
            {count > 9 ? '9+' : count}
          </Badge>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>
          {count} desconto{count !== 1 ? 's' : ''} aguardando aprovação
        </p>
      </TooltipContent>
    </Tooltip>
  );
}
