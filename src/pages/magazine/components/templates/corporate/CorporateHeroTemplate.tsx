import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';
import { ColorSwatchDot, PriceTag, SkuChip, VerticalCategoryStripe } from '../chrome';

/**
 * CorporateHeroTemplate — capa com logo do cliente + 4 produtos.
 * Adota sidebar categórica e SkuChip do padrão Abreez.
 */
export function CorporateHeroTemplate({ magazine, page, totalPages }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col bg-white">
      <VerticalCategoryStripe
        index={page.index}
        label={page.items[0]?.productSnapshot.category_name ?? magazine.title}
      />

      <header
        className="ml-20 flex items-center justify-between px-14 py-10 text-white"
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
              className="h-24 w-24 rounded-lg bg-white object-contain p-2 ring-2 ring-white/20"
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
      <div className="ml-20 grid flex-1 grid-cols-2 grid-rows-2 gap-6 p-10">
        {page.items.slice(0, 4).map((item) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          return (
            <div
              key={item.id}
              className="flex flex-col overflow-hidden"
              style={{ border: '0.5pt solid rgba(0,0,0,0.15)' }}
            >
              <div
                className="relative flex-1 overflow-hidden"
                style={{ background: 'var(--mag-brand-cream, #f1efe7)' }}
              >
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-contain p-3" />
              </div>
              <div className="border-t p-5" style={{ background: 'white' }}>
                <div className="mb-2 flex items-center gap-2">
                  {c.showCode && <SkuChip sku={p.sku} size="sm" />}
                </div>
                <h3
                  className="text-2xl font-semibold leading-tight"
                  style={{ color: 'var(--mag-primary)', fontFamily: 'var(--mag-heading)' }}
                >
                  {p.name}
                </h3>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-lg opacity-75">
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
