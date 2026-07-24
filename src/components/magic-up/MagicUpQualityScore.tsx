import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { MagicUpQualityDiagnosis } from '@/pages/magic-up/magicUpStrategy';

interface MagicUpQualityScoreProps {
  diagnosis: MagicUpQualityDiagnosis;
  aspectRatio?: string;
}

export function MagicUpQualityScore({ diagnosis, aspectRatio }: MagicUpQualityScoreProps) {
  const tone =
    diagnosis.total >= 88
      ? 'text-primary'
      : diagnosis.total >= 75
        ? 'text-foreground'
        : diagnosis.total >= 60
          ? 'text-muted-foreground'
          : 'text-destructive';

  return (
    <section
      className="rounded-lg border border-primary/20 bg-primary/5 p-3"
      aria-label="Diagnóstico Magic Score"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Magic Score</p>
          <p
            className={cn('text-2xl font-bold leading-tight', tone)}
            aria-label={`Score ${diagnosis.total} de 100`}
          >
            {diagnosis.total}/100
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge
            variant="secondary"
            aria-label={`Origem do diagnóstico: ${diagnosis.source === 'ai' ? 'Inteligência Artificial' : 'Heurístico'}`}
          >
            {diagnosis.source === 'ai' ? 'IA' : 'Heurístico'}
          </Badge>
          {aspectRatio && (
            <span
              className="text-[10px] text-muted-foreground"
              aria-label={`Formato ${aspectRatio}`}
            >
              {aspectRatio}
            </span>
          )}
        </div>
      </div>
      <Progress
        value={diagnosis.total}
        className="mt-2 h-2"
        aria-label="Magic Score"
        aria-valuenow={diagnosis.total}
        aria-valuemin={0}
        aria-valuemax={100}
      />
      <div className="mt-2 space-y-1">
        <p className="text-xs font-medium text-foreground">{diagnosis.label}</p>
        <p className="text-xs text-muted-foreground">{diagnosis.summary}</p>
      </div>
    </section>
  );
}
