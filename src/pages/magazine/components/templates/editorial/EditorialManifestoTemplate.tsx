import type { TemplatePageProps } from '../TemplateRegistry';
import { effectiveContent, productImageAlt, resolveItemImage } from '../shared';
import { PageNumberBadge, ScriptAccent } from '../chrome';

/**
 * EditorialManifestoTemplate — página-manifesto (padrão Abreez p.60):
 * três fatias horizontais desiguais (30/40/30) para narrativas de coleção/ESG.
 * Não vende produto — vende ideologia. Usa o 1º produto como foto lifestyle.
 */
export function EditorialManifestoTemplate({ magazine, page }: TemplatePageProps) {
  const hero = page.items[0];
  const secondary = page.items[1];
  const c = hero ? effectiveContent(magazine.content, hero.overrides) : magazine.content;

  return (
    <div className="mag-page flex flex-col overflow-hidden bg-white">
      {/* Fatia 1 (30%) — foto lifestyle com título editorial centrado */}
      <div className="relative flex h-[30%] items-center justify-center overflow-hidden">
        {hero && (
          <img
            src={resolveItemImage(hero)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'brightness(0.55) contrast(1.05)' }}
          />
        )}
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.35)' }} />
        <div className="relative flex flex-col items-center gap-6 text-center text-white">
          <PageNumberBadge index={page.index} size="md" color="var(--mag-brand-coral, #e86f2e)" />
          <h1
            className="max-w-[1400px] leading-[1.05]"
            style={{ fontFamily: 'var(--mag-heading)', fontSize: 96, letterSpacing: '-0.02em' }}
          >
            {magazine.title}
          </h1>
          {magazine.subtitle && (
            <p className="max-w-[1000px] text-2xl leading-snug opacity-95">{magazine.subtitle}</p>
          )}
        </div>
      </div>

      {/* Fatia 2 (40%) — fundo cor da marca com logo grande outline + script */}
      <div
        className="relative flex h-[40%] items-center justify-end overflow-hidden px-24"
        style={{ background: 'var(--mag-brand-green, #2e4a3a)', color: '#f5f5f5' }}
      >
        {magazine.branding.clientName && (
          <div
            aria-hidden
            className="absolute inset-y-0 left-0 flex items-center pl-16 text-[220px] font-black leading-none opacity-10"
            style={{ fontFamily: 'var(--mag-heading)' }}
          >
            {magazine.branding.clientName.slice(0, 8)}
          </div>
        )}
        <div className="relative max-w-[720px] text-right">
          <ScriptAccent size="xl" color="var(--mag-brand-mint, #b6d9c5)">
            {hero?.productSnapshot.category_name ?? 'Coleção'}
          </ScriptAccent>
          {hero?.productSnapshot.shortDescription && c.showDescription && (
            <p className="mt-8 text-2xl leading-[1.6]" style={{ fontFamily: 'var(--mag-body)' }}>
              {hero.productSnapshot.shortDescription}
            </p>
          )}
        </div>
      </div>

      {/* Fatia 3 (30%) — split 50/50 foto + fundo mostarda */}
      <div className="flex h-[30%]">
        <div className="relative w-1/2 overflow-hidden">
          {secondary ? (
            <img src={resolveItemImage(secondary)} alt={productImageAlt(secondary)} className="h-full w-full object-cover" />
          ) : hero ? (
            <img src={resolveItemImage(hero)} alt={productImageAlt(hero)} className="h-full w-full object-cover"
              style={{ filter: 'saturate(0.7)' }} />
          ) : null}
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.35)' }} />
          <div className="absolute inset-0 flex flex-col justify-end p-12 text-white">
            <h3
              className="text-5xl font-bold leading-tight"
              style={{ fontFamily: 'var(--mag-heading)' }}
            >
              Escolha melhor.<br />Faça durar.
            </h3>
          </div>
        </div>
        <div
          className="flex w-1/2 items-center justify-center p-16 text-right"
          style={{ background: 'var(--mag-brand-coral, #e86f2e)', color: '#fff' }}
        >
          <p className="text-2xl leading-[1.7]" style={{ fontFamily: 'var(--mag-body)' }}>
            Cada produto desta coleção foi curado com propósito. Mais que brindes,
            são presentes que carregam a identidade da sua marca em cada detalhe —
            construídos para durar e para serem lembrados.
          </p>
        </div>
      </div>
    </div>
  );
}
