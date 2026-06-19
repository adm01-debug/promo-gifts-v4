import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TARGET_FIELDS, type ColumnMapping, type TargetFieldKey } from './types';

interface StepMappingProps {
  headers: string[];
  rawData: Array<Record<string, unknown>>;
  mapping: ColumnMapping;
  setMapping: (fn: (prev: ColumnMapping) => ColumnMapping) => void;
  requiredMapped: boolean;
  isCheckingSkus: boolean;
  onBack: () => void;
  onValidate: () => void;
}

export function StepMapping({
  headers,
  rawData,
  mapping,
  setMapping,
  requiredMapped,
  isCheckingSkus,
  onBack,
  onValidate,
}: StepMappingProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {headers.length} colunas • {rawData.length.toLocaleString()} linhas
        </span>
        <span className={cn(!requiredMapped && 'text-destructive')}>
          {requiredMapped
            ? '✓ Campos obrigatórios mapeados'
            : '⚠ Mapeie os campos obrigatórios (*)'}
        </span>
      </div>
      <ScrollArea className="h-[400px] pr-2">
        <div className="space-y-2">
          {headers.map((col) => {
            const sample = rawData
              .slice(0, 3)
              .map((r) => String(r[col] ?? ''))
              .filter(Boolean)
              .join(' | ');
            return (
              <div key={col} className="flex items-center gap-3 rounded-lg border bg-card p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{col}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {sample || '(vazio)'}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                <Select
                  value={mapping[col] || '_none'}
                  onValueChange={(v) =>
                    setMapping((prev) => ({
                      ...prev,
                      [col]: v === '_none' ? '' : (v as TargetFieldKey),
                    }))
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Ignorar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— Ignorar —</SelectItem>
                    {TARGET_FIELDS.map((f) => {
                      const alreadyUsed = Object.entries(mapping).some(
                        ([k, v]) => v === f.key && k !== col,
                      );
                      return (
                        <SelectItem key={f.key} value={f.key} disabled={alreadyUsed}>
                          {f.label} {f.required && '*'} {alreadyUsed && '(em uso)'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button onClick={onValidate} disabled={!requiredMapped || isCheckingSkus}>
          {isCheckingSkus ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verificando SKUs...
            </>
          ) : (
            <>
              Validar Dados
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
