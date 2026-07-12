import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';

export function MonoTemplate({ magazine, page }: TemplatePageProps) {
  const item = page.items[0];
  if (!item) return null;
  const c = effectiveContent(magazine.content, item.overrides);
  const p = item.productSnapshot;
  return (
    <div className="mag-page flex flex-col bg-white text-black">
      <div className="relative flex-1 overflow-hidden">
        <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-cover grayscale" />
      </div>
      <div className="grid grid-cols-12 gap-8 border-t-8 border-black bg-white p-16">
        <div className="col-span-8">
          <h2
            className="uppercase leading-[0.9]"
            style={{ fontFamily: 'var(--mag-heading)', fontSize: 140, letterSpacing: '-0.02em' }}
          >
            {p.name}
          </h2>
          {c.showDescription && p.shortDescription && (
            <p className="mt-6 max-w-[1100px] text-3xl leading-snug">{p.shortDescription}</p>
          )}
        </div>
        <div className="col-span-4 flex flex-col justify-between border-l-4 border-black pl-8">
          {c.showCode && <div className="text-3xl uppercase tracking-widest">Ref. {p.sku}</div>}
          {c.showColors && item.variantColorName && (
            <div className="text-3xl uppercase tracking-widest">{item.variantColorName}</div>
          )}
          {c.showPrice && (
            <div className="text-6xl font-black" style={{ fontFamily: 'var(--mag-heading)' }}>
              {formatPrice(itemPrice(item))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
