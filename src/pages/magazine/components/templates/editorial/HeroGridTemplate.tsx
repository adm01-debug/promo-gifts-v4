import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';
import { Folio, PriceTag } from '../chrome';

export function HeroGridTemplate({ magazine, page, totalPages }: TemplatePageProps) {
  const [hero, ...rest] = page.items;
  if (!hero) return null;
  const hc = effectiveContent(magazine.content, hero.overrides);
  return (
    <div className="mag-page flex flex-col bg-white p-14">
      <div className="mb-8 flex items-center justify-between">
        <span
          className="text-2xl uppercase tracking-[0.4em]"
          style={{ color: 'var(--mag-secondary)', fontFamily: 'var(--mag-body)' }}
        >
          {hero.productSnapshot.category_name ?? 'Destaques'}
        </span>
        <Folio index={page.index} total={totalPages} />
      </div>
      <div className="relative mb-8 overflow-hidden" style={{ height: 1300 }}>
        <img src={resolveItemImage(hero)} alt={hero.productSnapshot.name} className="h-full w-full object-cover" />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg,transparent 45%,rgba(0,0,0,0.65))' }}
        />
        <div className="absolute inset-x-10 bottom-10 flex items-end justify-between text-white">
          <h2
            className="max-w-[70%] leading-[0.9]"
            style={{ fontFamily: 'var(--mag-heading)', fontSize: 140, letterSpacing: '-0.03em' }}
          >
            {hero.productSnapshot.name}
          </h2>
          {hc.showPrice && <PriceTag value={formatPrice(itemPrice(hero))} size="lg" variant="stack" />}
        </div>
      </div>
      <div className="grid flex-1 grid-cols-4 gap-6">
        {rest.slice(0, 4).map((item) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          return (
            <div key={item.id} className="flex flex-col">
              <div className="mb-3 flex-1 overflow-hidden bg-neutral-100" style={{ minHeight: 420 }}>
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-cover" />
              </div>
              <div
                className="line-clamp-2 text-2xl font-semibold leading-tight"
                style={{ fontFamily: 'var(--mag-heading)', color: 'var(--mag-text)' }}
              >
                {p.name}
              </div>
              {c.showCode && <div className="mt-1 text-xl opacity-70">Cód. {p.sku}</div>}
              {c.showPrice && (
                <div className="mt-2">
                  <PriceTag value={formatPrice(itemPrice(item))} size="sm" variant="stack" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
