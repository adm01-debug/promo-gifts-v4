import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';

export function Grid2x3Template({ magazine, page }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col bg-white p-12">
      <header className="mb-6 flex items-center justify-between">
        <h2 className="text-4xl font-bold" style={{ color: 'var(--mag-primary)', fontFamily: 'var(--mag-heading)' }}>
          {magazine.title}
        </h2>
        <span className="text-2xl opacity-60">Pág. {page.index + 1}</span>
      </header>
      <div className="grid flex-1 grid-cols-2 grid-rows-3 gap-6">
        {page.items.slice(0, 6).map((item) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          return (
            <div key={item.id} className="flex overflow-hidden rounded-2xl border-2" style={{ borderColor: 'var(--mag-primary)' }}>
              <div className="w-2/5 overflow-hidden bg-gray-100">
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex flex-1 flex-col justify-between p-6">
                <div>
                  <h3
                    className="line-clamp-2 text-2xl font-bold leading-tight"
                    style={{ color: 'var(--mag-text)' }}
                  >
                    {p.name}
                  </h3>
                  {c.showCode && <div className="mt-2 text-xl opacity-70">Cód. {p.sku}</div>}
                  {c.showColors && item.variantColorName && (
                    <div className="text-xl opacity-70">Cor: {item.variantColorName}</div>
                  )}
                  {c.showDescription && p.shortDescription && (
                    <p className="mt-2 line-clamp-2 text-xl opacity-90">{p.shortDescription}</p>
                  )}
                </div>
                {c.showPrice && (
                  <div className="text-4xl font-black" style={{ color: 'var(--mag-secondary)' }}>
                    {formatPrice(itemPrice(item))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
