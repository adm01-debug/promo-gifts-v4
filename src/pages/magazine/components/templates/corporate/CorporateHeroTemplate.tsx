import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';

export function CorporateHeroTemplate({ magazine, page }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col bg-white">
      <header
        className="flex items-center justify-between px-14 py-10 text-white"
        style={{ background: 'var(--mag-primary)' }}
      >
        <div className="flex items-center gap-6">
          {magazine.branding.clientLogoUrl && (
            <img
              src={magazine.branding.clientLogoUrl}
              alt={magazine.branding.clientName ?? 'Cliente'}
              className="h-24 w-24 rounded-full bg-white object-contain p-2"
            />
          )}
          <div>
            <div className="text-2xl opacity-80" style={{ fontFamily: 'var(--mag-body)' }}>
              Catálogo exclusivo para
            </div>
            <div className="text-4xl font-bold" style={{ fontFamily: 'var(--mag-heading)' }}>
              {magazine.branding.clientName ?? magazine.title}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl opacity-80">Página</div>
          <div className="text-5xl font-bold" style={{ color: 'var(--mag-secondary)' }}>
            {page.index + 1}
          </div>
        </div>
      </header>
      <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-6 p-10">
        {page.items.slice(0, 4).map((item) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          return (
            <div key={item.id} className="flex flex-col overflow-hidden rounded-2xl border shadow-sm">
              <div className="flex-1 overflow-hidden bg-gray-50">
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-cover" />
              </div>
              <div className="border-t p-6" style={{ background: 'white' }}>
                <h3 className="text-3xl font-semibold leading-tight" style={{ color: 'var(--mag-primary)' }}>
                  {p.name}
                </h3>
                <div className="mt-2 flex items-center justify-between">
                  <div className="space-y-1">
                    {c.showCode && <div className="text-xl opacity-70">Cód. {p.sku}</div>}
                    {c.showColors && item.variantColorName && (
                      <div className="text-xl opacity-70">Cor: {item.variantColorName}</div>
                    )}
                  </div>
                  {c.showPrice && (
                    <div
                      className="rounded-md px-3 py-1 text-3xl font-bold text-white"
                      style={{ background: 'var(--mag-secondary)' }}
                    >
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
