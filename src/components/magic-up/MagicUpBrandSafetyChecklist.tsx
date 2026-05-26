import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MagicUpBrandKit } from '@/pages/magic-up/magicUpStrategy';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface MagicUpBrandSafetyChecklistProps {
  kit: MagicUpBrandKit;
  hasClient: boolean;
  hasLogo: boolean;
}

export function MagicUpBrandSafetyChecklist({
  kit,
  hasClient,
  hasLogo,
}: MagicUpBrandSafetyChecklistProps) {
  const checks = [
    { label: 'Cliente selecionado', passed: hasClient },
    { label: 'Logo disponível', passed: hasLogo || kit.logoUrls.length > 0 },
    {
      label: 'Diretrizes preenchidas',
      passed: !!kit.notes.trim() || !!kit.toneOfVoice || !!kit.visualStyle,
    },
    { label: 'Cores institucionais', passed: !!kit.primaryColor || !!kit.secondaryColor },
    {
      label: 'Termos de marca',
      passed: kit.requiredWords.length > 0 || kit.forbiddenWords.length > 0,
    },
    {
      label: 'Baixo risco genérico',
      passed:
        hasClient &&
        (hasLogo || kit.logoUrls.length > 0) &&
        (!!kit.notes.trim() || !!kit.primaryColor),
    },
  ];
  const passedCount = checks.filter((check) => check.passed).length;

  return (
    <div
      className="space-y-2 rounded-lg border bg-muted/20 p-3"
      aria-label="Checklist de segurança de marca"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">Segurança da marca</p>
        <Badge variant={passedCount >= 5 ? 'secondary' : 'outline'} className="text-[10px]">
          {passedCount}/6
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {checks.map((check) => (
          <div
            key={check.label}
            className={cn(
              'flex items-center gap-1.5 text-[11px]',
              check.passed ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {check.passed ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
            )}
            <span>{check.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
