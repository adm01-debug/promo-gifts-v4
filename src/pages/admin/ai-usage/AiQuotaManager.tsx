import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings2, Save } from 'lucide-react';
import { useAiQuotas, useUpdateQuota } from '@/hooks/intelligence';
import { toast } from 'sonner';

const ROLE_LABELS: Record<string, string> = {
  dev: 'Dev',
  supervisor: 'Supervisor',
  vendedor: 'Agente',
  admin: 'Supervisor', // legado
  manager: 'Supervisor', // legado
};

export function AiQuotaManager() {
  const { data: quotas, isLoading } = useAiQuotas();
  const updateQuota = useUpdateQuota();
  const [editing, setEditing] = useState<Record<string, { limit: number; unlimited: boolean }>>({});

  const handleSave = async (id: string, role: string) => {
    const edit = editing[id];
    if (!edit) return;
    try {
      await updateQuota.mutateAsync({
        id,
        monthly_limit: edit.limit,
        is_unlimited: edit.unlimited,
      });
      toast.success(`Quota do ${ROLE_LABELS[role] || role} atualizada`);
      setEditing((prev) => {
        const n = { ...prev };
        Reflect.deleteProperty(n, id);
        return n;
      });
    } catch {
      toast.error('Erro ao atualizar quota');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Settings2 className="h-4 w-4" /> Gestão de Quotas por Papel
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {(quotas ?? []).map((q) => {
              const e = editing[q.id];
              const isEditing = !!e;
              const limit = isEditing ? e.limit : q.monthly_limit;
              const unlimited = isEditing ? e.unlimited : q.is_unlimited;
              return (
                <div
                  key={q.id}
                  className="flex items-center gap-4 rounded-lg border border-border/50 bg-card p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{ROLE_LABELS[q.role] || q.role}</p>
                    <p className="text-xs text-muted-foreground">
                      {unlimited ? 'Uso ilimitado' : `${limit} req/mês`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Ilimitado</label>
                    <Switch
                      checked={unlimited}
                      onCheckedChange={(checked) =>
                        setEditing((prev) => ({ ...prev, [q.id]: { limit, unlimited: checked } }))
                      }
                    />
                  </div>
                  {!unlimited && (
                    <Input
                      type="number"
                      className="h-8 w-24 text-sm"
                      value={limit}
                      min={0}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [q.id]: { limit: parseInt(e.target.value, 10) || 0, unlimited: false },
                        }))
                      }
                    />
                  )}
                  {isEditing && (
                    <Button
                      size="sm"
                      className="h-8 gap-1"
                      onClick={() => handleSave(q.id, q.role)}
                      disabled={updateQuota.isPending}
                    >
                      <Save className="h-3 w-3" /> Salvar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
