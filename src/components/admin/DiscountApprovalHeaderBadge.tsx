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
  // FIX 2026-06-18 (BUG-DAR-401): adicionado rolesLoaded para evitar race condition.
  // Sem rolesLoaded, isAdmin podia ser true antes do JWT estar anexado ao
  // supabase-js client, fazendo a query disparar com anon key → HTTP 401.
  // rolesLoaded=true garante que fetchUserData completou, portanto o JWT já
  // está no cliente e a request vai como authenticated → HTTP 200 com RLS.
  const { isAdmin, rolesLoaded } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: QUERY_KEY,
    // BUG-DAR-ABORT-REGRESSION FIX (2026-06-23):
    // O "fix" de 2026-06-22 (BUG-DAR-ABORT) passou .abortSignal(signal) ao Supabase,
    // o que na verdade INTRODUZIU o console error "Falha ao carregar Buscar: HEAD".
    // Causa raiz: React Query v5 chama controller.abort() quando enabled vai true→false
    // durante race de auth no page load. Com .abortSignal(signal), o abort propaga ao
    // fetch nativo -> browser loga "Falha ao carregar Buscar". SEM o signal, o fetch
    // completa silenciosamente (React Query ignora o resultado) sem erro no console.
    // O signal foi removido propositalmente.
    queryFn: async () => {
      const { count: rawCount } = await supabase
        // rls-allow: admin-only via has_role; RLS filtra
        .from('discount_approval_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      return rawCount || 0;
    },
    enabled: rolesLoaded && Boolean(isAdmin), // rolesLoaded garante JWT pronto
    retry: 0,              // sem retries: falha = falha, nao flood
    retryOnMount: false,   // nao re-tenta ao remontar
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,  // evita abort extra ao focar aba
    refetchOnReconnect: false,    // evita abort extra ao reconectar
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
