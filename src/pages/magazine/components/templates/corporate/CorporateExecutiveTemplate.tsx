import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';

export function CorporateExecutiveTemplate({ magazine, page }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col bg-white p-16">
      <header className="mb-10 flex items-center justify-between">
        <div>
          <div className="text-xl uppercase tracking-[0.35em] opacity-70" style={{ color: 'var(--mag-secondary)' }}>
            Coleção Exclusiva
          </div>
          <h2
            className="mt-1 text-6xl italic"
            style={{ fontFamily: 'var(--mag-heading)', color: 'var(--mag-text)' }}
          >
            {magazine.title}
          </h2>
        </div>
        <div className="flex items-center gap-4">
          {magazine.branding.clientLogoUrl && (
            <img
              src={magazine.branding.clientLogoUrl}
              alt="logo"
              className="h-20 w-20 object-contain"
            />
          )}
        </div>
      </header>
      <div className="grid flex-1 grid-cols-3 gap-8">
        {page.items.slice(0, 3).map((item) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          return (
            <div key={item.id} className="flex flex-col">
              <div className="mb-6 overflow-hidden" style={{ minHeight: 1200 }}>
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-cover" />
              </div>
              <h3
                className="text-3xl leading-tight"
                style={{ fontFamily: 'var(--mag-heading)', color: 'var(--mag-text)' }}
              >
                {p.name}
              </h3>
              {c.showCode && (
                <div className="mt-2 text-xl uppercase tracking-widest opacity-70">Ref. {p.sku}</div>
              )}
              {c.showDescription && p.shortDescription && (
                <p className="mt-3 line-clamp-3 text-xl leading-snug opacity-90">{p.shortDescription}</p>
              )}
              {c.showPrice && (
                <div
                  className="mt-4 text-3xl font-semibold"
                  style={{ color: 'var(--mag-secondary)', fontFamily: 'var(--mag-heading)' }}
                >
                  {formatPrice(itemPrice(item))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <footer className="mt-8 flex items-center justify-between border-t pt-4">
        <span className="text-lg opacity-70">
          {magazine.branding.clientName ? `Preparado para ${magazine.branding.clientName}` : 'Promo Gifts'}
        </span>
        <span className="text-lg opacity-70">— {page.index + 1} —</span>
      </footer>
    </div>
  );
}
