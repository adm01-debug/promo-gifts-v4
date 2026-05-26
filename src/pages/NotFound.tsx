import { useLocation, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import { Home, ArrowLeft, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error('404 Error: User attempted to access non-existent route:', location.pathname);
  }, [location.pathname]);

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

        {/* Decorative line */}
        <div className="pt-4">
          <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
      </div>
    </div>
  );
};

export default NotFound;
