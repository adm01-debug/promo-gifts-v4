import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, productImageAlt, resolveItemImage } from '../shared';
import { PriceTag, SkuChip, VerticalCategoryStripe } from '../chrome';

/**
 * GiftSetShowcaseTemplate — "Case study composto" (padrão Abreez p.340):
 * hero da composição completa à esquerda + tabela "Product includes" à direita +
 * rail de variações de cor + ficha do set. Ideal para kits do Kit Maker.
 */
export function GiftSetShowcaseTemplate({ magazine, page }: TemplatePageProps) {
  const [hero, ...rest] = page.items;
  if (!hero) return null;
  const c = effectiveContent(magazine.content, hero.overrides);
  const p = hero.productSnapshot;
  const included = rest.slice(0, 4);
  const variations = rest.slice(4, 7);

  return (
    <div className="mag-page flex flex-col bg-white pl-20 pr-14 py-14">
      <VerticalCategoryStripe
        index={page.index}
        label={p.category_name ?? magazine.title}
      />

      {/* Header — nome do gift set */}
      <header className="mb-8">
        <div
          className="text-lg uppercase tracking-[0.5em]"
          style={{ color: 'var(--mag-category-color)', fontFamily: 'var(--mag-body)' }}
        >
          Gift Set
        </div>
        <h2
          className="mt-1 text-5xl font-bold leading-tight"
          style={{ color: 'var(--mag-primary)', fontFamily: 'var(--mag-heading)' }}
        >
          {p.name}
        </h2>
      </header>

      {/* Grid principal — hero foto + tabela includes */}
      <div className="grid flex-1 grid-cols-12 gap-10">
        <div
          className="col-span-7 relative overflow-hidden"
          style={{ background: 'var(--mag-brand-cream, #f1efe7)' }}
        >
          <img src={resolveItemImage(hero)} alt={p.name} className="h-full w-full object-contain p-6" />
        </div>

        <div className="col-span-5 flex flex-col justify-between">
          <div>
            <div
              className="mb-4 border-b pb-3 text-2xl font-bold uppercase tracking-widest"
              style={{ color: 'var(--mag-primary)', fontFamily: 'var(--mag-body)' }}
            >
              Product includes
            </div>
            <table className="w-full text-2xl">
              <tbody>
                {included.length > 0 ? (
                  included.map((it) => (
                    <tr key={it.id} className="border-b" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
                      <td className="w-32 py-3 pr-3">
                        <SkuChip sku={it.productSnapshot.sku} size="sm" />
                      </td>
                      <td className="py-3">
                        <span
                          className="font-medium"
                          style={{ color: 'var(--mag-text)', fontFamily: 'var(--mag-body)' }}
                        >
                          {it.productSnapshot.name}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-3 opacity-60">
                      Adicione produtos secundários para compor o gift set.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Ficha do set */}
          <div className="mt-8 rounded-lg border p-6" style={{ borderColor: 'var(--mag-category-color)' }}>
            <div className="flex items-center gap-2">
              {c.showCode && <SkuChip sku={p.sku} size="md" />}
            </div>
            <div className="mt-3 space-y-1 text-xl opacity-80">
              {c.showMaterials && p.materials.length > 0 && (
                <div>Material: {p.materials.slice(0, 2).join(', ')}</div>
              )}
              {p.category_name && <div>Categoria: {p.category_name}</div>}
            </div>
            {c.showPrice && (
              <div className="mt-4">
                <PriceTag value={formatPrice(itemPrice(hero))} size="lg" variant="stack" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rail de variações */}
      {variations.length > 0 && (
        <div className="mt-8 border-t pt-6" style={{ borderColor: 'rgba(0,0,0,0.15)' }}>
          <div
            className="mb-4 text-lg uppercase tracking-[0.4em] opacity-70"
            style={{ color: 'var(--mag-category-color)', fontFamily: 'var(--mag-body)' }}
          >
            Variações disponíveis
          </div>
          <div className="grid grid-cols-3 gap-6">
            {variations.map((v) => (
              <div key={v.id} className="flex items-center gap-3">
                <div
                  className="h-20 w-20 overflow-hidden"
                  style={{ background: 'var(--mag-brand-cream, #f1efe7)' }}
                >
                  <img src={resolveItemImage(v)} alt={productImageAlt(v)} className="h-full w-full object-contain p-1" />
                </div>
                <SkuChip sku={v.productSnapshot.sku} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
