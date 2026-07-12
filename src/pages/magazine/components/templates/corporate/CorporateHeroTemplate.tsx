import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';
import { ColorSwatchDot, PriceTag } from '../chrome';

export function CorporateHeroTemplate({ magazine, page, totalPages }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col bg-white">
      <header
        className="flex items-center justify-between px-14 py-10 text-white"
        style={{
          background:
            'linear-gradient(135deg,var(--mag-primary) 0%,var(--mag-primary) 65%,color-mix(in srgb,var(--mag-primary) 70%,black) 100%)',
        }}
      >
        <div className="flex items-center gap-6">
          {magazine.branding.clientLogoUrl && (
            <img
              src={magazine.branding.clientLogoUrl}
              alt={magazine.branding.clientName ?? 'Cliente'}
              className="h-24 w-24 rounded-full bg-white object-contain p-2 ring-4 ring-white/20"
            />
          )}
          <div>
            <div
              className="text-xl uppercase tracking-[0.4em] opacity-85"
              style={{ fontFamily: 'var(--mag-body)' }}
            >
              Catálogo exclusivo para
            </div>
            <div className="mt-1 text-4xl font-bold" style={{ fontFamily: 'var(--mag-heading)' }}>
              {magazine.branding.clientName ?? magazine.title}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl uppercase tracking-[0.4em] opacity-80">Página</div>
          <div
            className="text-6xl font-bold tabular-nums"
            style={{ color: 'var(--mag-secondary)', fontFamily: 'var(--mag-heading)' }}
          >
            {String(page.index + 1).padStart(2, '0')}
            {typeof totalPages === 'number' && (
              <span className="text-3xl opacity-70"> / {String(totalPages).padStart(2, '0')}</span>
            )}
          </div>
        </div>
      </header>
      <div className="grid flex-1 grid-cols-2 grid-rows-2 gap-6 p-10">
        {page.items.slice(0, 4).map((item) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          return (
            <div
              key={item.id}
              className="flex flex-col overflow-hidden rounded-2xl border shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
              style={{ borderColor: 'rgba(0,0,0,0.08)' }}
            >
              <div className="relative flex-1 overflow-hidden bg-neutral-50">
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-cover" />
                {p.category_name && (
                  <span
                    className="absolute left-3 top-3 rounded-sm bg-white/95 px-3 py-1 text-sm uppercase tracking-widest"
                    style={{ color: 'var(--mag-primary)' }}
                  >
                    {p.category_name}
                  </span>
                )}
              </div>
              <div className="border-t p-6" style={{ background: 'white' }}>
                <h3
                  className="text-3xl font-semibold leading-tight"
                  style={{ color: 'var(--mag-primary)', fontFamily: 'var(--mag-heading)' }}
                >
                  {p.name}
                </h3>
                <div className="mt-3 flex items-center justify-between">
                  <div className="space-y-1 text-xl opacity-75">
                    {c.showCode && <div>Cód. {p.sku}</div>}
                    {c.showColors && <ColorSwatchDot item={item} />}
                  </div>
                  {c.showPrice && (
                    <PriceTag value={formatPrice(itemPrice(item))} size="md" variant="chip" />
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
