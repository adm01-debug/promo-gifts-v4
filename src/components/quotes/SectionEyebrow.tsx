/**
 * SectionEyebrow — título eyebrow padronizado das seções do QuoteView.
 *
 * Aplica `qvSpacing.eyebrowGap` + `qvType.eyebrow` (com ícone opcional),
 * reduzindo duplicação em QuoteClientInfo, QuoteItemsTable, QuoteViewPage.
 */
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { qvSpacing, qvType } from './quote-view-typography';

interface SectionEyebrowProps {
  children: React.ReactNode;
  icon?: LucideIcon;
  id?: string;
  as?: 'h2' | 'h3' | 'h4';
  className?: string;
}

export function SectionEyebrow({
  children,
  icon: Icon,
  id,
  as: Tag = 'h3',
  className,
}: SectionEyebrowProps) {
  if (Icon) {
    return (
      <div className={cn(qvSpacing.eyebrowGap, 'flex items-center gap-1.5', className)}>
        <Icon className="h-3 w-3 text-primary" aria-hidden="true" />
        <Tag id={id} className={qvType.eyebrow}>
          {children}
        </Tag>
      </div>
    );
  }
  return (
    <Tag id={id} className={cn(qvSpacing.eyebrowGap, qvType.eyebrow, className)}>
      {children}
    </Tag>
  );
}
