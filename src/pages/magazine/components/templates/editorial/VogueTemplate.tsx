import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, formatPrice, itemPrice, resolveItemImage } from '../shared';
import {
  ColorSwatchDot,
  Eyebrow,
  Folio,
  PriceTag,
  ScriptAccent,
  SkuChip,
} from '../chrome';

/**
 * VogueTemplate — 1 produto fullbleed. Adiciona ScriptAccent vertical à esquerda
 * (padrão Speakers p.25 do Abreez) quando há categoria.
 */
export function VogueTemplate({ magazine, page, totalPages }: TemplatePageProps & { totalPages?: number }) {
  const item = page.items[0];
  if (!item) return null;
  const c = effectiveContent(magazine.content, item.overrides);
  const p = item.productSnapshot;
  return (
    <div className="mag-page relative overflow-hidden" style={{ background: 'var(--mag-bg, #0a0a0a)' }}>
      <img
        src={resolveItemImage(item)}
        alt={p.name}
        className="absolute inset-0 h-full w-full object-cover"
        style={{ filter: 'brightness(0.78) contrast(1.05)' }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0.35) 0%,transparent 35%,transparent 55%,rgba(0,0,0,0.75) 100%)' }}
      />

      {/* Script vertical à esquerda (padrão p.25) */}
      {p.category_name && (
        <div className="absolute left-14 top-1/3 text-white/40">
          <ScriptAccent orientation="vertical" size="xl">
            {p.category_name}
          </ScriptAccent>
        </div>
      )}

      {/* topo — folio + emissão */}
      <div className="absolute inset-x-32 top-16 flex items-center justify-between text-white/90">
        <span className="text-xl uppercase tracking-[0.5em]" style={{ fontFamily: 'var(--mag-body)' }}>
          {magazine.title}
        </span>
        <Folio index={page.index} total={totalPages} tone="light" />
      </div>

      <div className="relative flex h-full flex-col justify-end p-32 text-white">
        {p.category_name && (
          <div className="mb-8">
            <Eyebrow color="rgba(255,255,255,0.85)">{p.category_name}</Eyebrow>
          </div>
        )}
        <h1
          className="mb-10 leading-[0.9]"
          style={{ fontFamily: 'var(--mag-heading)', fontSize: 220, letterSpacing: '-0.035em' }}
        >
          {p.name}
        </h1>
        {c.showDescription && p.shortDescription && (
          <p className="max-w-[1150px] text-4xl font-light leading-snug opacity-95" style={{ fontFamily: 'var(--mag-body)' }}>
            {p.shortDescription}
          </p>
        )}
        <div className="mt-16 flex items-end justify-between border-t border-white/25 pt-8">
          <div className="flex flex-col gap-4">
            {c.showCode && <SkuChip sku={p.sku} size="lg" />}
            {c.showColors && <ColorSwatchDot item={item} />}
          </div>
          {c.showPrice && <PriceTag value={formatPrice(itemPrice(item))} size="xl" variant="stack" />}
        </div>
      </div>
    </div>
  );
}
