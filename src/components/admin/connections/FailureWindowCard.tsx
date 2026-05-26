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
import { ShieldAlert, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const WINDOW_OPTIONS: Array<{ value: number; label: string; help: string }> = [
  { value: 0, label: 'Imediato', help: 'Notifica em qualquer falha (≤1h, comportamento legado)' },
  { value: 15, label: '15 min', help: 'Mínimo 15 min de falhas contínuas' },
  { value: 30, label: '30 min', help: 'Padrão recomendado' },
  { value: 60, label: '1 hora', help: 'Tolerante a flaps moderados' },
  { value: 120, label: '2 horas', help: 'Notifica apenas quedas prolongadas' },
  { value: 240, label: '4 horas', help: 'Apenas incidentes graves' },
];

export function FailureWindowCard() {
  const [current, setCurrent] = useState<number | null>(null);
  const [draft, setDraft] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_connection_failure_window_minutes');
      if (!cancelled) {
        if (error) {
          toast.error('Não foi possível ler a janela atual', { description: error.message });
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
    const { data, error } = await supabase.rpc('set_connection_failure_window_minutes', {
      minutes,
    });
    setSaving(false);
    if (error) {
      toast.error('Falha ao alterar a janela', {
        description: error.message.includes('forbidden')
          ? 'Apenas administradores podem alterar.'
          : error.message,
      });
      return;
    }
    setCurrent(typeof data === 'number' ? data : minutes);
    toast.success('Janela de notificação atualizada', {
      description:
        minutes === 0
          ? 'Notifica em qualquer falha recente.'
          : `Só notifica após ${formatLabel(minutes)} de falhas contínuas.`,
    });
  }

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-wrap items-center gap-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-warning/10">
            <ShieldAlert className="h-4 w-4 text-warning" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium">Janela de falha contínua</div>
            <div className="text-[11px] text-muted-foreground">
              Tempo mínimo de falhas consecutivas antes de gerar notificação para administradores.
            </div>
          </div>
        </div>

        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[300px]">
              <p className="text-xs">
                Evita ruído de incidentes em flaps transitórios. O cron de health-check só dispara{' '}
                <code>connection_down</code> se nenhum teste sucesso ocorreu dentro da janela.
                Alterações são auditadas.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">
            Atual: {loading ? '…' : current !== null ? formatLabel(current) : '—'}
          </span>
          <Select value={draft} onValueChange={setDraft} disabled={loading || saving}>
            <SelectTrigger className="h-9 w-[140px]" aria-label="Selecionar janela">
              <SelectValue placeholder="Janela" />
            </SelectTrigger>
            <SelectContent>
              {WINDOW_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  <span className="flex items-center gap-2">
                    {opt.label}
                    <span className="text-[10px] text-muted-foreground">{opt.help}</span>
                  </span>
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
  if (minutes === 0) return 'Imediato';
  if (minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return h === 1 ? '1 hora' : `${h} horas`;
}
