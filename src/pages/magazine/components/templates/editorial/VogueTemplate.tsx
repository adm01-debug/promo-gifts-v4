import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';

export function VogueTemplate({ magazine, page }: TemplatePageProps) {
  const item = page.items[0];
  if (!item) return null;
  const c = effectiveContent(magazine.content, item.overrides);
  const p = item.productSnapshot;
  return (
    <div
      className="mag-page relative overflow-hidden"
      style={{ background: 'var(--mag-bg, #fafafa)' }}
    >
      <img
        src={resolveItemImage(item)}
        alt={p.name}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: 'brightness(0.85)' }}
      />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,transparent 40%,rgba(0,0,0,0.6))' }} />
      <div className="relative flex h-full flex-col justify-end p-32 text-white">
        {p.category_name && (
          <div className="mb-10 text-3xl uppercase tracking-[0.4em]" style={{ fontFamily: 'var(--mag-body)' }}>
            {p.category_name}
          </div>
        )}
        <h1
          className="mb-12 leading-[0.95]"
          style={{ fontFamily: 'var(--mag-heading)', fontSize: 200, letterSpacing: '-0.03em' }}
        >
          {p.name}
        </h1>
        {c.showDescription && p.shortDescription && (
          <p className="max-w-[1200px] text-4xl leading-snug" style={{ fontFamily: 'var(--mag-body)' }}>
            {p.shortDescription}
          </p>
        )}
        <div className="mt-16 flex items-end justify-between">
          <div className="space-y-2">
            {c.showCode && <div className="text-3xl opacity-80">Código {p.sku}</div>}
            {c.showColors && item.variantColorName && (
              <div className="text-3xl opacity-80">Cor: {item.variantColorName}</div>
            )}
          </div>
          {c.showPrice && (
            <div
              className="text-7xl font-semibold"
              style={{ fontFamily: 'var(--mag-heading)', color: 'var(--mag-secondary)' }}
            >
              {formatPrice(itemPrice(item))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
