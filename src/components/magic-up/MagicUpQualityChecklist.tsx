import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MagicUpQualityDiagnosis } from '@/pages/magic-up/magicUpStrategy';

interface MagicUpQualityChecklistProps {
  diagnosis: MagicUpQualityDiagnosis;
}

export function MagicUpQualityChecklist({ diagnosis }: MagicUpQualityChecklistProps) {
  return (
    <section className="rounded-lg border bg-muted/30 p-3" aria-label="Checklist de curadoria">
      <p className="text-sm font-semibold">Checklist comercial</p>
      <ul className="mt-2 space-y-2">
        {diagnosis.criteria.map((criterion) => (
          <li key={criterion.id} className="flex items-start gap-2 rounded-md bg-background/60 p-2">
            {criterion.passed ? (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            ) : (
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
              />
            )}
            <span className="sr-only">{criterion.passed ? 'Aprovado' : 'Reprovado'}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">{criterion.label}</span>
                <span
                  className={cn(
                    'text-[11px] font-semibold',
                    criterion.passed ? 'text-primary' : 'text-destructive',
                  )}
                  aria-label={`Score ${criterion.score} de 100`}
                >
                  {criterion.score}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{criterion.recommendation}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
