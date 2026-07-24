/**
 * SellerDiscountLimitsPanel — gestão administrativa do limite máximo de desconto por vendedor.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Percent, Save } from 'lucide-react';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';

interface SellerRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  max_discount_percent: number;
}

export function SellerDiscountLimitsPanel() {
  const qc = useQueryClient();
  const [edits, setEdits] = useState<Record<string, number>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['seller-discount-limits'],
    queryFn: async (): Promise<SellerRow[]> => {
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, role')
        .eq('role', 'vendedor');
      if (pErr) throw pErr;

      const sellers = (profiles || []).filter(
        (p): p is typeof p & { user_id: string } => p.user_id !== null,
      );
      const ids = sellers.map((p) => p.user_id);
      // BUG-DISCOUNTLIMITS-SELECT-SILENT-FAIL FIX: { data } without error check — a failed
      // SELECT silently showed all sellers as 5% (the ?? default), hiding actual limits.
      const { data: limits, error: limitsErr } = await supabase
        .from('seller_discount_limits')
        .select('user_id, max_discount_percent')
        .in('user_id', ids);
      if (limitsErr) throw limitsErr;

      const byId = new Map<string, number>(
        ((limits ?? []) as Array<{ user_id: string; max_discount_percent: number }>).map((l) => [
          l.user_id,
          Number(l.max_discount_percent),
        ]),
      );
      return sellers.map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        max_discount_percent: byId.get(p.user_id) ?? 5,
      }));
    },
  });

  const save = useMutation({
    mutationFn: async ({ userId, percent }: { userId: string; percent: number }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Não autenticado');
      const { error } = await supabase
        .from('seller_discount_limits')
        .upsert(
          { user_id: userId, max_discount_percent: percent, set_by: u.user.id },
          { onConflict: 'user_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Limite atualizado');
      qc.invalidateQueries({ queryKey: ['seller-discount-limits'] });
    },
    onError: (e: unknown) => toast.error(sanitizeError(e)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Percent className="h-4 w-4 text-primary" /> Limites de desconto por vendedor
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {(data ?? []).map((row) => {
              const current = edits[row.user_id] ?? row.max_discount_percent;
              const dirty = current !== row.max_discount_percent;
              return (
                <div key={row.user_id} className="flex items-center gap-3 rounded-lg border p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.full_name || 'Sem nome'}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                  </div>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={current}
                    onChange={(e) => setEdits({ ...edits, [row.user_id]: +e.target.value })}
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                  <Button
                    size="sm"
                    disabled={!dirty || save.isPending}
                    onClick={() => save.mutate({ userId: row.user_id, percent: current })}
                  >
                    <Save className="mr-1 h-3.5 w-3.5" /> Salvar
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
