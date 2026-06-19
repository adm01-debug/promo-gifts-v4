/**
 * SimulatorErrorBoundary — Error boundary LOCAL do wizard de simulador.
 *
 * **Não é duplicidade** do `EnhancedErrorBoundary` global. É uma
 * especialização de feature com:
 *   - UI inline (não full-screen) para caber dentro do card do wizard;
 *   - callbacks `onReset` / `onGoBack` integrados ao stepper do simulador;
 *   - contagem de retries com mensagem específica após 3 falhas.
 *
 * Erros que escapam deste boundary continuam sendo capturados pelo
 * `EnhancedErrorBoundary` global instalado em `src/main.tsx` (com
 * auto-recovery de chunk, logging estruturado e CTAs globais).
 *
 * Captura erros de renderização e oferece retry com feedback visual.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { m as motion } from 'framer-motion';
import { reportError } from '@/lib/error-reporter';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
  onGoBack?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

export class SimulatorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('[SimulatorErrorBoundary]', {
      message: error.message,
      componentStack: errorInfo.componentStack,
    });

    reportError(error, {
      type: 'simulator_error_boundary',
      componentStack: errorInfo.componentStack?.slice(0, 1000),
      retryCount: this.state.errorCount,
    });
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorCount: prev.errorCount + 1,
    }));
    this.props.onReset?.();
  };

  override render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { fallbackTitle = 'Erro no Simulador', onGoBack } = this.props;
    const tooManyRetries = this.state.errorCount >= 3;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-lg px-4 py-16 text-center"
      >
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>

        <h3 className="mb-2 font-display text-xl font-bold">{fallbackTitle}</h3>
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          {tooManyRetries
            ? 'O erro persiste após várias tentativas. Tente recarregar a página ou voltar ao início.'
            : 'Ocorreu um erro inesperado. Isso pode ser uma falha temporária de conexão.'}
        </p>

        {this.state.error?.message && (
          <div className="mb-6 break-all rounded-lg bg-muted p-3 text-left font-mono text-xs text-muted-foreground">
            {this.state.error.message}
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-3">
          {!tooManyRetries && (
            <Button onClick={this.handleRetry} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Tentar Novamente
            </Button>
          )}
          {onGoBack && (
            <Button variant="outline" onClick={onGoBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
          )}
          {tooManyRetries && (
            <Button onClick={() => window.location.reload()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Recarregar Página
            </Button>
          )}
        </div>
      </motion.div>
    );
  }
}
