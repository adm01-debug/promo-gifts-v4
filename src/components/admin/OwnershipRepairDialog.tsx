/**
 * OwnershipRepairDialog — reparo automático de órfãos detectados pela auditoria.
 *
 * Fluxo seguro: simulação obrigatória primeiro (dry-run), depois aplicação real
 * com confirmação explícita. Cada execução grava logs em `ownership_repair_logs`.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Trash2,
  PowerOff,
  FileWarning,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

import { logger } from '@/lib/logger';
import { toErrorMessage } from '@/lib/to-error-message';
import { cn } from '@/lib/utils';
interface RepairAction {
  table: string;
  owner_column: string;
  issue: 'null_owner' | 'missing_user';
  action: 'deleted' | 'deactivated' | 'manual_review' | 'skipped' | 'failed';
  rows_affected: number;
  dry_run: boolean;
}

interface RepairTotals {
  deleted: number;
  deactivated: number;
  manual_review: number;
}

interface RepairResult {
  report_id: string;
  dry_run: boolean;
  totals: RepairTotals;
  actions: RepairAction[];
}

interface Props {
  reportId?: string;
  hasIssues: boolean;
}

const ACTION_META: Record<
  RepairAction['action'],
  {
    label: string;
    variant: 'destructive' | 'secondary' | 'outline' | 'default';
    icon: typeof Trash2;
  }
> = {
  deleted: { label: 'Apagado', variant: 'destructive', icon: Trash2 },
  deactivated: { label: 'Desativado', variant: 'outline', icon: PowerOff },
  manual_review: { label: 'Revisão manual', variant: 'secondary', icon: FileWarning },
  skipped: { label: 'Ignorado', variant: 'secondary', icon: CheckCircle2 },
  failed: { label: 'Falhou', variant: 'destructive', icon: AlertTriangle },
};

export function OwnershipRepairDialog({ reportId, hasIssues }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<RepairResult | null>(null);
  const [applied, setApplied] = useState<RepairResult | null>(null);

  async function invoke(dryRun: boolean): Promise<RepairResult | null> {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('ownership-repair', {
        body: { report_id: reportId, dry_run: dryRun, triggered_by: dryRun ? 'dry_run' : 'apply' },
      });
      if (error) throw error;
      const result = (data as { result: RepairResult }).result;
      return result;
    } catch (e) {
      logger.error('Ownership repair failed', e);
      toast.error(`Falha no reparo: ${toErrorMessage(e)}`);
      return null;
    } finally {
      setRunning(false);
    }
  }

  async function runDryRun() {
    setApplied(null);
    const r = await invoke(true);
    if (r) {
      setPreview(r);
      toast.success(`Simulação concluída — ${r.actions.length} ações projetadas.`);
    }
  }

  async function applyRepair() {
    if (!preview) return;
    if (
      !confirm(
        'Confirma a aplicação do reparo? Esta ação modifica o banco e é registrada nos logs.',
      )
    )
      return;
    const r = await invoke(false);
    if (r) {
      setApplied(r);
      toast.success(
        `Reparo aplicado — apagados: ${r.totals.deleted}, desativados: ${r.totals.deactivated}, revisão: ${r.totals.manual_review}`,
      );
      await qc.invalidateQueries({ queryKey: ['ownership-audit-reports'] });
    }
  }

  function reset() {
    setPreview(null);
    setApplied(null);
  }

  const display = applied ?? preview;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!hasIssues} className="gap-2">
          <Wrench className="h-4 w-4" /> Reparar registros
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Reparo automático de órfãos
          </DialogTitle>
          <DialogDescription>
            Tenta corrigir registros sem dono ou cujo dono não existe mais. Sempre execute a
            <strong> simulação </strong> antes de aplicar. Cada execução é registrada em
            <code className="text-xs"> ownership_repair_logs</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Estratégia aplicada</AlertTitle>
            <AlertDescription className="mt-2 space-y-1 text-xs">
              <p>
                • <strong>Apagar:</strong> apenas em tabelas seguras de logs/notificações
                (workspace_notifications, rls_denial_log, mcp_audit_log…).
              </p>
              <p>
                • <strong>Desativar:</strong> tabelas com coluna <code>is_active</code>,{' '}
                <code>active</code> ou <code>status</code> recebem o registro marcado como inativo.
              </p>
              <p>
                • <strong>Revisão manual:</strong> demais tabelas são apenas reportadas — nada é
                alterado.
              </p>
            </AlertDescription>
          </Alert>

          {!display && (
            <div className="text-sm text-muted-foreground">
              Clique em <strong>Simular reparo</strong> para ver o que seria feito sem alterar
              dados.
            </div>
          )}

          {display && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Stat
                  label="Apagados"
                  value={display.totals.deleted}
                  icon={Trash2}
                  tone="destructive"
                />
                <Stat
                  label="Desativados"
                  value={display.totals.deactivated}
                  icon={PowerOff}
                  tone="warning"
                />
                <Stat
                  label="Revisão manual"
                  value={display.totals.manual_review}
                  icon={FileWarning}
                  tone="muted"
                />
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tabela</TableHead>
                      <TableHead>Coluna</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead className="text-right">Linhas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {display.actions.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-6 text-center text-sm text-muted-foreground"
                        >
                          Nenhuma ação necessária.
                        </TableCell>
                      </TableRow>
                    ) : (
                      display.actions.map((a, i) => {
                        const meta = ACTION_META[a.action];
                        const Icon = meta.icon;
                        return (
                          <TableRow key={`${a.table}-${a.issue}-${i}`}>
                            <TableCell className="font-mono text-xs">{a.table}</TableCell>
                            <TableCell className="font-mono text-xs">{a.owner_column}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">
                                {a.issue === 'null_owner' ? 'sem dono' : 'órfão'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={meta.variant} className="gap-1 text-[10px]">
                                <Icon className="h-3 w-3" /> {meta.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-xs">{a.rows_affected}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {applied && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <AlertTitle>Reparo aplicado</AlertTitle>
                  <AlertDescription className="text-xs">
                    Todas as ações foram gravadas em <code>ownership_repair_logs</code>. Rode uma
                    nova auditoria para confirmar que as lacunas foram fechadas.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          <Button variant="secondary" onClick={runDryRun} disabled={running} className="gap-2">
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wrench className="h-4 w-4" />
            )}
            Simular reparo
          </Button>
          <Button
            onClick={applyRepair}
            disabled={running || !preview || applied !== null || preview.actions.length === 0}
            className="gap-2"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            Aplicar reparo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  icon: iconElement,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Trash2;
  tone: 'destructive' | 'warning' | 'muted';
}) {
  const Icon = iconElement;
  const toneClass =
    tone === 'destructive'
      ? 'text-destructive'
      : tone === 'warning'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-muted-foreground';
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={cn('mt-1 text-2xl font-bold', toneClass)}>{value}</div>
    </div>
  );
}
