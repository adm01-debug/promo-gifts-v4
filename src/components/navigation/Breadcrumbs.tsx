import { Fragment } from 'react';
import { Home } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
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

const UUID_OR_SHORT_ID_RE = /^[0-9a-f-]{36}$/;
const NUMERIC_ID_RE = /^\d+$/;

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
  showHome?: boolean;
}

// Auto-generate breadcrumbs from route if items not provided
const routeLabels: Record<string, string> = {
  '': 'Início',
  produtos: 'Produtos',
  produto: 'Produto',
  clientes: 'Clientes',
  orcamentos: 'Orçamentos',
  pedidos: 'Pedidos',
  simulador: 'Simulador',
  'mockup-generator': 'Mockups',
  'magic-up': 'Magic Up',
  filtros: 'Filtros',
  favoritos: 'Favoritos',
  comparar: 'Comparar',
  colecoes: 'Coleções',
  bi: 'Estoque',
  tendencias: 'Tendências',

  perfil: 'Meu Perfil',
  seguranca: 'Segurança',
  admin: 'Administração',
  personalizacao: 'Personalização',
  permissoes: 'Permissões',
  roles: 'Papéis',
  'role-permissoes': 'Permissões de Papéis',
  'rate-limit': 'Rate Limit',
  'bitrix-sync': 'Sincronização Bitrix',
  status: 'Status do Sistema',
  novo: 'Novo',
  editar: 'Editar',
  dashboard: 'Dashboard',
  kanban: 'Kanban',
  lista: 'Lista',
  templates: 'Templates',
};

export function Breadcrumbs({ items, className, showHome = true }: BreadcrumbsProps) {
  const location = useLocation();
  const { isDev, isAdmin } = useAuth();

  // Generate breadcrumbs from route if not provided
  const breadcrumbItems: BreadcrumbItem[] =
    items || generateBreadcrumbs(location.pathname, { isDev, isAdmin });

  if (breadcrumbItems.length === 0) return null;

  return (
    <Breadcrumb className={cn('text-sm', className)}>
      <BreadcrumbList>
        {showHome && (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/" aria-label="Página inicial" className="flex items-center">
                  <Home className="h-4 w-4" />
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {breadcrumbItems.length > 0 && <BreadcrumbSeparator />}
          </>
        )}

        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;

          return (
            <Fragment key={index}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={item.href || '#'}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function generateBreadcrumbs(
  pathname: string,
  roles: { isDev: boolean; isAdmin: boolean } = { isDev: false, isAdmin: false },
): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return [];

  const breadcrumbs: BreadcrumbItem[] = [];
  let currentPath = '';

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    // Skip UUIDs or numeric IDs in breadcrumbs display
    const isId = UUID_OR_SHORT_ID_RE.test(segment) || NUMERIC_ID_RE.test(segment);

    if (isId) {
      breadcrumbs.push({
        label: `#${segment.slice(0, 8)}...`,
        href: i < segments.length - 1 ? currentPath : undefined,
      });
    } else {
      // Esconde segmentos técnicos para não-dev
      if (!roles.isDev && isDevOnlyPath(currentPath)) {
        continue;
      }
      const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
      const navigable = canNavigateTo(currentPath, roles);
      const isLast = i >= segments.length - 1;
      breadcrumbs.push({
        label,
        href: !isLast && navigable ? currentPath : undefined,
      });
    }
  }

  return breadcrumbs;
}

// Hook for custom breadcrumbs
export function useBreadcrumbs() {
  const location = useLocation();
  const { isDev, isAdmin } = useAuth();
  return generateBreadcrumbs(location.pathname, { isDev, isAdmin });
}
