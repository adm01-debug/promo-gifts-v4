/**
 * MagazineErrorBoundary — Dedicated error boundary for the Magazine module.
 *
 * Why not GlobalErrorBoundary?
 * The Magazine module has known failure modes (React #310, stale refs, RLS 403s)
 * that should be caught LOCALLY and reported with context, not crash the entire app.
 *
 * This boundary:
 * 1. Catches all React render errors in the Magazine module
 * 2. Reports to Sentry with magazine-specific context
 * 3. Shows a graceful recovery UI (try again, go back)
 * 4. Allows the rest of the app to keep running
 *
 * Usage:
 *   <MagazineErrorBoundary magazineId={id} step={step}>
 *     <MagazineEditorPage />
 *   </MagazineErrorBoundary>
 */

import { Component, type ReactNode } from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackReactError } from '@/lib/telemetry/magazineMetrics';

interface Props {
  children: ReactNode;
  magazineId?: string;
  step?: string;
  pageCount?: number;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isHooksViolation: boolean;
}

export class MagazineErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, isHooksViolation: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const isHooksViolation =
      error.message.includes('Minified React error #310') ||
      error.message.includes('rendered more hooks') ||
      error.message.includes('useMemo') ||
      error.message.includes('useCallback');

    return { hasError: true, error, isHooksViolation };
  }

  componentDidCatch(error: Error): void {
    trackReactError(error, {
      magazineId: this.props.magazineId,
      step: this.props.step,
      pageCount: this.props.pageCount,
    });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, isHooksViolation: false });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { isHooksViolation, error } = this.state;

    return (
      <div
        className="mx-auto max-w-lg p-10 text-center"
        role="alert"
        aria-live="assertive"
      >
        <AlertTriangle
          className="mx-auto mb-4 h-10 w-10 text-amber-500"
          aria-hidden
        />
        <h1 className="mb-2 text-xl font-semibold">
          {isHooksViolation ? 'Erro interno no editor' : 'Algo deu errado'}
        </h1>
        <p className="mb-2 text-sm text-muted-foreground">
          {isHooksViolation
            ? 'O editor de revistas encontrou um conflito interno. Tente recarregar a página.'
            : 'Ocorreu um erro inesperado. Tente novamente ou volte para a lista.'}
        </p>
        {import.meta.env.DEV && error && (
          <pre className="mb-4 rounded-md bg-muted p-3 text-left text-xs text-muted-foreground overflow-auto max-h-32">
            {error.message}
          </pre>
        )}
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <Button onClick={this.handleReset}>
            <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
          </Button>
        </div>
      </div>
    );
  }
}
