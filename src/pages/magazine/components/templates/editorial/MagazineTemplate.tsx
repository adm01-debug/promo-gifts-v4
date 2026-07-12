import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';
import { ColorSwatchDot, Folio, PriceTag, Rule } from '../chrome';

export function MagazineTemplate({ magazine, page, totalPages }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col bg-white p-16">
      <header
        className="mb-12 flex items-end justify-between border-b-[3px] pb-8"
        style={{ borderColor: 'var(--mag-primary)' }}
      >
        <div>
          <div
            className="mb-2 text-xl uppercase tracking-[0.4em]"
            style={{ color: 'var(--mag-secondary)', fontFamily: 'var(--mag-body)' }}
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
      <div className="grid flex-1 grid-cols-2 gap-14">
        {page.items.map((item) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          return (
            <article key={item.id} className="flex flex-col">
              <div className="relative flex-1 overflow-hidden bg-neutral-100" style={{ minHeight: 900 }}>
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-cover" />
                {p.category_name && (
                  <span
                    className="absolute left-4 top-4 rounded-sm bg-white/95 px-3 py-1 text-lg uppercase tracking-widest"
                    style={{ color: 'var(--mag-primary)', fontFamily: 'var(--mag-body)' }}
                  >
                    {p.category_name}
                  </span>
                )}
              </div>
              <div className="pt-6">
                <h3
                  className="text-5xl leading-[1.05]"
                  style={{ fontFamily: 'var(--mag-heading)', color: 'var(--mag-text)' }}
                >
                  {p.name}
                </h3>
                <div className="mt-3 flex items-center gap-3 text-xl opacity-70">
                  {c.showCode && <span>Cód. {p.sku}</span>}
                  {c.showCode && c.showColors && item.variantColorName && <Rule />}
                  {c.showColors && <ColorSwatchDot item={item} />}
                </div>
                {c.showDescription && p.shortDescription && (
                  <p className="mt-4 line-clamp-4 text-2xl leading-snug opacity-90">{p.shortDescription}</p>
                )}
                <div className="mt-6 flex items-center justify-between">
                  {c.showPrice ? (
                    <PriceTag value={formatPrice(itemPrice(item))} size="md" variant="stack" />
                  ) : (
                    <span />
                  )}
                  {c.showPersonalization && p.hasPersonalization && (
                    <span
                      className="rounded-full px-4 py-1 text-xl uppercase tracking-widest text-white"
                      style={{ background: 'var(--mag-primary)' }}
                    >
                      Personalizável
                    </span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
