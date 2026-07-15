/**
 * Peças de "chrome" reutilizáveis entre templates de Magazine.
 * Mantém cada template < 150 LOC e garante consistência visual.
 *
 * Sistema micro-padrão inspirado no Catálogo Abreez 2026:
 *  - SkuChip / PrintingChip / PageNumberBadge / HairlineDivider
 *  - VerticalCategoryStripe (sidebar 20pt com cor categórica + número + label)
 *  - ScriptAccent / CalloutCard / DotMapBackdrop
 */

import type { CSSProperties, ReactNode } from 'react';
import type { MagazineCategory, MagazineItem } from '@/types/magazine';

/* ============================================================
 * Chrome legado (mantido para não quebrar templates existentes)
 * ============================================================ */

export function Folio({
  index,
  total,
  tone = 'dark',
}: {
  index: number;
  total?: number;
  tone?: 'accent' | 'dark' | 'light';
}) {
  const color = tone === 'light' ? 'rgba(255,255,255,0.9)' : tone === 'accent' ? 'var(--mag-secondary)' : 'var(--mag-text)';
  return (
    <div
      className="flex items-center gap-3 text-xl uppercase tracking-[0.35em]"
      style={{ color, fontFamily: 'var(--mag-body)' }}
    >
      <span className="inline-block h-[1px] w-10" style={{ background: 'currentColor', opacity: 0.6 }} />
      <span>
        {String(index + 1).padStart(2, '0')}
        {typeof total === 'number' && <span className="opacity-60"> / {String(total).padStart(2, '0')}</span>}
      </span>
    </div>
  );
}

export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <div
      className="text-2xl uppercase tracking-[0.4em]"
      style={{ fontFamily: 'var(--mag-body)', color: color ?? 'var(--mag-secondary)' }}
    >
      {children}
    </div>
  );
}

export function ColorSwatchDot({ item }: { item: MagazineItem }) {
  if (!item.variantColorName) return null;
  const c = item.productSnapshot.colors.find((x) => x.name === item.variantColorName);
  const hex = c?.hex ?? '#cccccc';
  return (
    <span className="inline-flex items-center gap-2 text-xl opacity-90">
      <span
        aria-hidden
        className="inline-block h-4 w-4 rounded-full border"
        style={{ background: hex, borderColor: 'rgba(0,0,0,0.15)' }}
      />
      <span className="uppercase tracking-widest">{item.variantColorName}</span>
    </span>
  );
}

export function PriceTag({
  value,
  size = 'md',
  variant = 'flat',
}: {
  value: string;
  size?: 'lg' | 'md' | 'sm' | 'xl';
  variant?: 'chip' | 'flat' | 'stack';
}) {
  const [currency, ...rest] = value.split(' ');
  const amount = rest.join(' ') || value;
  const sizeMap = { sm: 'text-2xl', md: 'text-4xl', lg: 'text-5xl', xl: 'text-7xl' } as const;
  if (variant === 'chip') {
    return (
      <span
        className={`inline-flex items-baseline gap-2 rounded-md px-3 py-1 font-bold text-white ${sizeMap[size]}`}
        style={{ background: 'var(--mag-secondary)', fontFamily: 'var(--mag-heading)' }}
      >
        <span className="text-[0.5em] opacity-80">{currency}</span>
        {amount}
      </span>
    );
  }
  if (variant === 'stack') {
    return (
      <div className="flex items-baseline gap-2" style={{ color: 'var(--mag-secondary)', fontFamily: 'var(--mag-heading)' }}>
        <span className="text-[0.45em] uppercase tracking-widest opacity-80">{currency}</span>
        <span className={`font-black ${sizeMap[size]}`}>{amount}</span>
      </div>
    );
  }
  return (
    <span
      className={`inline-flex items-baseline gap-2 font-black ${sizeMap[size]}`}
      style={{ color: 'var(--mag-secondary)', fontFamily: 'var(--mag-heading)' }}
    >
      <span className="text-[0.5em] uppercase tracking-widest opacity-70">{currency}</span>
      {amount}
    </span>
  );
}

export function Rule({ tone = 'dark' }: { tone?: 'accent' | 'dark' | 'light' }) {
  const color = tone === 'light' ? 'rgba(255,255,255,0.4)' : tone === 'accent' ? 'var(--mag-secondary)' : 'rgba(0,0,0,0.15)';
  return <span aria-hidden className="inline-block h-[1px] w-6" style={{ background: color }} />;
}

