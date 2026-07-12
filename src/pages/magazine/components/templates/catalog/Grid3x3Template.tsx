import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';

export function Grid3x3Template({ magazine, page, totalPages }: TemplatePageProps) {
  return (
    <div className="mag-page flex flex-col p-10" style={{ background: '#f6f7f9' }}>
      <header
        className="mb-6 flex items-center justify-between rounded-xl px-8 py-5 text-white"
        style={{
          background: 'linear-gradient(90deg,var(--mag-primary) 0%,var(--mag-primary) 60%,var(--mag-secondary) 100%)',
        }}
      >
        <div className="flex items-center gap-4">
          <span className="h-8 w-1 rounded-full bg-white/70" aria-hidden />
          <h2
            className="text-3xl font-bold uppercase tracking-[0.15em]"
            style={{ fontFamily: 'var(--mag-heading)' }}
          >
            {magazine.title}
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xl">
          <span className="opacity-80">Página</span>
          <span className="rounded-md bg-white/15 px-3 py-1 font-bold">
            {String(page.index + 1).padStart(2, '0')}
            {typeof totalPages === 'number' && <span className="opacity-70"> / {String(totalPages).padStart(2, '0')}</span>}
          </span>
        </div>
      </header>
      <div className="grid flex-1 grid-cols-3 grid-rows-3 gap-4">
        {page.items.slice(0, 9).map((item) => {
          const c = effectiveContent(magazine.content, item.overrides);
          const p = item.productSnapshot;
          return (
            <div
              key={item.id}
              className="flex flex-col overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-black/5"
            >
              <div className="relative flex-1 overflow-hidden bg-neutral-50">
                <img src={resolveItemImage(item)} alt={p.name} className="h-full w-full object-contain p-2" />
                {c.showPrice && (
                  <span
                    className="absolute right-2 top-2 rounded-md px-3 py-1 text-xl font-bold text-white shadow-sm"
                    style={{ background: 'var(--mag-secondary)' }}
                  >
                    {formatPrice(itemPrice(item))}
                  </span>
                )}
                {c.showPersonalization && p.hasPersonalization && (
                  <span
                    className="absolute left-2 top-2 rounded-md bg-white/95 px-2 py-0.5 text-sm uppercase tracking-widest"
                    style={{ color: 'var(--mag-primary)' }}
                  >
                    Personalizável
                  </span>
                )}
              </div>
              <div className="border-t p-3">
                <div
                  className="line-clamp-2 text-xl font-semibold leading-tight"
                  style={{ color: 'var(--mag-text)', fontFamily: 'var(--mag-heading)' }}
                >
                  {p.name}
                </div>
                {c.showCode && <div className="mt-1 text-lg opacity-70">Cód. {p.sku}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
