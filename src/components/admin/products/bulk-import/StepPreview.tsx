import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CheckCircle2, XCircle, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ImportMode } from '@/lib/external-db/batch-import';
import type { ValidationResult, ColumnMapping } from './types';

interface StepPreviewProps {
  validationResults: ValidationResult[];
  rawData: Record<string, unknown>[];
  mapping: ColumnMapping;
  importMode: ImportMode;
  setImportMode: (mode: ImportMode) => void;
  onBack: () => void;
  onImport: () => void;
}

export function StepPreview({
  validationResults,
  rawData,
  mapping,
  importMode,
  setImportMode,
  onBack,
  onImport,
}: StepPreviewProps) {
  const { validCount, invalidCount, warningCount, existsCount, newCount, importableCount } =
    useMemo(() => {
      const valid = validationResults.filter((r) => r.valid).length;
      const invalid = validationResults.filter((r) => !r.valid).length;
      const warning = validationResults.filter((r) => r.warnings.length > 0).length;
      const exists = validationResults.filter((r) => r.existsInDb).length;
      const newItems = validationResults.filter((r) => r.valid && !r.existsInDb).length;
      return {
        validCount: valid,
        invalidCount: invalid,
        warningCount: warning,
        existsCount: exists,
        newCount: newItems,
        importableCount: importMode === 'insert' ? newItems : valid,
      };
    }, [validationResults, importMode]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="h-3 w-3" /> {validCount} válidos
        </Badge>
        {invalidCount > 0 && (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="h-3 w-3" /> {invalidCount} com erro
          </Badge>
        )}
        {warningCount > 0 && (
          <Badge variant="secondary" className="gap-1 text-warning">
            <AlertTriangle className="h-3 w-3" /> {warningCount} avisos
          </Badge>
        )}
        {existsCount > 0 && (
          <Badge variant="outline" className="gap-1 border-primary/30 text-primary">
            <RefreshCw className="h-3 w-3" /> {existsCount} já existem no BD
          </Badge>
        )}
        <Badge variant="outline" className="gap-1 border-success/30 text-success">
          + {newCount} novos
        </Badge>
      </div>

      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-medium">Modo de Importação</p>
        <RadioGroup
          value={importMode}
          onValueChange={(v) => setImportMode(v as ImportMode)}
          className="flex gap-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="upsert" id="mode-upsert" />
            <Label htmlFor="mode-upsert" className="cursor-pointer text-sm">
              <span className="font-medium">Upsert</span>
              <span className="ml-1 text-muted-foreground">
                — insere novos, atualiza existentes (por SKU)
              </span>
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="insert" id="mode-insert" />
            <Label htmlFor="mode-insert" className="cursor-pointer text-sm">
              <span className="font-medium">Inserir</span>
              <span className="ml-1 text-muted-foreground">
                — apenas novos ({newCount}), pula existentes
              </span>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <ScrollArea className="h-[280px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead className="w-16">Status</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>BD</TableHead>
              <TableHead>Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {validationResults.map((r) => (
              <TableRow key={r.row} className={cn(!r.valid && 'bg-destructive/5')}>
                <TableCell className="text-xs text-muted-foreground">{r.row}</TableCell>
                <TableCell>
                  {r.valid ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {r.data?.sku ||
                    (rawData[r.row - 1]?.[
                      Object.entries(mapping).find(([, v]) => v === 'sku')?.[0] ?? ''
                    ] as string) ||
                    '—'}
                </TableCell>
                <TableCell className="max-w-[180px] truncate text-sm">
                  {r.data?.name ||
                    (rawData[r.row - 1]?.[
                      Object.entries(mapping).find(([, v]) => v === 'name')?.[0] ?? ''
                    ] as string) ||
                    '—'}
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {r.data?.sale_price ? `R$ ${Number(r.data.sale_price).toFixed(2)}` : '—'}
                </TableCell>
                <TableCell>
                  {r.existsInDb ? (
                    <Badge variant="outline" className="border-primary/30 text-[10px] text-primary">
                      Existe
                    </Badge>
                  ) : r.valid ? (
                    <Badge variant="outline" className="border-success/30 text-[10px] text-success">
                      Novo
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>
                  {r.errors.length > 0 && (
                    <p className="text-[10px] text-destructive">{r.errors.join('; ')}</p>
                  )}
                  {r.warnings.length > 0 && (
                    <p className="text-[10px] text-warning">{r.warnings.join('; ')}</p>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Voltar ao Mapeamento
        </Button>
        <Button onClick={onImport} disabled={importableCount === 0}>
          Importar {importableCount} produto(s)
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
