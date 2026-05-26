import { forwardRef, useCallback, Fragment } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { canNavigateTo, isDevOnlyPath } from '@/lib/navigation/restricted-routes';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

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
  function PersistentBreadcrumbs(
    { className, showHome = true, showBackButton = false, customItems },
    ref,
  ) {
    const location = useLocation();
    const navigate = useNavigate();
    const { isDev, isAdmin } = useAuth();

    const handleBack = useCallback(() => {
      if (window.history.length > 2) {
        navigate(-1);
      } else {
        navigate('/');
      }
    }, [navigate]);

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
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part);
        const isNumericId = /^\d+$/.test(part);

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
          <button
            onClick={handleBack}
            aria-label="Teletransporte — Voltar"
            title="Teletransporte"
            className="group hidden h-7 flex-shrink-0 items-center justify-center gap-1.5 rounded-full border border-border/40 bg-muted/60 px-3 text-xs font-medium text-muted-foreground transition-all duration-200 hover:border-border hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:inline-flex"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 group-hover:animate-pulse"
            >
              <circle cx="12" cy="5" r="2.5" fill="currentColor" stroke="none" />
              <path d="M10 10h4v6h-4z" fill="currentColor" stroke="none" />
              <rect
                x="10"
                y="17"
                width="1.5"
                height="3"
                rx="0.5"
                fill="currentColor"
                stroke="none"
              />
              <rect
                x="12.5"
                y="17"
                width="1.5"
                height="3"
                rx="0.5"
                fill="currentColor"
                stroke="none"
              />
              <ellipse cx="12" cy="8" rx="6" ry="1.5" className="opacity-70" />
              <ellipse cx="12" cy="13" rx="5" ry="1.3" className="opacity-50" />
              <ellipse cx="12" cy="17.5" rx="4.5" ry="1.2" className="opacity-30" />
            </svg>
            <span className="hidden md:inline">Teletransporte</span>
          </button>
        )}

        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((item, index) => {
              const Icon = item.icon;
              const isLast = index === breadcrumbs.length - 1;

              return (
                <Fragment key={`${item.href ?? item.label}-${index}`}>
                  <BreadcrumbItem>
                    {item.href ? (
                      <BreadcrumbLink asChild>
                        <Link to={item.href} className="flex items-center gap-1.5">
                          {Icon && <Icon className="h-3.5 w-3.5" />}
                          <span>{item.label}</span>
                        </Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="flex items-center gap-1.5">
                        {Icon && <Icon className="h-3.5 w-3.5" />}
                        <span>{item.label}</span>
                      </BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator />}
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </nav>
    );
  },
);
