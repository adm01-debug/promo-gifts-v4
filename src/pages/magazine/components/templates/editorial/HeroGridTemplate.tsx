import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, productImageAlt, resolveItemImage } from '../shared';
import { Folio, PriceTag, HairlineDivider } from '../chrome';

/**
 * HeroGridTemplate — reformulado como "Section Cinemascope" (padrão Abreez p.6):
 * 4 imagens empilhadas à esquerda + moldura branca central com título + torre
 * tipográfica vertical à direita. Se houver mais produtos, vira grade abaixo.
 */
export function HeroGridTemplate({ magazine, page, totalPages }: TemplatePageProps) {
  const [hero, ...rest] = page.items;
  if (!hero) return null;
  const hc = effectiveContent(magazine.content, hero.overrides);
  const stackImages = rest.slice(0, 4);

  return (
    <div className="mag-page flex flex-col bg-white p-10">
      {/* Cinemascope 3 colunas: stack + moldura + torre */}
      <div className="mb-8 grid flex-1 grid-cols-3 gap-6" style={{ maxHeight: 1650 }}>
        {/* Coluna 1 — 4 fotos empilhadas com overlay teal */}
        <div className="grid grid-rows-4 gap-3">
          {stackImages.length > 0
            ? stackImages.map((item) => (
                <div key={item.id} className="relative overflow-hidden">
                  <img
                    src={resolveItemImage(item)}
                    alt={productImageAlt(item)}
                    className="h-full w-full object-cover"
                    style={{ filter: 'saturate(0.75) contrast(1.05)' }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{ background: 'color-mix(in srgb, var(--mag-category-color) 25%, transparent)' }}
                  />
                </div>
              ))
            : (
              <div className="row-span-4 overflow-hidden">
                <img src={resolveItemImage(hero)} alt={productImageAlt(hero)} className="h-full w-full object-cover" />
              </div>
            )}
        </div>

        {/* Coluna 2 — Moldura branca central */}
        <div className="flex items-center justify-center px-4">
          <div
            className="flex h-full w-full flex-col items-center justify-between p-8 text-center"
            style={{ border: '1px solid var(--mag-category-color)' }}
          >
            <div className="text-6xl opacity-70" style={{ color: 'var(--mag-category-color)' }}>◊</div>
            <div>
              <div
                className="text-3xl font-bold leading-tight"
                style={{ fontFamily: 'var(--mag-heading)', color: 'var(--mag-primary)' }}
              >
                {magazine.title}
              </div>
              {hero.productSnapshot.shortDescription && hc.showDescription && (
                <p className="mt-6 text-xl leading-relaxed opacity-80" style={{ fontFamily: 'var(--mag-body)' }}>
                  {hero.productSnapshot.shortDescription.slice(0, 220)}
                </p>
              )}
            </div>
            <Folio index={page.index} total={totalPages} />
          </div>
        </div>

        {/* Coluna 3 — Torre tipográfica vertical */}
        <div className="flex items-center justify-center">
          <div
            className="text-6xl font-black uppercase leading-[0.9] tracking-[0.5em]"
            style={{
              writingMode: 'vertical-rl',
              transform: 'rotate(180deg)',
              fontFamily: 'var(--mag-heading)',
              color: 'var(--mag-category-color)',
            }}
          >
            {(hero.productSnapshot.category_name ?? magazine.title).toUpperCase().slice(0, 24)}
          </div>
        </div>
      </div>

      <HairlineDivider />

      {/* Ficha do hero em rodapé */}
      <div className="mt-6 flex items-end justify-between">
        <div>
          <h2
            className="text-5xl leading-[1] max-w-[900px]"
            style={{ fontFamily: 'var(--mag-heading)', color: 'var(--mag-text)' }}
          >
            {hero.productSnapshot.name}
          </h2>
          {hc.showCode && (
            <div className="mt-2 text-xl uppercase tracking-widest opacity-70">Ref. {hero.productSnapshot.sku}</div>
          )}
        </div>
        {hc.showPrice && <PriceTag value={formatPrice(itemPrice(hero))} size="lg" variant="stack" />}
      </div>
    </div>
  );
}
