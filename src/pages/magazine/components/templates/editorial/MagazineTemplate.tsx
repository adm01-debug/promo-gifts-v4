import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';

export function MagazineTemplate({ magazine, page }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col bg-white p-16">
      <header
        className="mb-10 flex items-end justify-between border-b-4 pb-6"
        style={{ borderColor: 'var(--mag-primary)' }}
      >
        <h2 className="text-6xl" style={{ fontFamily: 'var(--mag-heading)', color: 'var(--mag-primary)' }}>
          {magazine.title}
        </h2>
        <span className="text-2xl uppercase tracking-widest opacity-70">Página {page.index + 1}</span>
      </header>
      <div className="grid flex-1 grid-cols-2 gap-12">
        {page.items.map((item) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          return (
            <article key={item.id} className="flex flex-col">
              <div className="relative flex-1 overflow-hidden" style={{ minHeight: 900 }}>
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-cover" />
              </div>
              <div className="pt-6">
                <h3
                  className="text-5xl leading-tight"
                  style={{ fontFamily: 'var(--mag-heading)', color: 'var(--mag-text)' }}
                >
                  {p.name}
                </h3>
                {c.showCode && <div className="mt-3 text-2xl opacity-70">Cód. {p.sku}</div>}
                {c.showDescription && p.shortDescription && (
                  <p className="mt-4 line-clamp-4 text-2xl leading-snug opacity-90">{p.shortDescription}</p>
                )}
                <div className="mt-6 flex items-center justify-between">
                  {c.showPrice ? (
                    <span className="text-4xl font-bold" style={{ color: 'var(--mag-secondary)' }}>
                      {formatPrice(itemPrice(item))}
                    </span>
                  ) : (
                    <span />
                  )}
                  {c.showPersonalization && p.hasPersonalization && (
                    <span
                      className="rounded-full px-4 py-1 text-xl uppercase tracking-wider text-white"
                      style={{ background: 'var(--mag-primary)' }}
                    >
                      Personalizável
                    </span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
