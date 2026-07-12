import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';
import { Folio, PrintingChip, SkuChip } from '../chrome';

/**
 * MonoTemplate — 1 produto B&W com ficha estruturada "info stack"
 * (padrão Abreez p.7): SKU chip → nome bold → 3 linhas metadata → printing chip.
 */
export function MonoTemplate({ magazine, page, totalPages }: TemplatePageProps) {
  const item = page.items[0];
  if (!item) return null;
  const c = effectiveContent(magazine.content, item.overrides);
  const p = item.productSnapshot;
  return (
    <div className="mag-page flex flex-col bg-white text-black">
      <div className="relative flex-1 overflow-hidden bg-black">
        <img
          src={resolveItemImage(item)}
          alt={p.name}
          className="h-full w-full object-cover grayscale"
          style={{ filter: 'grayscale(1) contrast(1.08)' }}
        />
        <div className="absolute inset-x-14 top-14 flex items-center justify-between text-white mix-blend-difference">
          <span className="text-2xl uppercase tracking-[0.5em]" style={{ fontFamily: 'var(--mag-body)' }}>
            {p.category_name ?? magazine.title}
          </span>
          <Folio index={page.index} total={totalPages} tone="light" />
        </div>
      </div>
      <div className="grid grid-cols-12 gap-8 border-t-[10px] border-black bg-white p-16">
        <div className="col-span-8">
          <h2
            className="uppercase leading-[0.88]"
            style={{ fontFamily: 'var(--mag-heading)', fontSize: 150, letterSpacing: '-0.025em' }}
          >
            {p.name}
          </h2>
          {c.showDescription && p.shortDescription && (
            <p className="mt-8 max-w-[1100px] text-3xl leading-snug">{p.shortDescription}</p>
          )}
          {/* Printing chips (info stack style) */}
          {c.showPersonalization && p.hasPersonalization && (
            <div className="mt-6 flex flex-wrap gap-2">
              <PrintingChip label="UV Printing" />
              <PrintingChip label="Screen Printing" />
              <PrintingChip label="Laser Engraving" />
            </div>
          )}
        </div>
        <div className="col-span-4 flex flex-col justify-between border-l-[6px] border-black pl-10">
          <div className="space-y-4">
            {c.showCode && (
              <div>
                <div className="text-lg uppercase tracking-[0.5em] opacity-60">Referência</div>
                <div className="mt-1"><SkuChip sku={p.sku} size="lg" /></div>
              </div>
            )}
            {c.showColors && item.variantColorName && (
              <div>
                <div className="text-lg uppercase tracking-[0.5em] opacity-60">Cor</div>
                <div className="mt-1 text-3xl font-black uppercase">{item.variantColorName}</div>
              </div>
            )}
            {c.showDimensions && p.dimensions && (
              <div>
                <div className="text-lg uppercase tracking-[0.5em] opacity-60">Tamanho</div>
                <div className="mt-1 text-xl">
                  {[p.dimensions.width_cm, p.dimensions.height_cm, p.dimensions.length_cm]
                    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
                    .join(' × ')} cm
                </div>
              </div>
            )}
          </div>
          {c.showPrice && (
            <div>
              <div className="text-lg uppercase tracking-[0.5em] opacity-60">A partir de</div>
              <div
                className="mt-2 text-7xl font-black leading-none"
                style={{ fontFamily: 'var(--mag-heading)' }}
              >
                {formatPrice(itemPrice(item))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
