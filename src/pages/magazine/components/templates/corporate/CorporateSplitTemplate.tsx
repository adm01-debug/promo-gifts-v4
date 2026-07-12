import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';

export function CorporateSplitTemplate({ magazine, page }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col bg-white">
      <header
        className="flex items-center justify-between border-b-4 px-14 py-6"
        style={{ borderColor: 'var(--mag-primary)' }}
      >
        <div className="flex items-center gap-4">
          {magazine.branding.clientLogoUrl && (
            <img
              src={magazine.branding.clientLogoUrl}
              alt="logo"
              className="h-16 w-16 object-contain"
            />
          )}
          <span className="text-3xl font-semibold" style={{ color: 'var(--mag-primary)' }}>
            {magazine.branding.clientName ?? magazine.title}
          </span>
        </div>
        <span className="text-2xl opacity-70">Página {page.index + 1}</span>
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
              <div className="w-1/2 overflow-hidden bg-gray-50">
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex w-1/2 flex-col justify-center p-14">
                <div className="text-2xl uppercase tracking-widest opacity-70">
                  {p.category_name ?? '—'}
                </div>
                <h3
                  className="mt-3 text-6xl font-semibold leading-tight"
                  style={{ color: 'var(--mag-primary)', fontFamily: 'var(--mag-heading)' }}
                >
                  {p.name}
                </h3>
                {c.showDescription && p.shortDescription && (
                  <p className="mt-4 line-clamp-4 text-2xl leading-snug">{p.shortDescription}</p>
                )}
                <div className="mt-6 flex items-end justify-between">
                  <div className="space-y-1">
                    {c.showCode && <div className="text-2xl opacity-70">Cód. {p.sku}</div>}
                    {c.showColors && item.variantColorName && (
                      <div className="text-2xl opacity-70">Cor: {item.variantColorName}</div>
                    )}
                  </div>
                  {c.showPrice && (
                    <div className="text-5xl font-black" style={{ color: 'var(--mag-secondary)' }}>
                      {formatPrice(itemPrice(item))}
                    </div>
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
