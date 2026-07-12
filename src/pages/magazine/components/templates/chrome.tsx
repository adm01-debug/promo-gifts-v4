/**
 * Peças de "chrome" reutilizáveis entre templates de Magazine.
 * Mantém cada template < 150 LOC e garante consistência visual.
 */

import type { ReactNode } from 'react';
import type { MagazineItem } from '@/types/magazine';

export function Folio({
  index,
  total,
  tone = 'dark',
}: {
  index: number;
  total?: number;
  tone?: 'dark' | 'light' | 'accent';
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

export function Eyebrow({
  children,
  color,
}: {
  children: ReactNode;
  color?: string;
}) {
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
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'flat' | 'chip' | 'stack';
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

export function Rule({ tone = 'dark' }: { tone?: 'dark' | 'light' | 'accent' }) {
  const color = tone === 'light' ? 'rgba(255,255,255,0.4)' : tone === 'accent' ? 'var(--mag-secondary)' : 'rgba(0,0,0,0.15)';
  return <span aria-hidden className="inline-block h-[1px] w-6" style={{ background: color }} />;
}
