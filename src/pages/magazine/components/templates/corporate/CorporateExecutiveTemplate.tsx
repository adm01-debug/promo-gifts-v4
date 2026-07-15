import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';
import { Folio, PriceTag, SkuChip, VerticalCategoryStripe } from '../chrome';

/**
 * CorporateExecutiveTemplate — 3 produtos com paleta sóbria + sidebar categórica.
 */
export function CorporateExecutiveTemplate({ magazine, page, totalPages }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col bg-white pl-20 pr-16 py-16">
      <VerticalCategoryStripe
        index={page.index}
        label={page.items[0]?.productSnapshot.category_name ?? magazine.title}
      />

      <header className="mb-12 flex items-center justify-between border-b pb-6">
        <div>
          <div
            className="text-xl uppercase tracking-[0.5em]"
            style={{ color: 'var(--mag-category-color)', fontFamily: 'var(--mag-body)' }}
          >
            Coleção Exclusiva
          </div>
          <h2
            className="mt-2 text-7xl italic leading-none"
            style={{ fontFamily: 'var(--mag-heading)', color: 'var(--mag-text)' }}
          >
            {magazine.title}
          </h2>
        </div>
        <div className="flex items-center gap-6">
          {magazine.branding.clientLogoUrl && (
            <img
              src={magazine.branding.clientLogoUrl}
              alt={`Logo ${magazine.branding.clientName ?? 'do cliente'}`}
              className="h-20 w-20 object-contain"
            />
          )}
        </div>
      </header>
      <div className="grid flex-1 grid-cols-3 gap-10">
        {page.items.slice(0, 3).map((item, idx) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          return (
            <div key={item.id} className="flex flex-col">
              <div
                className="relative mb-6 overflow-hidden"
                style={{ minHeight: 1200, background: 'var(--mag-brand-cream, #f1efe7)' }}
              >
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-contain p-4" />
                <span
                  className="absolute left-3 top-3 text-xl font-bold tabular-nums"
                  style={{ color: 'var(--mag-category-color)' }}
                >
                  Nº {String(idx + 1).padStart(2, '0')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {c.showCode && <SkuChip sku={p.sku} size="sm" />}
              </div>
              {p.category_name && (
                <div
                  className="mt-2 text-lg uppercase tracking-[0.5em] opacity-70"
                  style={{ color: 'var(--mag-category-color)', fontFamily: 'var(--mag-body)' }}
                >
                  {p.category_name}
                </div>
              )}
              <h3
                className="mt-1 text-3xl leading-tight"
                style={{ fontFamily: 'var(--mag-heading)', color: 'var(--mag-text)' }}
              >
                {p.name}
              </h3>
              {c.showDescription && p.shortDescription && (
                <p className="mt-3 line-clamp-3 text-xl leading-snug opacity-90">{p.shortDescription}</p>
              )}
              {c.showPrice && (
                <div className="mt-4">
                  <PriceTag value={formatPrice(itemPrice(item))} size="md" variant="stack" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      <footer className="mt-10 flex items-center justify-between border-t pt-5">
        <span className="text-lg uppercase tracking-[0.4em] opacity-70">
          {magazine.branding.clientName ? `Preparado para ${magazine.branding.clientName}` : 'Promo Gifts'}
        </span>
        <Folio index={page.index} total={totalPages} />
      </footer>
    </div>
  );
}
