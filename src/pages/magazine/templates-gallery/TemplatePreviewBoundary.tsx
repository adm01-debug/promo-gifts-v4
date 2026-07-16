/**
 * TemplatePreviewBoundary — Error boundary local para render de template.
 *
 * Um template pode lançar em runtime se o mock estiver inconsistente,
 * ou se uma dependência (fonts, imagens) falhar. Encapsulamos o render
 * para não quebrar o card inteiro / a galeria toda.
 */

import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  templateName?: string;
}

interface State {
  hasError: boolean;
  retryKey: number;
}

export class TemplatePreviewBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryKey: 0 };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    if (import.meta.env.DEV) {
      console.warn('[TemplatePreviewBoundary]', this.props.templateName, error);
    }
  }

  private readonly handleRetry = (): void => {
    this.setState((s) => ({ hasError: false, retryKey: s.retryKey + 1 }));
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return <div key={this.state.retryKey}>{this.props.children}</div>;
    }
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted p-4 text-center text-xs text-muted-foreground"
      >
        <AlertTriangle className="h-5 w-5 text-muted-foreground" aria-hidden />
        <span>Preview indisponível</span>
        <button
          type="button"
          onClick={this.handleRetry}
          className="mt-1 rounded-md border border-border bg-background px-3 py-1 text-xs font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Tentar novamente
        </button>
      </div>
    );
  }
}
