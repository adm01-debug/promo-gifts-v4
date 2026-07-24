import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';
import { ColorSwatchDot, PriceTag, SkuChip, VerticalCategoryStripe } from '../chrome';

/**
 * Grid2x3Template — 6 produtos com foto + ficha detalhada. Padrão Abreez p.377
 * com hairlines discretos, SkuChip preto e sidebar categórica.
 */
export function Grid2x3Template({ magazine, page, totalPages: _totalPages }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col bg-white pl-20 pr-12 py-12">
      <VerticalCategoryStripe
        index={page.index}
        label={page.items[0]?.productSnapshot.category_name ?? magazine.title}
      />

      <header className="mb-6 flex items-end justify-between">
        <div>
          <div
            className="text-lg uppercase tracking-[0.5em]"
            style={{ color: 'var(--mag-category-color)', fontFamily: 'var(--mag-body)' }}
          >
            Catálogo
          </div>
          <h2
            className="text-4xl font-bold"
            style={{ color: 'var(--mag-primary)', fontFamily: 'var(--mag-heading)' }}
          >
            {magazine.title}
          </h2>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-2 grid-rows-3 gap-6">
        {page.items.slice(0, 6).map((item) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          return (
            <div
              key={item.id}
              className="flex overflow-hidden"
              style={{ borderBottom: '0.5pt solid rgba(0,0,0,0.15)' }}
            >
              <div
                className="relative w-2/5 overflow-hidden"
                style={{ background: 'var(--mag-brand-cream, #f1efe7)' }}
              >
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-contain p-3" />
              </div>
              <div className="flex flex-1 flex-col justify-between p-5">
                <div>
                  <div className="flex items-center gap-2">
                    {c.showCode && <SkuChip sku={p.sku} size="sm" />}
                  </div>
                  <h3
                    className="mt-2 line-clamp-2 text-2xl font-bold leading-tight"
                    style={{ color: 'var(--mag-text)', fontFamily: 'var(--mag-heading)' }}
                  >
                    {p.name}
                  </h3>
                  {c.showColors && <div className="mt-1"><ColorSwatchDot item={item} /></div>}
                  {c.showDescription && p.shortDescription && (
                    <p className="mt-2 line-clamp-2 text-lg opacity-80">{p.shortDescription}</p>
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
