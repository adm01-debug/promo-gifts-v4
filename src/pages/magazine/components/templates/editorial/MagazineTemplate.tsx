import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';
import { ColorSwatchDot, Folio, PriceTag, SkuChip, HairlineDivider } from '../chrome';

/**
 * MagazineTemplate — "Duo horizontal" (padrão Abreez p.8):
 * Página dividida em duas fatias horizontais equivalentes por hairline central.
 * Cada fatia = 1 produto (foto hero + ficha). Assimetria: alterna lado.
 */
export function MagazineTemplate({ magazine, page, totalPages }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col bg-white p-14">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <div
            className="mb-2 text-xl uppercase tracking-[0.4em]"
            style={{ color: 'var(--mag-category-color)', fontFamily: 'var(--mag-body)' }}
          >
            Edição
          </div>
          <h2
            className="text-6xl leading-none"
            style={{ fontFamily: 'var(--mag-heading)', color: 'var(--mag-primary)' }}
          >
            {magazine.title}
          </h2>
        </div>
        <Folio index={page.index} total={totalPages} />
      </header>

      <div className="flex flex-1 flex-col">
        {page.items.slice(0, 2).map((item, idx) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          const reverse = idx % 2 === 1;
          return (
            <div key={item.id} className="flex flex-1 flex-col">
              {idx > 0 && <div className="my-6"><HairlineDivider /></div>}
              <div className={`flex flex-1 gap-12 ${reverse ? 'flex-row-reverse' : ''}`}>
                <div className="relative flex-1 overflow-hidden" style={{ background: 'var(--mag-brand-cream, #f1efe7)' }}>
                  <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-contain p-6" />
                </div>
                <div className="flex w-[45%] flex-col justify-center">
                  {p.category_name && (
                    <div
                      className="mb-3 text-xl uppercase tracking-[0.5em]"
                      style={{ color: 'var(--mag-category-color)', fontFamily: 'var(--mag-body)' }}
                    >
                      {p.category_name}
                    </div>
                  )}
                  <h3
                    className="text-5xl leading-[1.05]"
                    style={{ fontFamily: 'var(--mag-heading)', color: 'var(--mag-text)' }}
                  >
                    {p.name}
                  </h3>
                  <div className="mt-4 flex items-center gap-3">
                    {c.showCode && <SkuChip sku={p.sku} size="md" />}
                    {c.showColors && <ColorSwatchDot item={item} />}
                  </div>
                  {c.showDescription && p.shortDescription && (
                    <p className="mt-5 line-clamp-4 text-2xl leading-snug opacity-90">
                      {p.shortDescription}
                    </p>
                  )}
                  <div className="mt-6 flex items-center justify-between">
                    {c.showPrice ? (
                      <PriceTag value={formatPrice(itemPrice(item))} size="md" variant="stack" />
                    ) : (
                      <span />
                    )}
                    {c.showPersonalization && p.hasPersonalization && (
                      <span
                        className="rounded-full px-4 py-1 text-lg uppercase tracking-widest text-white"
                        style={{ background: 'var(--mag-category-color)' }}
                      >
                        Personalizável
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
