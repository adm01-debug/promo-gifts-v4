import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton loader that mimics the ProductDetail page layout.
 * Shows during initial product data fetch to reduce perceived loading time.
 */
export function ProductDetailSkeleton() {
  const id = "product-detail";
  return (
    <div 
      className="max-w-[1600px] mx-auto space-y-4 md:space-y-6 xl:space-y-8 animate-fade-in pb-20 md:pb-0 xl:px-4 2xl:px-8"
      data-skeleton-page={id}
    >
      {/* Intelligence badges */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-6 w-24 rounded-full" id={`${id}-badge-1`} />
        <Skeleton className="h-6 w-28 rounded-full" id={`${id}-badge-2`} />
        <Skeleton className="h-6 w-20 rounded-full" id={`${id}-badge-3`} />
      </div>

      {/* Main content grid — matches 5fr / 7fr */}
      <div className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4 lg:gap-6 xl:gap-8">
        {/* LEFT — Gallery skeleton (sticky area) */}
        <div className="space-y-3">
          <Skeleton className="w-full aspect-square rounded-xl" id={`${id}-main-image`} />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="w-14 h-14 rounded-lg shrink-0" id={`${id}-thumb-${i}`} />
            ))}
          </div>
        </div>

        {/* RIGHT — Product info */}
        <div className="flex flex-col gap-3 md:gap-4">
          {/* Category badges */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-6 w-24 rounded-full" id={`${id}-cat-1`} />
              <Skeleton className="h-6 w-20 rounded-full" id={`${id}-cat-2`} />
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-1.5">
              <Skeleton className="h-5 w-20 rounded-md" id={`${id}-status-1`} />
              <Skeleton className="h-5 w-16 rounded-md" id={`${id}-status-2`} />
              <Skeleton className="h-5 w-14 rounded-md" id={`${id}-status-3`} />
            </div>

            {/* Title */}
            <div className="space-y-1.5">
              <Skeleton className="h-7 w-[85%]" id={`${id}-title-1`} />
              <Skeleton className="h-7 w-[55%]" id={`${id}-title-2`} />
            </div>

            {/* SKU / Supplier bar */}
            <div className="flex gap-3">
              <Skeleton className="h-4 w-28" id={`${id}-sku`} />
              <Skeleton className="h-4 w-36" id={`${id}-supplier`} />
            </div>
          </div>

          {/* PRICE + SPECS — two columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 xl:gap-4">
            {/* Price card */}
            <div className="rounded-xl border border-border p-3 xl:p-5 space-y-3">
              <div>
                <Skeleton className="h-3 w-16 mb-2" id={`${id}-price-label`} />
                <Skeleton className="h-9 w-32" id={`${id}-price-value`} />
              </div>
              {/* Color swatches */}
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-14 rounded-full" id={`${id}-variant-${i}`} />
                ))}
              </div>
              {/* Info grid */}
              <div className="grid grid-cols-3 gap-1 py-1 border-y border-border/40">
                <Skeleton className="h-4 w-full" id={`${id}-info-1`} />
                <Skeleton className="h-4 w-full" id={`${id}-info-2`} />
                <Skeleton className="h-4 w-full" id={`${id}-info-3`} />
              </div>
              {/* CTA buttons */}
              <div className="flex gap-2">
                <Skeleton className="h-8 flex-1 rounded-lg" id={`${id}-cta-1`} />
                <Skeleton className="h-8 flex-1 rounded-lg" id={`${id}-cta-2`} />
              </div>
            </div>

            {/* Specs card */}
            <div className="rounded-xl border border-border p-3 xl:p-5 space-y-3">
              <Skeleton className="h-4 w-20 mb-1" id={`${id}-specs-title`} />
              <Skeleton className="h-3 w-full" id={`${id}-spec-1`} />
              <Skeleton className="h-3 w-[90%]" id={`${id}-spec-2`} />
              <Skeleton className="h-3 w-[75%]" id={`${id}-spec-3`} />
              <div className="border-t border-border/40 pt-2 space-y-2">
                <Skeleton className="h-4 w-24" id={`${id}-material-label`} />
                <div className="flex flex-wrap gap-1">
                  <Skeleton className="h-5 w-16 rounded-full" id={`${id}-mat-1`} />
                  <Skeleton className="h-5 w-20 rounded-full" id={`${id}-mat-2`} />
                </div>
                <Skeleton className="h-12 w-full rounded-lg" id={`${id}-desc-box`} />
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-9 w-28 rounded-lg" id={`${id}-action-1`} />
            <Skeleton className="h-9 w-28 rounded-lg" id={`${id}-action-2`} />
            <Skeleton className="h-9 w-28 rounded-lg" id={`${id}-action-3`} />
          </div>
        </div>
      </div>

      {/* Similar products section */}
      <div className="pt-6 border-t border-border/60 space-y-3">
        <Skeleton className="h-6 w-48" id={`${id}-similar-title`} />
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="w-full aspect-square rounded-lg" id={`${id}-similar-img-${i}`} />
              <Skeleton className="h-4 w-[80%]" id={`${id}-similar-txt-1-${i}`} />
              <Skeleton className="h-3 w-[50%]" id={`${id}-similar-txt-2-${i}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
