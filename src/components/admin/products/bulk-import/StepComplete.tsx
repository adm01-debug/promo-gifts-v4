import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, AlertTriangle, Loader2, RotateCcw, FileDown } from 'lucide-react';
import {
  type BatchImportProgress,
  type BatchImportResult,
  generateErrorReportCSV,
} from '@/lib/external-db/batch-import';
import { toast } from 'sonner';
import type { ValidationResult } from './types';

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

interface StepImportingProps {
  progress: BatchImportProgress;
}

export function StepImporting({ progress }: StepImportingProps) {
  return (
    <div className="space-y-6 py-8">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium">Importando produtos em lotes...</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Lote {progress.currentChunk} de {progress.totalChunks} • {progress.processed} de{' '}
          {progress.total} processados
        </p>
      </div>
      <Progress value={(progress.processed / progress.total) * 100} className="h-2" />
      <div className="flex justify-center gap-4 text-xs">
        <span className="text-success">✓ {progress.succeeded} sucesso</span>
        {progress.failed > 0 && (
          <span className="text-destructive">✕ {progress.failed} falha(s)</span>
        )}
      </div>
    </div>
  );
}

interface StepCompleteProps {
  importResult: BatchImportResult;
  importMode: string;
  invalidCount: number;
  validationResults: ValidationResult[];
  rawData: Record<string, unknown>[];
  onReset: () => void;
  onClose: () => void;
}

export function StepComplete({
  importResult,
  importMode,
  invalidCount,
  validationResults,
  rawData,
  onReset,
  onClose,
}: StepCompleteProps) {
  const downloadErrorReport = () => {
    const failedRows = validationResults
      .filter((r) => !r.valid)
      .map((r) => ({
        row: r.row,
        sku: r.data?.sku || ((rawData[r.row - 1]?.sku as string) ?? ''),
        name: r.data?.name || ((rawData[r.row - 1]?.name as string) ?? ''),
        errors: r.errors,
      }));
    const csv = generateErrorReportCSV(importResult.errors, failedRows);
    downloadBlob(
      csv,
      `erros_importacao_${new Date().toISOString().slice(0, 10)}.csv`,
      'text/csv;charset=utf-8;',
    );
    toast.success('Relatório de erros baixado');
  };

  return (
    <div className="space-y-6 py-4">
      <div className="text-center">
        {importResult.failed === 0 ? (
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-success" />
        ) : (
          <AlertTriangle className="mx-auto mb-3 h-12 w-12 text-warning" />
        )}
        <p className="font-display text-lg font-semibold">Importação Concluída</p>
        <div className="mt-2 flex justify-center gap-4 text-sm">
          <span className="font-medium text-success">{importResult.succeeded} importados</span>
          {importResult.failed > 0 && (
            <span className="font-medium text-destructive">{importResult.failed} falharam</span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Modo: {importMode === 'upsert' ? 'Upsert (inserir/atualizar)' : 'Apenas inserção'}
        </p>
      </div>

      {importResult.errors.length > 0 && (
        <ScrollArea className="h-[150px] rounded-lg border p-3">
          <p className="mb-2 text-xs font-medium">Erros detalhados:</p>
          {importResult.errors.map((e, i) => (
            <p key={i} className="mb-1 text-xs text-destructive">
              Linhas {e.startRow}–{e.endRow}: {e.message}
            </p>
          ))}
        </ScrollArea>
      )}

      <div className="flex justify-center gap-2">
        {(importResult.failed > 0 || invalidCount > 0) && (
          <Button variant="outline" size="sm" onClick={downloadErrorReport}>
            <FileDown className="mr-2 h-4 w-4" />
            Baixar Erros
          </Button>
        )}
        <Button variant="outline" onClick={onReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Nova Importação
        </Button>
        <Button onClick={onClose}>Concluir</Button>
      </div>
    </div>
  );
}
