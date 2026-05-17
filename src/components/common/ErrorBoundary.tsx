import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-[400px] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight mb-2">Ops! Algo deu errado.</h2>
          <p className="text-muted-foreground max-w-md mb-8">
            Ocorreu um erro inesperado ao processar esta página. Nossa equipe técnica já foi notificada.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="default" onClick={this.handleReset} className="gap-2">
              <RefreshCcw className="w-4 h-4" />
              Tentar novamente
            </Button>
            <Button variant="outline" onClick={this.handleGoHome} className="gap-2">
              <Home className="w-4 h-4" />
              Voltar ao Início
            </Button>
          </div>
          
          {process.env.NODE_ENV === "development" && (
            <div className="mt-8 p-4 bg-muted rounded-lg text-left max-w-2xl w-full overflow-auto">
              <p className="text-xs font-mono text-destructive mb-2 font-bold uppercase tracking-wider">Debug Info:</p>
              <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">
                {this.state.error?.stack || this.state.error?.message}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
