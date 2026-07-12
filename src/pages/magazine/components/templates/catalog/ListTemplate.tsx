import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';
import { ColorSwatchDot, Folio, PriceTag } from '../chrome';

export function ListTemplate({ magazine, page, totalPages }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col bg-white p-14">
      <header
        className="mb-8 flex items-end justify-between border-b-2 pb-5"
        style={{ borderColor: 'var(--mag-primary)' }}
      >
        <div>
          <div
            className="text-xl uppercase tracking-[0.5em]"
            style={{ color: 'var(--mag-secondary)', fontFamily: 'var(--mag-body)' }}
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
        <Folio index={page.index} total={totalPages} />
      </header>
      <div className="flex flex-1 flex-col gap-6">
        {page.items.slice(0, 5).map((item, idx) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          return (
            <div key={item.id} className="grid grid-cols-12 gap-6 border-b pb-6">
              <div
                className="col-span-3 overflow-hidden rounded-lg bg-neutral-50 relative"
                style={{ minHeight: 320 }}
              >
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-cover" />
                <span
                  className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-0.5 text-lg font-bold tabular-nums"
                  style={{ color: 'var(--mag-primary)' }}
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>
              </div>
              <div className="col-span-6 flex flex-col justify-center">
                {p.category_name && (
                  <div
                    className="text-lg uppercase tracking-[0.4em]"
                    style={{ color: 'var(--mag-secondary)', fontFamily: 'var(--mag-body)' }}
                  >
                    {p.category_name}
                  </div>
                )}
                <h3
                  className="mt-1 text-3xl font-bold leading-tight"
                  style={{ color: 'var(--mag-text)', fontFamily: 'var(--mag-heading)' }}
                >
                  {p.name}
                </h3>
                {c.showCode && <div className="mt-1 text-xl opacity-70">Cód. {p.sku}</div>}
                {c.showDescription && p.shortDescription && (
                  <p className="mt-2 line-clamp-3 text-2xl leading-snug opacity-90">{p.shortDescription}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {c.showColors && item.variantColorName && (
                    <span className="rounded-full border px-3 py-1 text-lg">
                      <ColorSwatchDot item={item} />
                    </span>
                  )}
                  {c.showMaterials &&
                    p.materials.slice(0, 3).map((m) => (
                      <span key={m} className="rounded-full border px-3 py-1 text-lg opacity-80">
                        {m}
                      </span>
                    ))}
                  {c.showPersonalization && p.hasPersonalization && (
                    <span
                      className="rounded-full px-3 py-1 text-lg uppercase tracking-widest text-white"
                      style={{ background: 'var(--mag-primary)' }}
                    >
                      Personalizável
                    </span>
                  )}
                </div>
              </div>
              <div className="col-span-3 flex flex-col items-end justify-center gap-2">
                {c.showPrice && <PriceTag value={formatPrice(itemPrice(item))} size="lg" variant="stack" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
