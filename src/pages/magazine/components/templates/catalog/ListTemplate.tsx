import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';
import { ColorSwatchDot, PriceTag, SkuChip, VerticalCategoryStripe } from '../chrome';

/**
 * ListTemplate — 5 produtos em lista. Padrão Abreez p.377: faixa cinza-escura
 * como header de cada item com nome do acabamento em branco bold.
 */
export function ListTemplate({ magazine, page, totalPages: _totalPages }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col bg-white pl-20 pr-14 py-14">
      <VerticalCategoryStripe
        index={page.index}
        label={page.items[0]?.productSnapshot.category_name ?? magazine.title}
      />

      <header className="mb-8 flex items-end justify-between">
        <div>
          <div
            className="text-xl uppercase tracking-[0.5em]"
            style={{ color: 'var(--mag-category-color)', fontFamily: 'var(--mag-body)' }}
          >
            Coleção
          </div>
          <h2
            className="mt-1 text-5xl font-bold leading-none"
            style={{ color: 'var(--mag-primary)', fontFamily: 'var(--mag-heading)' }}
          >
            {magazine.title}
          </h2>
          {magazine.subtitle && <div className="mt-2 text-2xl opacity-80">{magazine.subtitle}</div>}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4">
        {page.items.slice(0, 5).map((item) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          return (
            <div key={item.id} className="overflow-hidden">
              {/* Header cinza escuro (padrão p.377) */}
              <div
                className="flex items-center justify-between px-4 py-2 text-white"
                style={{ background: 'var(--mag-brand-charcoal, #5a5a5a)' }}
              >
                <span
                  className="text-lg font-bold uppercase tracking-widest"
                  style={{ fontFamily: 'var(--mag-body)' }}
                >
                  {p.name.slice(0, 60)}
                </span>
                {c.showCode && (
                  <span
                    className="text-lg font-medium opacity-80"
                    style={{ fontFamily: 'var(--mag-body)' }}
                  >
                    Cód. {p.sku}
                  </span>
                )}
              </div>
              <div
className="grid grid-cols-12 gap-4 border-x border-b p-4"
                style={{ borderColor: 'rgba(0,0,0,0.15)' }}
              >
                <div
                  className="col-span-3 overflow-hidden"
                  style={{ background: 'var(--mag-brand-cream, #f1efe7)', minHeight: 260 }}
                >
                  <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-contain p-2" />
                </div>
                <div className="col-span-6 flex flex-col justify-center">
                  {p.category_name && (
                    <div
                      className="text-lg uppercase tracking-[0.4em]"
                      style={{ color: 'var(--mag-category-color)', fontFamily: 'var(--mag-body)' }}
                    >
                      {p.category_name}
                    </div>
                  )}
                  {c.showDescription && p.shortDescription && (
                    <p className="mt-2 line-clamp-3 text-xl leading-snug opacity-90">{p.shortDescription}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {c.showColors && item.variantColorName && (
                      <ColorSwatchDot item={item} />
                    )}
                    {c.showMaterials &&
                      p.materials.slice(0, 3).map((m) => (
                        <span key={m} className="rounded-full border px-3 py-0.5 text-lg opacity-80">
                          {m}
                        </span>
                      ))}
                    {c.showPersonalization && p.hasPersonalization && (
                      <SkuChip sku="PERSONALIZÁVEL" size="sm" />
                    )}
                  </div>
                </div>
                <div className="col-span-3 flex flex-col items-end justify-center gap-2">
                  {c.showPrice && <PriceTag value={formatPrice(itemPrice(item))} size="lg" variant="stack" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
