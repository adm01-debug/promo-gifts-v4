import { useMemo, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, X, AlertTriangle, Loader2, Shield } from 'lucide-react';
import { usePasswordBreachCheck } from '@/hooks/auth';
import { useDebounce } from '@/hooks/common';

interface PasswordStrengthIndicatorProps {
  password: string;
  className?: string;
  onStrengthChange?: (isStrong: boolean) => void;
}

interface StrengthCriteria {
  label: string;
  met: boolean;
}

export function PasswordStrengthIndicator({ 
  password, 
  className,
  onStrengthChange 
}: PasswordStrengthIndicatorProps) {
  const { isBreached, count, isChecking, checkPassword, reset } = usePasswordBreachCheck();
  const debouncedPassword = useDebounce(password, 500);
  const [hasCheckedBreach, setHasCheckedBreach] = useState(false);

  // Check for breached password when password changes (debounced)
  useEffect(() => {
    if (debouncedPassword && debouncedPassword.length >= 8) {
      checkPassword(debouncedPassword).then(() => {
        setHasCheckedBreach(true);
      });
    } else {
      reset();
      setHasCheckedBreach(false);
    }
  }, [debouncedPassword, checkPassword, reset]);

  const analysis = useMemo(() => {
    const criteria: StrengthCriteria[] = [
      { label: 'Mínimo 8 caracteres', met: password.length >= 8 },
      { label: 'Letra maiúscula', met: /[A-Z]/.test(password) },
      { label: 'Letra minúscula', met: /[a-z]/.test(password) },
      { label: 'Número', met: /[0-9]/.test(password) },
      { label: 'Caractere especial (!@#$%^&*)', met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
    ];

    const score = criteria.filter(c => c.met).length;
    const allMet = criteria.every(c => c.met);
    
    let strength: 'empty' | 'weak' | 'fair' | 'good' | 'strong' = 'empty';
    let color = 'bg-muted';
    let label = '';

    if (password.length === 0) {
      strength = 'empty';
    } else if (score <= 2) {
      strength = 'weak';
      color = 'bg-destructive';
      label = 'Fraca';
    } else if (score === 3) {
      strength = 'fair';
      color = 'bg-warning';
      label = 'Razoável';
    } else if (score === 4) {
      strength = 'good';
      color = 'bg-warning';
      label = 'Boa';
    } else {
      strength = 'strong';
      color = 'bg-success';
      label = 'Forte';
    }

    return { criteria, score, strength, color, label, allMet };
  }, [password]);

  // Notify parent about strength
  useEffect(() => {
    if (onStrengthChange) {
      const isStrong = analysis.allMet && !isBreached && hasCheckedBreach;
      onStrengthChange(isStrong);
    }
  }, [analysis.allMet, isBreached, hasCheckedBreach, onStrengthChange]);

  if (password.length === 0) {
    return null;
  }

  const formatBreachCount = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className={cn('space-y-3', className)} data-testid="password-strength-indicator">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Força da senha</span>
          <span className={cn(
            'text-xs font-medium',
            analysis.strength === 'weak' && 'text-destructive',
            analysis.strength === 'fair' && 'text-warning',
            analysis.strength === 'good' && 'text-warning',
            analysis.strength === 'strong' && 'text-success'
          )}>
            {analysis.label}
          </span>
        </div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((segment) => (
            <div
              key={segment}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-all duration-300',
                segment <= analysis.score ? analysis.color : 'bg-muted'
              )}
            />
          ))}
        </div>
      </div>

      {/* Criteria checklist */}
      <div className="grid grid-cols-2 gap-1.5">
        {analysis.criteria.map((criterion) => (
          <div
            key={criterion.label}
            data-testid={`password-criterion-${criterion.label.toLowerCase().replace(/\s+/g, '-')}`}
            className={cn(
              'flex items-center gap-1.5 text-xs transition-colors',
              criterion.met ? 'text-success' : 'text-muted-foreground'
            )}
          >
            {criterion.met ? (
              <Check className="h-3 w-3 flex-shrink-0" />
            ) : (
              <X className="h-3 w-3 flex-shrink-0" />
            )}
            <span>{criterion.label}</span>
          </div>
        ))}
      </div>

      {/* Breach check */}
      {password.length >= 8 && (
        <div className={cn(
          'flex items-start gap-2 p-2.5 rounded-lg border text-xs',
          isChecking && 'bg-muted/50 border-muted',
          isBreached && 'bg-destructive/10 border-destructive/30',
          !isChecking && !isBreached && hasCheckedBreach && 'bg-success/10 border-success/30'
        )}>
          {isChecking ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Verificando em base de vazamentos...</span>
            </>
          ) : isBreached ? (
            <>
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-medium text-destructive">Senha vazada!</p>
                <p className="text-muted-foreground">
                  Esta senha apareceu em {count ? formatBreachCount(count) : 'vários'} vazamentos de dados. 
                  Escolha outra senha mais segura.
                </p>
              </div>
            </>
          ) : hasCheckedBreach ? (
            <>
              <Shield className="h-4 w-4 text-success flex-shrink-0" />
              <span className="text-success">Senha não encontrada em vazamentos conhecidos</span>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
