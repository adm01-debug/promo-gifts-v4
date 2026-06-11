import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const INTERVAL_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hora' },
  { value: 120, label: '2 horas' },
  { value: 240, label: '4 horas' },
];

export function AutoTestIntervalCard() {
  const [current, setCurrent] = useState<number | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_connections_auto_test_interval');
      if (!cancelled) {
        if (error) {
          toast.error('Não foi possível ler o intervalo atual', {
            description: 'Verifique as permissões e tente novamente.',
          });
        } else if (typeof data === 'number') {
          setCurrent(data);
          setDraft(String(data));
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = draft !== '' && current !== null && Number(draft) !== current;

  async function save() {
    const minutes = Number(draft);
    if (!Number.isFinite(minutes)) return;
    setSaving(true);
    const { data, error } = await supabase.rpc('set_connections_auto_test_interval', { minutes });
    setSaving(false);
    if (error) {
      const isForbidden = error.code === '42501' || error.message.includes('forbidden');
      toast.error('Falha ao alterar o intervalo', {
        description: isForbidden
          ? 'Apenas administradores podem alterar o intervalo.'
          : 'Não foi possível salvar a configuração.',
      });
      return;
    }
    setCurrent(typeof data === 'number' ? data : minutes);
    toast.success('Intervalo do auto-teste atualizado', {
      description: `Próximas execuções a cada ${formatLabel(minutes)}.`,
    });
  }

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-wrap items-center gap-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium">Intervalo do auto-teste</div>
            <div className="text-[11px] text-muted-foreground">
              Frequência com que o cron testa as conexões com auto-teste habilitado.
            </div>
          </div>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">
                Apenas administradores podem alterar. A mudança é registrada em auditoria e aplicada
                imediatamente ao agendamento.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">
            Atual: {loading ? '…' : current !== null ? formatLabel(current) : '—'}
          </span>
          <Select value={draft} onValueChange={setDraft} disabled={loading || saving}>
            <SelectTrigger className="h-9 w-[120px]" aria-label="Selecionar intervalo">
              <SelectValue placeholder="Intervalo" />
            </SelectTrigger>
            <SelectContent>
              {INTERVAL_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={save} disabled={!dirty || saving || loading}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return h === 1 ? '1 hora' : `${h} horas`;
}
