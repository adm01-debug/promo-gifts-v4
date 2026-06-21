import { PureComponent, type ErrorInfo, type ReactNode } from 'react';
import { telemetryService } from '@/services/telemetryService';
import {
  AlertTriangle,
  RefreshCw,
  Home,
  Bug,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';
import { logger } from '@/lib/logger';
import { reportError } from '@/lib/error-reporter';
import { attemptChunkRecovery, isChunkLoadError } from '@/lib/chunk-recovery';
import { DevOnly } from '@/components/dev/DevOnly';

interface Props {
  children: ReactNode;
  /**
   * Callback opcional disparado em `componentDidCatch`, antes do logging
   * estruturado e do `reportError`.
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /**
   * Fallback custom (ReactNode) a ser renderizado quando ocorrer erro,
   * **em vez** da UI padrão full-screen. Use para casos em que o boundary
   * está embutido numa região da página (ex.: card, painel) e a UI rica
   * global seria desproporcional.
   *
   * Quando informado, todo o pipeline de auto-recovery (chunk reload,
   * cache bust, retry counter) **continua** funcionando — apenas a tela
   * final do erro é substituída.
   */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
  retryCount: number;
  isAutoRecovering: boolean;
  isClearingCache: boolean;
  copied: boolean;
}

const MAX_AUTO_RETRIES = 2;

/**
 * EnhancedErrorBoundary — **único** error boundary canônico do projeto.
 *
 * Cobre dois cenários:
 *  1. **Global** — instalado uma vez em `src/main.tsx` envolvendo `<App />`.
 *     Captura qualquer throw em render/effect que escapou de boundaries
 *     locais e mostra a UI rica full-screen com auto-recovery.
 *  2. **Local/inline** — pode ser reusado em torno de regiões específicas
 *     (cards, painéis, widgets) passando `fallback={<...>}` para uma UI
 *     mais discreta. O auto-recovery continua ativo.
 *
 * Não usar `RouteErrorBoundary` (data router) — o projeto roda com
 * `<BrowserRouter>` declarativo, onde `errorElement` é silenciosamente
 * ignorado. Veja `scripts/check-route-error-element.mjs`.
 *
 * Especializações de feature (ex.: `SimulatorErrorBoundary`) com UI/CTAs
 * próprios são permitidas — não são duplicidade do global.
 *
 * Features:
 * - Auto-recovery for chunk/import errors (stale cache)
 * - Retry counter with exponential backoff
 * - Structured error logging
 * - Elegant full-screen fallback (ou custom via `fallback` prop)
 */
class EnhancedErrorBoundary extends PureComponent<Props, State> {
  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
      retryCount: 0,
      isAutoRecovering: false,
      isClearingCache: false,
      copied: false,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Remote telemetry logging
    telemetryService.logError('React_Boundary_Error', error, {
      componentStack: errorInfo.componentStack?.slice(0, 1000),
      retryCount: this.state.retryCount,
    });

    // Structured logging
    logger.error('[GlobalErrorBoundary]', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      retryCount: this.state.retryCount,
    });

    this.props.onError?.(error, errorInfo);

    // Report to centralized error tracking
    reportError(error, {
      type: 'react_error_boundary',
      componentStack: errorInfo.componentStack?.slice(0, 1000),
      retryCount: this.state.retryCount,
    });
    if (this.isChunkError(error) && this.state.retryCount < MAX_AUTO_RETRIES) {
      this.setState({ isAutoRecovering: true });
      // Aciona recovery agressivo (hard reload + cache bust + purga SW).
      // Se o recovery atingir o limite de reloads na janela de 30s, ele
      // resolve com `false` — caímos no fallback estático abaixo em vez
      // de loop infinito (= tela branca).
      void attemptChunkRecovery(error).then((reloaded) => {
        if (!reloaded) {
          // Recovery desistiu: mostra a tela de erro com CTA manual.
          this.setState({ isAutoRecovering: false });
          return;
        }
        // Reload em andamento — mantém estado de "recuperando" até a
        // navegação substituir o documento.
        this.setState((prev) => ({ retryCount: prev.retryCount + 1 }));
      });
    }
  }

  private isChunkError(error: Error): boolean {
    return isChunkLoadError(error);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleClearCacheReload = async () => {
    // Reaproveita o pipeline de recovery (Cache API + SW + cache-bust no URL).
    // Ignora o limite de reloads aqui pois é uma ação manual do usuário.
    this.setState({ isClearingCache: true });
    try {
      // Best-effort: limpa storages locais que podem estar com dados corrompidos
      try {
        sessionStorage.clear();
      } catch {
        /* noop */
      }
      // Preserva tokens auth do supabase para não deslogar; remove apenas chaves de cache de app
      try {
        for (const key of Object.keys(localStorage)) {
          if (!key.startsWith('sb-') && !key.startsWith('supabase')) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        /* noop */
      }
      await attemptChunkRecovery(this.state.error ?? new Error('manual cache reload'));
    } finally {
      // Se attemptChunkRecovery não navegar, libera o botão
      this.setState({ isClearingCache: false });
    }
  };

  handleCopyError = async () => {
    const { error, errorInfo } = this.state;
    const payload = [
      `URL: ${typeof window !== 'undefined' ? window.location.href : 'n/a'}`,
      `Mensagem: ${error?.message ?? 'n/a'}`,
      `Stack:\n${error?.stack ?? 'n/a'}`,
      `Component Stack:${errorInfo?.componentStack ?? '\nn/a'}`,
    ].join('\n\n');
    try {
      await navigator.clipboard.writeText(payload);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      /* noop */
    }
  };

  override render() {
    if (this.state.isAutoRecovering) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="space-y-4 text-center duration-300 animate-in fade-in">
            <RotateCcw className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Recuperando automaticamente…</p>
          </div>
        </div>
      );
    }

    if (this.state.hasError) {
      // Custom fallback (modo inline) — auto-recovery acima continua ativo.
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }

      const { error, errorInfo, showDetails, retryCount, isClearingCache, copied } = this.state;
      const isChunk = error ? this.isChunkError(error) : false;
      const currentPath =
        typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';

      return (
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
          <div className="w-full max-w-md space-y-6 duration-500 animate-in fade-in slide-in-from-bottom-4">
            {/* Icon */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10">
                  <AlertTriangle className="h-10 w-10 text-destructive" />
                </div>
                <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-destructive/20">
                  <Bug className="h-3.5 w-3.5 text-destructive" />
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="space-y-2 text-center">
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                {isChunk ? 'Atualização disponível' : 'Ops! Algo deu errado'}
              </h1>
              <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
                {isChunk
                  ? 'Uma nova versão do aplicativo está disponível. Recarregue para atualizar — seus dados não serão perdidos.'
                  : error?.message?.includes('Invalid JWT') ||
                      error?.message?.includes('UNAUTHORIZED')
                    ? 'Ocorreu um problema de autenticação ou conexão com o servidor. Tente sair e entrar novamente ou limpar o cache.'
                    : 'Ocorreu um erro inesperado nesta tela. Tente recarregar, limpar o cache ou voltar ao início.'}
              </p>
              {currentPath && (
                <p className="break-all font-mono text-[11px] text-muted-foreground/70">
                  rota: {currentPath}
                </p>
              )}
              {retryCount > 0 && (
                <p className="text-xs text-muted-foreground/60">
                  Tentativas de recuperação: {retryCount}/{MAX_AUTO_RETRIES}
                </p>
              )}
            </div>

            {/* Error message — restrito a usuários `dev` (gate de infra). Não-dev veem apenas a copy amigável acima. */}
            {error?.message && (
              <DevOnly>
                <div className="space-y-2 rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-destructive/80">
                      Mensagem do erro
                    </span>
                    <button
                      onClick={this.handleCopyError}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Copiar detalhes do erro"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <p className="break-words font-mono text-sm text-destructive">{error.message}</p>
                </div>
              </DevOnly>
            )}

            {/* Actions principais */}
            <div className="flex gap-3">
              <button
                onClick={this.handleGoHome}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Home className="h-4 w-4" />
                Início
              </button>
              <button
                aria-label="Recarregar"
                onClick={this.handleReload}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RefreshCw className="h-4 w-4" />
                Recarregar
              </button>
            </div>

            {/* Limpar cache (ação destrutiva-light) */}
            <button
              onClick={this.handleClearCacheReload}
              disabled={isClearingCache}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isClearingCache ? (
                <RotateCcw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {isClearingCache ? 'Limpando cache…' : 'Limpar cache e recarregar'}
            </button>

            {/* Retry sem reload (apenas erros de render) */}
            {!isChunk && (
              <button
                onClick={this.handleRetry}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border/50 bg-background/50 px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Tentar renderizar novamente
              </button>
            )}

            {/* Technical details toggle */}
            {/* Technical details — só para dev (stack/component stack são ruído e risco para usuário final). */}
            {(errorInfo || error?.stack) && (
              <DevOnly>
                <div className="pt-2">
                  <button
                    onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                    className="inline-flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                  >
                    <span>Detalhes técnicos</span>
                    {showDetails ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>
                  {showDetails && (
                    <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {error?.stack || 'Stack trace não disponível'}
                      {errorInfo?.componentStack
                        ? `\n\nComponent Stack:${errorInfo.componentStack}`
                        : ''}
                    </pre>
                  )}
                </div>
              </DevOnly>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export { EnhancedErrorBoundary };
export default EnhancedErrorBoundary;
