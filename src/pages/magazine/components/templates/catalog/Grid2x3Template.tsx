import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';
import { ColorSwatchDot, Folio, PriceTag } from '../chrome';

export function Grid2x3Template({ magazine, page, totalPages }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col bg-white p-12">
      <header
        className="mb-6 flex items-center justify-between border-b-2 pb-4"
        style={{ borderColor: 'var(--mag-primary)' }}
      >
        <div className="flex items-baseline gap-4">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: 'var(--mag-secondary)' }}
            aria-hidden
          />
          <h2
            className="text-4xl font-bold"
            style={{ color: 'var(--mag-primary)', fontFamily: 'var(--mag-heading)' }}
          >
            {magazine.title}
          </h2>
        </div>
        <Folio index={page.index} total={totalPages} />
      </header>
      <div className="grid flex-1 grid-cols-2 grid-rows-3 gap-6">
        {page.items.slice(0, 6).map((item) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          return (
            <div
              key={item.id}
              className="flex overflow-hidden rounded-2xl border bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]"
              style={{ borderColor: 'rgba(0,0,0,0.08)' }}
            >
              <div className="relative w-2/5 overflow-hidden bg-neutral-50">
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-cover" />
                {p.category_name && (
                  <span
                    className="absolute left-2 top-2 rounded-sm bg-white/95 px-2 py-0.5 text-sm uppercase tracking-widest"
                    style={{ color: 'var(--mag-primary)' }}
                  >
                    {p.category_name}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col justify-between p-6">
                <div>
                  <h3
                    className="line-clamp-2 text-2xl font-bold leading-tight"
                    style={{ color: 'var(--mag-text)', fontFamily: 'var(--mag-heading)' }}
                  >
                    {p.name}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xl opacity-70">
                    {c.showCode && <span>Cód. {p.sku}</span>}
                    {c.showColors && <ColorSwatchDot item={item} />}
                  </div>
                  {c.showDescription && p.shortDescription && (
                    <p className="mt-2 line-clamp-2 text-xl opacity-90">{p.shortDescription}</p>
                  )}
                </div>
                {c.showPrice && (
                  <div className="mt-3">
                    <PriceTag value={formatPrice(itemPrice(item))} size="md" variant="stack" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
