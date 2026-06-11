import { useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import { Home, ArrowLeft, Gift, FileText, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { logger } from '@/lib/logger';
/**
 * NotFound — página 404 com sugestões de navegação contextuais.
 *
 * FIX: Removido console.error em produção (poluía o console de usuários
 * normais). O erro 404 já é capturado pelo EnhancedErrorBoundary e
 * pelo sistema de observabilidade.
 */
const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    // Log apenas em desenvolvimento para não poluir produção
    if (import.meta.env.DEV) {
      logger.warn('[404] Rota não encontrada:', location.pathname);
    }
  }, [location.pathname]);

  /** Sugestões de navegação baseadas na rota tentada */
  const suggestions = (() => {
    const path = location.pathname.toLowerCase();
    if (path.includes('orcamento') || path.includes('cotacao')) {
      return [{ to: '/orcamentos', label: 'Ir para Orçamentos', icon: FileText }];
    }
    if (path.includes('produto') || path.includes('catalogo')) {
      return [{ to: '/produtos', label: 'Ver Catálogo', icon: Package }];
    }
    if (path.includes('admin')) {
      return [{ to: '/admin/usuarios', label: 'Painel Admin', icon: Home }];
    }
    return [];
  })();

  return (
    <div
      className="flex min-h-screen animate-fade-in items-center justify-center bg-background p-4"
      data-testid="app-not-found"
    >
      <PageSEO title="Página não encontrada" noIndex />
      <div className="mx-auto max-w-md space-y-8 text-center">
        {/* Branding */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
            <Gift className="h-7 w-7 text-primary" />
          </div>
          <span className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Promo Gifts
          </span>
        </div>

        <div className="space-y-3">
          <h1
            data-testid="page-title-404"
            className="bg-gradient-to-br from-foreground via-foreground to-muted-foreground bg-clip-text font-display text-7xl font-bold text-transparent"
          >
            404
          </h1>
          <p className="text-xl font-medium text-foreground">Página não encontrada</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A página{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {location.pathname}
            </code>{' '}
            não existe ou foi movida.
          </p>
        </div>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild variant="default" size="lg" className="gap-2">
            <Link to="/">
              <Home className="h-4 w-4" />
              Ir para o início
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="gap-2"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>

        {/* Sugestões contextuais (quando detectadas pela URL) */}
        {suggestions.length > 0 && (
          <div className="rounded-xl border border-border bg-muted/30 p-4 text-left">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Talvez você queira:
            </p>
            <div className="flex flex-col gap-2">
              {suggestions.map((s) => (
                <Button
                  key={s.to}
                  asChild
                  variant="ghost"
                  size="sm"
                  className="justify-start gap-2"
                >
                  <Link to={s.to}>
                    <s.icon className="h-4 w-4 text-primary" />
                    {s.label}
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Decorative line */}
        <div className="pt-4">
          <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
      </div>
    </div>
  );
};

export default NotFound;
