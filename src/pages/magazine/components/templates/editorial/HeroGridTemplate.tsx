import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';

export function HeroGridTemplate({ magazine, page }: TemplatePageProps) {
  const [hero, ...rest] = page.items;
  if (!hero) return null;
  const hc = effectiveContent(magazine.content, hero.overrides);
  return (
    <div className="mag-page flex flex-col bg-white p-14">
      <div className="mb-8 flex items-center justify-between">
        <span className="text-2xl uppercase tracking-widest opacity-70" style={{ fontFamily: 'var(--mag-body)' }}>
          {hero.productSnapshot.category_name ?? 'Destaques'}
        </span>
        <span className="text-2xl opacity-70">— {page.index + 1} —</span>
      </div>
      <div className="relative mb-8 overflow-hidden" style={{ height: 1300 }}>
        <img src={resolveItemImage(hero)} alt={hero.productSnapshot.name} className="h-full w-full object-cover" />
        <div className="absolute inset-x-10 bottom-10 flex items-end justify-between text-white drop-shadow-lg">
          <h2 className="max-w-[70%] leading-[0.95]" style={{ fontFamily: 'var(--mag-heading)', fontSize: 130 }}>
            {hero.productSnapshot.name}
          </h2>
          {hc.showPrice && (
            <span
              className="text-6xl font-bold"
              style={{ color: 'var(--mag-secondary)', fontFamily: 'var(--mag-heading)' }}
            >
              {formatPrice(itemPrice(hero))}
            </span>
          )}
        </div>
      </div>
      <div className="grid flex-1 grid-cols-4 gap-6">
        {rest.slice(0, 4).map((item) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          return (
            <div key={item.id} className="flex flex-col">
              <div className="mb-3 flex-1 overflow-hidden" style={{ minHeight: 420 }}>
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-cover" />
              </div>
              <div
                className="text-2xl font-semibold leading-tight"
                style={{ fontFamily: 'var(--mag-heading)', color: 'var(--mag-text)' }}
              >
                {p.name}
              </div>
              {c.showCode && <div className="text-xl opacity-70">Cód. {p.sku}</div>}
              {c.showPrice && (
                <div className="mt-1 text-2xl font-bold" style={{ color: 'var(--mag-secondary)' }}>
                  {formatPrice(itemPrice(item))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
