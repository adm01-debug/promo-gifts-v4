/**
 * QuoteConcurrencyAlert — alerta visual de edição simultânea.
 *
 * Renderiza um banner não-obstrutivo informando que outro usuário
 * modificou o orçamento enquanto estava aberto. Oferece duas ações:
 * - "Recarregar" → descarta alterações locais e puxa versão mais recente
 * - "Salvar mesmo assim" → continua o fluxo normal (overwrite)
 */
import { AlertTriangle, RefreshCw, Save } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { ConflictInfo } from '@/hooks/quotes/useQuoteConcurrencyGuard';

interface QuoteConcurrencyAlertProps {
  conflict: ConflictInfo;
  onReload: () => void;
  onOverwrite: () => void;
  /** Se true, desabilita botões enquanto o save está em andamento */
  isLoading?: boolean;
}

export function QuoteConcurrencyAlert({
  conflict,
  onReload,
  onOverwrite,
  isLoading = false,
}: QuoteConcurrencyAlertProps) {
  return (
    <Alert
      variant="destructive"
      className="border-amber-500/50 bg-amber-500/10 text-amber-700 animate-in slide-in-from-top-2 dark:text-amber-400"
      role="alert"
      aria-live="assertive"
    >
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertTitle className="text-amber-700 dark:text-amber-300">
        Orçamento modificado enquanto estava aberto
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Este orçamento foi atualizado por outra sessão em{' '}
          <strong className="font-semibold">{conflict.label}</strong>. Suas alterações locais podem
          entrar em conflito.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-amber-500/50 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
            onClick={onReload}
            disabled={isLoading}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Recarregar versão mais recente
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
            onClick={onOverwrite}
            disabled={isLoading}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Salvar mesmo assim
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
