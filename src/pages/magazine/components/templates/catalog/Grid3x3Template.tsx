import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';

export function Grid3x3Template({ magazine, page }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col p-10" style={{ background: '#f8fafc' }}>
      <header
        className="mb-6 rounded-xl px-6 py-4 text-white"
        style={{ background: 'var(--mag-primary)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold uppercase tracking-wider" style={{ fontFamily: 'var(--mag-heading)' }}>
            {magazine.title}
          </h2>
          <span className="text-xl opacity-90">Página {page.index + 1}</span>
        </div>
      </header>
      <div className="grid flex-1 grid-cols-3 grid-rows-3 gap-4">
        {page.items.slice(0, 9).map((item) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          return (
            <div key={item.id} className="flex flex-col overflow-hidden rounded-lg bg-white shadow-sm">
              <div className="relative flex-1 overflow-hidden bg-gray-50">
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-contain" />
                {c.showPrice && (
                  <span
                    className="absolute right-2 top-2 rounded-md px-3 py-1 text-xl font-bold text-white"
                    style={{ background: 'var(--mag-secondary)' }}
                  >
                    {formatPrice(itemPrice(item))}
                  </span>
                )}
              </div>
              <div className="border-t p-3">
                <div
                  className="line-clamp-2 text-xl font-semibold leading-tight"
                  style={{ color: 'var(--mag-text)' }}
                >
                  {p.name}
                </div>
                {c.showCode && <div className="mt-1 text-lg opacity-70">Cód. {p.sku}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
