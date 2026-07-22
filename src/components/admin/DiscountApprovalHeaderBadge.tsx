import { Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const QUERY_KEY = ['pending-discount-approvals-count'];

export function DiscountApprovalHeaderBadge() {
  // FIX 2026-06-18 (BUG-DAR-401): adicionado rolesLoaded para evitar race condition.
  // Sem rolesLoaded, isAdmin podia ser true antes do JWT estar anexado ao
  // supabase-js client, fazendo a query disparar com anon key → HTTP 401.
  // rolesLoaded=true garante que fetchUserData completou, portanto o JWT já
  // está no cliente e a request vai como authenticated → HTTP 200 com RLS.
  const { isAdmin, rolesLoaded } = useAuth();
  const navigate = useNavigate();

  const { data: count = 0 } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { count } = await supabase
        // rls-allow: admin-only via has_role; RLS filtra
        .from('discount_approval_requests')
        // GET em vez de HEAD: evita 503/console noise em proxies/CDNs que
        // tratam HEAD de PostgREST de forma inconsistente.
        .select('id', { count: 'exact', head: false })
        .eq('status', 'pending')
        .limit(1);
      return count || 0;
    },
    enabled: rolesLoaded && Boolean(isAdmin), // rolesLoaded garante JWT pronto
    retry: 0, // sem retries: falha = falha, não flood de HEAD requests
    retryOnMount: false, // não re-tenta ao remontar o componente
    refetchInterval: 60_000,
    staleTime: 15_000,
  });

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
