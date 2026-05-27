import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ProductGridSkeleton,
  TableSkeleton,
  StatsCardSkeleton,
  PageHeaderSkeleton,
  DashboardSkeleton as ModernDashboardSkeleton,
  ProductDetailSkeleton as ModernProductDetailSkeleton,
  ClientCardSkeleton,
  QuoteCardSkeleton,
} from '@/components/loading/ModernSkeletons';
import { SkeletonMonitor } from '@/components/loading/SkeletonMonitor';

/**
 * Helper para criar skeletons como forwardRef divs.
 */
type SkeletonRootProps = React.HTMLAttributes<HTMLDivElement>;

function makeSkeleton(displayName: string, render: () => React.ReactNode, rootClassName: string) {
  const Cmp = React.forwardRef<HTMLDivElement, SkeletonRootProps>(({ className, ...rest }, ref) => (
    <SkeletonMonitor name={displayName}>
      <div ref={ref} className={[rootClassName, className].filter(Boolean).join(' ')} {...rest}>
        {render()}
      </div>
    </SkeletonMonitor>
  ));
  Cmp.displayName = displayName;
  return Cmp;
}

/** Catalog / Products page skeleton */
export const CatalogSkeleton = makeSkeleton(
  'Catalog',
  () => (
    <div className="flex flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="flex gap-3">
        <Skeleton className="h-10 w-full max-w-md rounded-lg" />
        <Skeleton className="h-10 w-10 rounded-lg" />
        <Skeleton className="h-10 w-10 rounded-lg" />
      </div>
      <ProductGridSkeleton count={15} columns={5} />
    </div>
  ),
  'p-3 sm:p-4 lg:p-6 space-y-6',
);

/** Product detail page skeleton */
export const ProductDetailSkeleton = makeSkeleton(
  'ProductDetail',
  () => <ModernProductDetailSkeleton />,
  'p-3 sm:p-4 lg:p-6',
);

/** Quotes list page skeleton */
export const QuotesSkeleton = makeSkeleton(
  'Quotes',
  () => (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-full" />
        ))}
      </div>
      <div className="grid gap-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <QuoteCardSkeleton key={i} />
        ))}
      </div>
    </div>
  ),
  'p-3 sm:p-4 lg:p-6',
);

/** Clients (CRM) skeleton */
export const ClientsSkeleton = makeSkeleton(
  'Clients',
  () => (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
      </div>
      <div className="grid gap-3">
        {[1, 2, 3, 4].map((i) => (
          <ClientCardSkeleton key={i} />
        ))}
      </div>
    </div>
  ),
  'p-3 sm:p-4 lg:p-6',
);

/** Admin pages skeleton */
export const AdminSkeleton = makeSkeleton(
  'Admin',
  () => (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>
      <TableSkeleton rows={10} columns={5} />
    </div>
  ),
  'p-3 sm:p-4 lg:p-6',
);

/** Dashboard / home skeleton */
export const DashboardSkeleton = makeSkeleton(
  'Dashboard',
  () => <ModernDashboardSkeleton />,
  'p-3 sm:p-4 lg:p-6',
);

/** Tools page skeleton */
export const ToolsSkeleton = makeSkeleton(
  'Tools',
  () => (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="flex justify-center gap-2 py-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-2 w-12 rounded-full" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Skeleton className="aspect-video w-full rounded-2xl" />
        </div>
        <div className="space-y-4 lg:col-span-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  ),
  'p-3 sm:p-4 lg:p-6',
);

/** Generic page skeleton */
export const GenericSkeleton = makeSkeleton(
  'Generic',
  () => (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  ),
  'p-3 sm:p-4 lg:p-6',
);

/** Auth / login page skeleton */
export const AuthSkeleton = makeSkeleton(
  'Auth',
  () => (
    <div className="w-full max-w-sm space-y-5">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="space-y-3 pt-2">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    </div>
  ),
  'min-h-[60vh] flex items-center justify-center p-6',
);

/** Modal loading skeleton */
export const ModalSkeleton = makeSkeleton(
  'Modal',
  () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <div className="space-y-3 pt-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  ),
  'p-6',
);

/**
 * Returns the appropriate skeleton component based on the current route.
 */
export function getFallback(pathname: string): React.ReactNode {
  if (pathname.startsWith('/produto/')) return <ProductDetailSkeleton />;
  if (
    pathname === '/produtos' ||
    pathname === '/filtros' ||
    pathname === '/' ||
    pathname === '/novidades' ||
    pathname === '/reposicao' ||
    pathname === '/favoritos' ||
    pathname === '/comparar' ||
    pathname.startsWith('/colecoes') ||
    pathname.startsWith('/carrinhos')
  )
    return <CatalogSkeleton />;
  if (pathname.startsWith('/orcamentos')) return <QuotesSkeleton />;
  if (pathname.startsWith('/clientes')) return <ClientsSkeleton />;
  if (pathname.startsWith('/admin') || pathname === '/status') return <AdminSkeleton />;
  if (pathname === '/dashboard') return <DashboardSkeleton />;

  if (
    pathname.startsWith('/auth') ||
    pathname === '/login' ||
    pathname === '/reset-password' ||
    pathname === '/forgot-password-confirmation' ||
    pathname === '/unauthorized'
  )
    return <AuthSkeleton />;

  if (
    pathname === '/mockup-generator' ||
    pathname === '/montar-kit' ||
    pathname === '/simulador' ||
    pathname === '/magic-up' ||
    pathname === '/simulador-precos' ||
    pathname === '/busca-preco' ||
    pathname === '/estoque' ||
    pathname === '/raio-x' ||
    pathname.startsWith('/ferramentas/') ||
    pathname.startsWith('/inteligencia') ||
    pathname === '/meus-kits' ||
    pathname.startsWith('/mockups/')
  )
    return <ToolsSkeleton />;
  return <GenericSkeleton />;
}
