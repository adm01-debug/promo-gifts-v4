import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';
import { PageNumberBadge, SkuChip, VerticalCategoryStripe } from '../chrome';

/**
 * Grid3x3Template — 9 produtos densos. Padrão Abreez p.90:
 * hairlines discretos + SkuChip preto + sidebar vertical categórica.
 */
export function Grid3x3Template({ magazine, page, totalPages: _totalPages }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col bg-white pl-20 pr-10 py-10">
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
            {magazine.branding.clientName ?? 'Coleção'}
          </div>
          <h2
            className="mt-1 text-4xl font-bold"
            style={{ color: 'var(--mag-primary)', fontFamily: 'var(--mag-heading)' }}
          >
            {magazine.title}
          </h2>
        </div>
        <PageNumberBadge index={page.index} size="sm" />
      </header>

      <div
        className="grid flex-1 grid-cols-3 grid-rows-3"
        style={{ borderTop: '0.5pt solid rgba(0,0,0,0.15)', borderLeft: '0.5pt solid rgba(0,0,0,0.15)' }}
      >
        {page.items.slice(0, 9).map((item) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          return (
            <div
              key={item.id}
              className="flex flex-col bg-white p-3"
              style={{
                borderRight: '0.5pt solid rgba(0,0,0,0.15)',
                borderBottom: '0.5pt solid rgba(0,0,0,0.15)',
              }}
            >
              <div
                className="relative flex-1 overflow-hidden"
                style={{ background: 'var(--mag-brand-cream, #f1efe7)' }}
              >
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-contain p-2" />
              </div>
              <div className="mt-3 flex items-start justify-between gap-2">
                {c.showCode && <SkuChip sku={p.sku} size="sm" />}
                {c.showPrice && (
                  <span
                    className="text-xl font-black leading-tight"
                    style={{ color: 'var(--mag-category-color)', fontFamily: 'var(--mag-heading)' }}
                  >
                    {formatPrice(itemPrice(item))}
                  </span>
                )}
              </div>
              <div
                className="mt-2 line-clamp-2 text-lg font-semibold leading-tight"
                style={{ color: 'var(--mag-text)', fontFamily: 'var(--mag-heading)' }}
              >
                {p.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
