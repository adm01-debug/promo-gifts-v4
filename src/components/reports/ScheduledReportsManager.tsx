import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock, Plus, Trash2, Mail, Clock, FileBarChart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useScheduledReports,
  type ReportFrequency,
  type ReportType,
  type CreateReportInput,
} from '@/hooks/intelligence';

export function ScheduledReportsManager() {
  const {
    reports,
    isLoading,
    createReport,
    toggleActive,
    deleteReport,
    FREQUENCY_LABELS,
    REPORT_TYPE_LABELS,
  } = useScheduledReports();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreateReportInput>({
    report_type: 'sales',
    frequency: 'weekly',
    email_to: '',
    report_name: 'Relatório Semanal de Vendas',
  });

  const handleCreate = async () => {
    if (!form.email_to) return;
    const success = await createReport(form);
    if (success) {
      setOpen(false);
      setForm({
        report_type: 'sales',
        frequency: 'weekly',
        email_to: '',
        report_name: 'Relatório Semanal de Vendas',
      });
    }
  };

  const updateFormName = (type: ReportType, freq: ReportFrequency) => {
    const typeLabel = REPORT_TYPE_LABELS[type];
    const freqLabel = FREQUENCY_LABELS[freq];
    setForm((prev) => ({
      ...prev,
      report_type: type,
      frequency: freq,
      report_name: `Relatório ${freqLabel} de ${typeLabel}`,
    }));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <CalendarClock className="h-5 w-5 text-primary" />
            Relatórios Agendados
          </CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="h-3.5 w-3.5" />
                Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Agendar Relatório</DialogTitle>
              </DialogHeader>
              <div className="mt-2 space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Relatório</Label>
                  <Select
                    value={form.report_type}
                    onValueChange={(v: ReportType) => updateFormName(v, form.frequency)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(REPORT_TYPE_LABELS) as Array<[ReportType, string]>).map(
                        ([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Frequência</Label>
                  <Select
                    value={form.frequency}
                    onValueChange={(v: ReportFrequency) => updateFormName(form.report_type, v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(FREQUENCY_LABELS) as Array<[ReportFrequency, string]>).map(
                        ([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Email de Destino</Label>
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={form.email_to}
                    onChange={(e) => setForm((prev) => ({ ...prev, email_to: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nome do Relatório</Label>
                  <Input
                    value={form.report_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, report_name: e.target.value }))}
                  />
                </div>

                <Button onClick={handleCreate} className="w-full" disabled={!form.email_to}>
                  Agendar Relatório
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <FileBarChart className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p className="text-sm">Nenhum relatório agendado</p>
            <p className="mt-1 text-xs">
              Crie um agendamento para receber relatórios por email automaticamente
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
              >
                <Switch
                  checked={report.is_active}
                  onCheckedChange={(v) => toggleActive(report.id, v)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{report.report_name}</p>
                    <Badge
                      variant={report.is_active ? 'default' : 'secondary'}
                      className="text-[10px]"
                    >
                      {report.is_active ? 'Ativo' : 'Pausado'}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="h-2.5 w-2.5" />
                      {report.email_to}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {FREQUENCY_LABELS[report.frequency]}
                    </span>
                    {report.last_sent_at && (
                      <span>
                        Último:{' '}
                        {format(new Date(report.last_sent_at), 'dd/MM HH:mm', { locale: ptBR })}
                      </span>
                    )}
                    <span>
                      Próximo:{' '}
                      {format(new Date(report.next_run_at), 'dd/MM HH:mm', { locale: ptBR })}
                    </span>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir Relatório?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O relatório "{report.report_name}" será excluído permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteReport(report.id)}>
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
