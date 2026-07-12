import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';
import { ColorSwatchDot, Folio, PriceTag } from '../chrome';

export function CorporateSplitTemplate({ magazine, page, totalPages }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col bg-white">
      <header
        className="flex items-center justify-between border-b-[3px] px-14 py-6"
        style={{ borderColor: 'var(--mag-primary)' }}
      >
        <div className="flex items-center gap-4">
          {magazine.branding.clientLogoUrl && (
            <img
              src={magazine.branding.clientLogoUrl}
              alt="logo"
              className="h-16 w-16 rounded-md object-contain"
            />
          )}
          <div>
            <div
              className="text-lg uppercase tracking-[0.5em] opacity-60"
              style={{ fontFamily: 'var(--mag-body)' }}
            >
              Preparado para
            </div>
            <span
              className="text-3xl font-semibold"
              style={{ color: 'var(--mag-primary)', fontFamily: 'var(--mag-heading)' }}
            >
              {magazine.branding.clientName ?? magazine.title}
            </span>
          </div>
        </div>
        <Folio index={page.index} total={totalPages} />
      </header>
      <div className="flex flex-1 flex-col">
        {page.items.slice(0, 2).map((item, idx) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          const reverse = idx % 2 === 1;
          return (
            <div
              key={item.id}
              className={`flex flex-1 ${reverse ? 'flex-row-reverse' : 'flex-row'} border-t`}
            >
              <div className="relative w-1/2 overflow-hidden bg-neutral-50">
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-cover" />
                <span
                  className="absolute left-6 top-6 rounded-sm bg-white/95 px-3 py-1 text-lg uppercase tracking-[0.35em]"
                  style={{ color: 'var(--mag-primary)' }}
                >
                  {String(idx + 1).padStart(2, '0')} · {p.category_name ?? 'Produto'}
                </span>
              </div>
              <div className="flex w-1/2 flex-col justify-center p-14">
                <div
                  className="text-xl uppercase tracking-[0.4em]"
                  style={{ color: 'var(--mag-secondary)', fontFamily: 'var(--mag-body)' }}
                >
                  {p.category_name ?? 'Coleção'}
                </div>
                <h3
                  className="mt-3 text-6xl font-semibold leading-[1.05]"
                  style={{ color: 'var(--mag-primary)', fontFamily: 'var(--mag-heading)' }}
                >
                  {p.name}
                </h3>
                {c.showDescription && p.shortDescription && (
                  <p className="mt-5 line-clamp-4 text-2xl leading-snug opacity-90">{p.shortDescription}</p>
                )}
                <div className="mt-8 flex items-end justify-between border-t pt-5">
                  <div className="space-y-1 text-2xl opacity-75">
                    {c.showCode && <div>Cód. {p.sku}</div>}
                    {c.showColors && <ColorSwatchDot item={item} />}
                  </div>
                  {c.showPrice && (
                    <PriceTag value={formatPrice(itemPrice(item))} size="lg" variant="stack" />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
