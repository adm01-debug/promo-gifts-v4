import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';
import { CalloutCard, ColorSwatchDot, Folio, PriceTag, SkuChip } from '../chrome';

/**
 * CorporateSplitTemplate — "Long-form article" (padrão Abreez p.40/p.220):
 * foto lifestyle full-bleed à esquerda + CalloutCard com storytelling B2B à direita.
 * Segundo produto abaixo, invertido, para ritmo.
 */
export function CorporateSplitTemplate({ magazine, page, totalPages }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col bg-white">
      <header
        className="flex items-center justify-between border-b-[3px] px-14 py-6"
        style={{ borderColor: 'var(--mag-primary)' }}
      >
        <div className="flex items-center gap-4">
          {magazine.branding.clientLogoUrl && (
            <img
              src={magazine.branding.clientLogoUrl}
              alt={`Logo ${magazine.branding.clientName ?? 'do cliente'}`}
              className="h-16 w-16 rounded-md object-contain"
            />
          )}
          <div>
            <div
              className="text-lg uppercase tracking-[0.5em] opacity-60"
              style={{ fontFamily: 'var(--mag-body)' }}
            >
              Preparado para
            </div>
            <span
              className="text-3xl font-semibold"
              style={{ color: 'var(--mag-primary)', fontFamily: 'var(--mag-heading)' }}
            >
              {magazine.branding.clientName ?? magazine.title}
            </span>
          </div>
        </div>
        <Folio index={page.index} total={totalPages} />
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
              <div className="relative w-2/5 overflow-hidden bg-neutral-50">
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-cover" />
              </div>
              <div className="flex w-3/5 flex-col justify-center p-14">
                <div
                  className="text-xl uppercase tracking-[0.4em]"
                  style={{ color: 'var(--mag-category-color)', fontFamily: 'var(--mag-body)' }}
                >
                  {p.category_name ?? 'Coleção'}
                </div>
                <h3
                  className="mt-3 text-5xl font-semibold leading-[1.05]"
                  style={{ color: 'var(--mag-primary)', fontFamily: 'var(--mag-heading)' }}
                >
                  {p.name}
                </h3>
                {c.showDescription && p.shortDescription && (
                  <div className="mt-5">
                    <CalloutCard tone="brand" className="text-xl">
                      {p.shortDescription}
                    </CalloutCard>
                  </div>
                )}
                <div className="mt-6 flex items-end justify-between border-t pt-5">
                  <div className="flex flex-col gap-2 text-lg opacity-75">
                    {c.showCode && <SkuChip sku={p.sku} size="sm" />}
                    {c.showColors && <ColorSwatchDot item={item} />}
                  </div>
                  {c.showPrice && (
                    <PriceTag value={formatPrice(itemPrice(item))} size="lg" variant="stack" />
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