/* ============================================================
 * Micro-padrões novos (Abreez SSOT)
 * ============================================================ */

/**
 * SkuChip — pill preto com SKU em caps bold branco. Padrão dos "product cards"
 * de p.7-10 do catálogo Abreez.
 */
export function SkuChip({ sku, size = 'md' }: { sku: string; size?: 'lg' | 'md' | 'sm' }) {
  const map = {
    sm: 'text-lg px-3 py-1',
    md: 'text-xl px-4 py-1.5',
    lg: 'text-2xl px-5 py-2',
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-[0.15em] text-white ${map[size]}`}
      style={{ background: 'var(--mag-brand-charcoal, #1a1a1a)', fontFamily: 'var(--mag-body)' }}
    >
      {sku}
    </span>
  );
}

/**
 * PrintingChip — retângulo cinza-claro com o rótulo `[Printing]` preservando
 * os colchetes, tipografia sans 9pt cinza-70 (padrão Abreez).
 */
export function PrintingChip({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center rounded-sm px-2 py-0.5 text-lg font-medium"
      style={{
        background: 'rgba(0,0,0,0.06)',
        color: 'rgba(0,0,0,0.70)',
        fontFamily: 'var(--mag-body)',
      }}
    >
      [{label}]
    </span>
  );
}

/**
 * PageNumberBadge — quadrado da cor da categoria com número branco bold no centro
 * e label `PAGE` em caps acima. Recipe do TOC (p.3) do Abreez.
 */
export function PageNumberBadge({
  index,
  size = 'md',
  color,
}: {
  index: number;
  size?: 'lg' | 'md' | 'sm';
  color?: string;
}) {
  const box = { sm: 'w-14 h-14', md: 'w-20 h-20', lg: 'w-28 h-28' }[size];
  const num = { sm: 'text-3xl', md: 'text-4xl', lg: 'text-6xl' }[size];
  return (
    <div
      className={`relative inline-flex flex-col items-center justify-center rounded-md text-white shadow-sm ${box}`}
      style={{ background: color ?? 'var(--mag-category-color)' }}
    >
      <span
        className="absolute left-2 top-1 text-[0.5em] uppercase tracking-widest opacity-90"
        style={{ fontFamily: 'var(--mag-body)' }}
      >
        PAGE
      </span>
      <span
        className={`font-black tabular-nums ${num}`}
        style={{ fontFamily: 'var(--mag-heading)' }}
      >
        {String(index + 1).padStart(3, '0')}
      </span>
    </div>
  );
}

/**
 * VerticalCategoryStripe — sidebar vertical esquerda (padrão Abreez p.7+).
 * Retângulo colorido + número da página no topo + ícone + nome da seção
 * rotacionado. Substitui header/footer horizontais.
 */
export function VerticalCategoryStripe({
  index,
  label,
  color,
  icon,
}: {
  index: number;
  label: string;
  color?: string;
  icon?: ReactNode;
}) {
  return (
    <aside
      aria-hidden
      className="absolute left-0 top-0 flex h-full w-16 flex-col items-center"
      style={{ background: 'transparent' }}
    >
      {/* Bloco colorido superior com número */}
      <div
        className="flex h-24 w-full flex-col items-center justify-center text-white"
        style={{ background: color ?? 'var(--mag-category-color)' }}
      >
        <span
          className="text-2xl font-black tabular-nums"
          style={{ fontFamily: 'var(--mag-heading)' }}
        >
          {String(index + 1).padStart(3, '0')}
        </span>
      </div>
      {/* Ícone opcional */}
      {icon && (
        <div className="mt-4 flex h-10 w-10 items-center justify-center opacity-60">{icon}</div>
      )}
      {/* Label rotacionado */}
      <div
        className="mag-vertical-writing mt-6 text-xl font-semibold uppercase tracking-[0.5em]"
        style={{
          color: color ?? 'var(--mag-category-color)',
          fontFamily: 'var(--mag-body)',
        }}
      >
        {label}
      </div>
    </aside>
  );
}

/**
 * HairlineDivider — divisor de 0.5pt com opacidade controlada (padrão Abreez).
 */
export function HairlineDivider({
  orientation = 'horizontal',
  tone = 'dark',
}: {
  orientation?: 'horizontal' | 'vertical';
  tone?: 'dark' | 'light';
}) {
  const color = tone === 'light' ? 'rgba(255,255,255,0.20)' : 'var(--mag-hairline, rgba(0,0,0,0.12))';
  const base: CSSProperties = { background: color };
  return (
    <span
      aria-hidden
      className={
        orientation === 'horizontal' ? 'block h-px w-full' : 'inline-block h-full w-px'
      }
      style={base}
    />
  );
}

/**
 * ScriptAccent — palavra em Great Vibes usada com moderação como acento
 * (capa, section divider, section-hero). Padrão Abreez capa + p.25.
 */
export function ScriptAccent({
  children,
  orientation = 'horizontal',
  size = 'lg',
  color,
}: {
  children: ReactNode;
  orientation?: 'horizontal' | 'vertical';
  size?: '2xl' | 'lg' | 'md' | 'xl';
  color?: string;
}) {
  const sizeMap = {
    md: 'text-6xl',
    lg: 'text-8xl',
    xl: 'text-[10rem]',
    '2xl': 'text-[14rem]',
  } as const;
  return (
    <span
      className={`mag-script leading-none ${sizeMap[size]} ${orientation === 'vertical' ? 'mag-vertical-writing' : ''}`}
      style={{ color: color ?? 'currentColor' }}
    >
      {children}
    </span>
  );
}

/**
 * CalloutCard — card de copy longa. Padrão "Benefits" (p.40) e "Trade shows"
 * (p.220) do Abreez.
 */
export function CalloutCard({
  children,
  tone = 'dark',
  className = '',
}: {
  children: ReactNode;
  tone?: 'brand' | 'dark' | 'light';
  className?: string;
}) {
  const styles: Record<string, CSSProperties> = {
    dark: { background: 'var(--mag-brand-charcoal, #1a1a1a)', color: '#f5f5f5' },
    light: { background: 'var(--mag-brand-cream, #f1efe7)', color: '#1a1a1a' },
    brand: { background: 'var(--mag-brand-green, #2e4a3a)', color: '#f5f5f5' },
  };
  return (
    <div
      className={`rounded-lg p-10 text-2xl leading-[1.6] ${className}`}
      style={{ ...styles[tone], fontFamily: 'var(--mag-body)' }}
    >
      {children}
    </div>
  );
}

/**
 * DotMapBackdrop — fundo pontilhado para a contracapa (padrão Abreez p.378).
 */
export function DotMapBackdrop({ children }: { children?: ReactNode }) {
  return (
    <div
      className="mag-dotmap-bg absolute inset-0"
      style={{ background: 'var(--mag-brand-green, #2e4a3a)' }}
    >
      <div className="mag-dotmap-bg absolute inset-0" />
      {children}
    </div>
  );
}

/* ============================================================
 * Category token registry
 * ============================================================ */

export const MAGAZINE_CATEGORY_META: Record<
  MagazineCategory,
  { label: string; cssVar: string; hex: string }
> = {
  technology: { label: 'Tecnologia', cssVar: '--mag-cat-technology', hex: '#2e4c60' },
  drinkwares: { label: 'Drinkwares', cssVar: '--mag-cat-drinkwares', hex: '#5b7684' },
  general: { label: 'Brindes Gerais', cssVar: '--mag-cat-general', hex: '#6e2c39' },
  wearables: { label: 'Vestuário', cssVar: '--mag-cat-wearables', hex: '#d25a2f' },
  pins: { label: 'Pins & Badges', cssVar: '--mag-cat-pins', hex: '#3e6b70' },
  awards: { label: 'Troféus', cssVar: '--mag-cat-awards', hex: '#5d3e70' },
  packaging: { label: 'Embalagens', cssVar: '--mag-cat-packaging', hex: '#2c3e64' },
  stationery: { label: 'Papelaria', cssVar: '--mag-cat-stationery', hex: '#b34e3a' },
  bags: { label: 'Bolsas', cssVar: '--mag-cat-bags', hex: '#7c9a5e' },
  clocks: { label: 'Relógios', cssVar: '--mag-cat-clocks', hex: '#9e6e2e' },
  signs: { label: 'Sinalização', cssVar: '--mag-cat-signs', hex: '#5c6b48' },
  id: { label: 'Credenciais', cssVar: '--mag-cat-id', hex: '#4e6274' },
  giftsets: { label: 'Gift Sets', cssVar: '--mag-cat-giftsets', hex: '#2f6c6c' },
  customized: { label: 'Customizados', cssVar: '--mag-cat-customized', hex: '#4e547a' },
};

export function categoryHex(category: MagazineCategory | null | undefined): string {
  return category ? MAGAZINE_CATEGORY_META[category].hex : MAGAZINE_CATEGORY_META.technology.hex;
}
