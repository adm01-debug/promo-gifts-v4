import { forwardRef, useCallback, Fragment } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Home, Zap, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigationAnalytics } from '@/hooks/useNavigationAnalytics';
import { canNavigateTo, isDevOnlyPath } from '@/lib/navigation/restricted-routes';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC_ID_RE = /^\d+$/;

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: typeof Home;
}

const routeLabels: Record<string, string> = {
  '/': 'Início',
  '/produtos': 'Produtos',
  '/produto': 'Detalhe do Produto',
  '/filtros': 'Super Filtro',
  '/novidades': 'Novidades',
  '/colecoes': 'Coleções',
  '/orcamentos': 'Orçamentos',
  '/simulador': 'Simulador',
  '/simulador-precos': 'Preços por Tiragem',
  '/mockup-generator': 'Gerador de Mockups',
  '/magic-up': 'Magic Up',
  '/favoritos': 'Favoritos',
  '/comparar': 'Comparar',

  '/configuracoes': 'Configurações',
  '/admin': 'Administração',
  '/seguranca': 'Segurança',
  '/estoque': 'Estoque',
  '/admin/temas': 'Skins',
};

interface PersistentBreadcrumbsProps {
  className?: string;
  showHome?: boolean;
  showBackButton?: boolean;
  customItems?: BreadcrumbItem[];
}

export const PersistentBreadcrumbs = forwardRef<HTMLElement, PersistentBreadcrumbsProps>(
  ({ className, showHome = true, showBackButton = false, customItems }, ref) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { isDev, isAdmin } = useAuth();
    const { trackNavigationClick } = useNavigationAnalytics();

    const handleBack = useCallback(() => {
      const destination = window.history.length > 2 ? 'previous_page' : '/';
      trackNavigationClick('Teletransporte', destination);
      if (window.history.length > 2) {
        navigate(-1);
      } else {
        navigate('/');
      }
    }, [navigate, trackNavigationClick]);

    const handleHomeClick = useCallback(() => {
      trackNavigationClick('Início', '/');
    }, [trackNavigationClick]);

    const buildBreadcrumbs = (): BreadcrumbItem[] => {
      if (customItems) return customItems;

      const items: BreadcrumbItem[] = [];
      const pathParts = location.pathname.split('/').filter(Boolean);

      if (location.pathname === '/' && showHome) {
        return [{ label: 'Catálogo de Produtos', icon: Home }];
      }

      if (showHome && location.pathname !== '/') {
        items.push({ label: 'Início', href: '/', icon: Home });
      }

      let currentPath = '';
      pathParts.forEach((part, index) => {
        currentPath += `/${part}`;
        const isUuid = UUID_RE.test(part);
        const isNumericId = NUMERIC_ID_RE.test(part);

        if (isUuid || isNumericId) {
          const prevPart = pathParts[index - 1];
          if (prevPart === 'produto' || prevPart === 'produtos' || prevPart === 'orcamentos') {
            return;
          }
          items.push({ label: `#${part.slice(0, 8)}...` });
        } else {
          if (!isDev && isDevOnlyPath(currentPath)) {
            return;
          }

          const label = routeLabels[currentPath] || part.charAt(0).toUpperCase() + part.slice(1);
          const nextPart = pathParts[index + 1];
          const nextIsSkippedId =
            nextPart &&
            (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nextPart) ||
              /^\d+$/.test(nextPart)) &&
            (part === 'produto' || part === 'produtos' || part === 'orcamentos');

          const navigable = canNavigateTo(currentPath, { isDev, isAdmin });
          const isLastVisible = index >= pathParts.length - 1 || nextIsSkippedId;
          items.push(isLastVisible || !navigable ? { label } : { label, href: currentPath });
        }
      });

      return items;
    };

    const breadcrumbs = buildBreadcrumbs();
    if (breadcrumbs.length === 0) return null;

    const isNotHome = location.pathname !== '/';

    return (
      <TooltipProvider>
        <nav
          ref={ref}
          data-testid="breadcrumb"
          aria-label="Breadcrumb"
          className={cn(
            'scrollbar-hide flex max-w-full items-center gap-3 overflow-x-auto text-sm',
            className,
          )}
        >
          {showBackButton && isNotHome && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleBack}
                  aria-label="Teletransporte — Voltar"
                  className="group flex h-7 flex-shrink-0 items-center justify-center gap-1.5 rounded-full border border-border/40 bg-muted/60 px-3 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-border hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  data-testid="back-teleport-button"
                >
                  <Zap className="h-3.5 w-3.5 text-sky-400 group-hover:animate-pulse" />
                  <span className="inline">Teletransporte</span>
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                className="max-w-[200px] text-xs"
                data-testid="teleport-tooltip-content"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-semibold text-sky-400">
                    <Zap className="h-3 w-3" />
                    <span>Teletransporte</span>
                  </div>
                  <p className="leading-relaxed text-muted-foreground">
                    Retorna para a <strong>página anterior</strong> que você visitou. Diferente do
                    Início, ele mantém seu progresso anterior.
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((item, index) => {
                const Icon = item.icon;
                const isLast = index === breadcrumbs.length - 1;
                const isHome = item.label === 'Início' || item.label === 'Catálogo de Produtos';

                const content = (
                  <div className="flex items-center gap-1.5">
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    <span>{item.label}</span>
                    {isHome && index === 0 && (
                      <Info className="h-3 w-3 opacity-40 transition-opacity group-hover:opacity-100" />
                    )}
                  </div>
                );

                const itemElement = item.href ? (
                  <BreadcrumbLink asChild>
                    <Link
                      to={item.href}
                      className="group"
                      onClick={isHome ? handleHomeClick : undefined}
                      data-testid={isHome ? 'home-breadcrumb-link' : undefined}
                    >
                      {content}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="group">{content}</BreadcrumbPage>
                );

                return (
                  <Fragment key={`${item.href ?? item.label}-${index}`}>
                    {isHome && index === 0 ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <BreadcrumbItem className="cursor-help">{itemElement}</BreadcrumbItem>
                        </TooltipTrigger>
                        <TooltipContent
                          side="bottom"
                          className="max-w-[200px] text-xs"
                          data-testid="inicio-tooltip-content"
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 font-semibold text-primary">
                              <Home className="h-3 w-3" />
                              <span>Início</span>
                            </div>
                            <p className="leading-relaxed text-muted-foreground">
                              Leva você de volta ao <strong>Catálogo (Home)</strong>. Use para
                              recomeçar sua busca do zero, ignorando o histórico.
                            </p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <BreadcrumbItem>{itemElement}</BreadcrumbItem>
                    )}
                    {!isLast && <BreadcrumbSeparator />}
                  </Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        </nav>
      </TooltipProvider>
    );
  },
);
