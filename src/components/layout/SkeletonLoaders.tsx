import * as React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "@/components/products/ProductCardSkeleton";
import { 
  TableSkeleton, 
  StatsCardSkeleton, 
  ChartSkeleton, 
  PageHeaderSkeleton 
} from "@/components/loading/SkeletonShimmer";
import { SkeletonMonitor } from "@/components/loading/SkeletonMonitor";

/**
 * Helper para criar skeletons como forwardRef divs.
 */
type SkeletonRootProps = React.HTMLAttributes<HTMLDivElement>;

function makeSkeleton(
  displayName: string,
  render: () => React.ReactNode,
  rootClassName: string,
) {
  const Cmp = React.forwardRef<HTMLDivElement, SkeletonRootProps>(
    ({ className, ...rest }, ref) => (
      <SkeletonMonitor name={displayName}>
        <div
          ref={ref}
          className={[rootClassName, className].filter(Boolean).join(" ")}
          {...rest}
        >
          {render()}
        </div>
      </SkeletonMonitor>
    ),
  );
  Cmp.displayName = displayName;
  return Cmp;
}

/** Catalog / Products page skeleton */
export const CatalogSkeleton = makeSkeleton(
  "Catalog",
  () => (
    <>
      <div className="flex flex-col gap-6">
        <PageHeaderSkeleton />
        {/* Toolbar simulator */}
        <div className="flex gap-3">
          <Skeleton className="h-10 w-full max-w-md rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-10 w-10 rounded-lg" />
        </div>
        <ProductGridSkeleton count={10} columns={5} />
      </div>
    </>
  ),
  "p-3 sm:p-4 lg:p-6 space-y-6",
);

/** Product detail page skeleton */
export const ProductDetailSkeleton = makeSkeleton(
  "ProductDetail",
  () => (
    <div className="space-y-8">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Left: Image & Thumbnails */}
        <div className="space-y-4">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-20 rounded-lg" />
            ))}
          </div>
        </div>
        {/* Right: Info */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-4 w-1/4" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="space-y-4 pt-4 border-t border-border/60">
            <Skeleton className="h-12 w-full rounded-lg" />
            <div className="flex gap-4">
              <Skeleton className="h-14 flex-1 rounded-xl" />
              <Skeleton className="h-14 flex-1 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  ),
  "p-3 sm:p-4 lg:p-6",
);

/** Quotes list page skeleton */
export const QuotesSkeleton = makeSkeleton(
  "Quotes",
  () => (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-9 w-28 rounded-full" />
        ))}
      </div>
      <TableSkeleton rows={8} columns={6} />
    </div>
  ),
  "p-3 sm:p-4 lg:p-6",
);

/** Clients (CRM) skeleton */
export const ClientsSkeleton = makeSkeleton(
  "Clients",
  () => (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
      <TableSkeleton rows={10} columns={5} />
    </div>
  ),
  "p-3 sm:p-4 lg:p-6",
);

/** Admin pages skeleton */
export const AdminSkeleton = makeSkeleton(
  "Admin",
  () => (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>
      <TableSkeleton rows={10} columns={5} />
    </div>
  ),
  "p-3 sm:p-4 lg:p-6",
);

/** Dashboard / home skeleton */
export const DashboardSkeleton = makeSkeleton(
  "Dashboard",
  () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartSkeleton />
        </div>
        <div>
          <TableSkeleton rows={6} columns={3} />
        </div>
      </div>
    </div>
  ),
  "p-3 sm:p-4 lg:p-6",
);

/** Tools page skeleton (Mockup, Kit Builder, Simulador) */
export const ToolsSkeleton = makeSkeleton(
  "Tools",
  () => (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="flex gap-2 justify-center py-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-2 w-12 rounded-full" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <Skeleton className="aspect-video w-full rounded-2xl" />
        </div>
        <div className="lg:col-span-4 space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  ),
  "p-3 sm:p-4 lg:p-6",
);

/** Profile page skeleton */
export const ProfileSkeleton = makeSkeleton(
  "Profile",
  () => (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-6">
        <Skeleton className="h-24 w-24 rounded-full" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-4 border border-border/60 rounded-xl space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  ),
  "p-3 sm:p-4 lg:p-6",
);

/** Generic page skeleton (fallback) */
export const GenericSkeleton = makeSkeleton(
  "Generic",
  () => (
    <div className="space-y-6">
      <PageHeaderSkeleton />
      <div className="space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    </div>
  ),
  "p-3 sm:p-4 lg:p-6",
);

/** Auth / login page skeleton — leve, card centralizado */
export const AuthSkeleton = makeSkeleton(
  "Auth",
  () => (
    <div className="w-full max-w-sm space-y-5">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="space-y-3 pt-2">
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
      <Skeleton className="h-4 w-32 mx-auto" />
    </div>
  ),
  "min-h-[60vh] flex items-center justify-center p-6",
);

/** Modal loading skeleton */
export const ModalSkeleton = makeSkeleton(
  "Modal",
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
  "p-6",
);

/**

 * Returns the appropriate skeleton component based on the current route.
 */
export function getFallback(pathname: string): React.ReactNode {
  if (pathname.startsWith("/produto/")) return <ProductDetailSkeleton />;
  if (
    pathname === "/produtos" ||
    pathname === "/filtros" ||
    pathname === "/" ||
    pathname === "/novidades" ||
    pathname === "/reposicao" ||
    pathname === "/favoritos"
  )
    return <CatalogSkeleton />;
  if (pathname.startsWith("/orcamentos")) return <QuotesSkeleton />;
  if (pathname.startsWith("/clientes")) return <ClientsSkeleton />;
  if (pathname.startsWith("/admin") || pathname === "/status")
    return <AdminSkeleton />;
  if (pathname === "/dashboard") return <DashboardSkeleton />;

  if (
    pathname.startsWith("/auth") ||
    pathname === "/login" ||
    pathname === "/reset-password" ||
    pathname === "/forgot-password-confirmation" ||
    pathname === "/unauthorized"
  )
    return <AuthSkeleton />;

  if (
    pathname === "/mockup-generator" ||
    pathname === "/montar-kit" ||
    pathname === "/simulador" ||
    pathname === "/magic-up" ||
    pathname === "/simulador-precos" ||
    pathname === "/busca-preco"
  )
    return <ToolsSkeleton />;
  return <GenericSkeleton />;
}
