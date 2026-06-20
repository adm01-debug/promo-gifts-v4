import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * ErrorBoundary — catches render errors so a single broken component
 * doesn't crash the entire page. Provides a retry button to reset state.
 */
export class ErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : 'Erro desconhecido ao renderizar este componente.';
    return { hasError: true, errorMessage: message };
  }

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Algo deu errado</p>
            <p className="max-w-sm text-xs text-muted-foreground">{this.state.errorMessage}</p>
          </div>
          <Button variant="outline" size="sm" onClick={this.handleRetry} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
