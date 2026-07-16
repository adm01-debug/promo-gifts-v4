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
}

export class TemplatePreviewBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    // Log leve — não integramos com Sentry aqui para não poluir
    // com erros de mock. Em produção o boundary só protege UI.
    if (import.meta.env.DEV) {
       
      console.warn('[TemplatePreviewBoundary]', this.props.templateName, error);
    }
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted p-4 text-center text-xs text-muted-foreground"
      >
        <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden />
        <span>Preview indisponível</span>
      </div>
    );
  }
}
