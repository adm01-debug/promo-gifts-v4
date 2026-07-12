import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';

export function ListTemplate({ magazine, page }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col bg-white p-14">
      <header className="mb-8 border-b-2 pb-4" style={{ borderColor: 'var(--mag-primary)' }}>
        <h2 className="text-5xl font-bold" style={{ color: 'var(--mag-primary)', fontFamily: 'var(--mag-heading)' }}>
          {magazine.title}
        </h2>
        {magazine.subtitle && <div className="mt-2 text-2xl opacity-80">{magazine.subtitle}</div>}
      </header>
      <div className="flex flex-1 flex-col gap-6">
        {page.items.slice(0, 5).map((item) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          return (
            <div key={item.id} className="grid grid-cols-12 gap-6 border-b pb-6">
              <div className="col-span-3 overflow-hidden rounded-lg bg-gray-50" style={{ minHeight: 320 }}>
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-cover" />
              </div>
              <div className="col-span-6 flex flex-col justify-center">
                <h3 className="text-3xl font-bold leading-tight" style={{ color: 'var(--mag-text)' }}>
                  {p.name}
                </h3>
                {c.showCode && <div className="mt-1 text-xl opacity-70">Cód. {p.sku}</div>}
                {c.showDescription && p.shortDescription && (
                  <p className="mt-2 line-clamp-3 text-2xl leading-snug opacity-90">{p.shortDescription}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.showColors && item.variantColorName && (
                    <span className="rounded-full border px-3 py-1 text-lg">{item.variantColorName}</span>
                  )}
                  {c.showMaterials &&
                    p.materials.slice(0, 3).map((m) => (
                      <span key={m} className="rounded-full border px-3 py-1 text-lg opacity-80">
                        {m}
                      </span>
                    ))}
                  {c.showPersonalization && p.hasPersonalization && (
                    <span
                      className="rounded-full px-3 py-1 text-lg text-white"
                      style={{ background: 'var(--mag-primary)' }}
                    >
                      Personalizável
                    </span>
                  )}
                </div>
              </div>
              <div className="col-span-3 flex flex-col items-end justify-center">
                {c.showPrice && (
                  <div className="text-5xl font-black" style={{ color: 'var(--mag-secondary)' }}>
                    {formatPrice(itemPrice(item))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
