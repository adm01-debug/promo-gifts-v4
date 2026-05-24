/**
 * Shared helpers for ProductFormFullscreen sections
 */
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import type { UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form';
import type { ProductFormData } from './ProductFormSchema';

// ============================================
// TYPES
// ============================================

export type SectionId = 'info' | 'price' | 'commercial' | 'flags' | 'dimensions' | 'packaging' | 'fiscal' | 'seo' | 'marketing' | 'classification' | 'media';

export interface SectionDef {
  id: SectionId;
  label: string;
  icon: React.ElementType;
  group: string;
}

/** Props shared by all form section components */
export interface FormSectionProps {
  register: UseFormRegister<ProductFormData>;
  setValue: UseFormSetValue<ProductFormData>;
  watch: <T extends keyof ProductFormData>(name: T) => ProductFormData[T];
  errors: FieldErrors<ProductFormData>;
  numericProps: (name: keyof ProductFormData | (string & {})) => Record<string, unknown>;
}

// ============================================
// CONSTANTS
// ============================================

export { Ruler as RulerIcon } from 'lucide-react';

export const SECTIONS: SectionDef[] = [
  { id: 'info', label: 'Informações', icon: Info, group: 'Básico' },
  // Icons are resolved by the main component to avoid importing all icons here
];

// ============================================
// COMPONENTS
// ============================================

export function CharCounter({ current, max }: { current: number; max: number }) {
  const pct = current / max;
  return (
    <span className={cn(
      'text-[10px] tabular-nums font-medium',
      pct > 0.9 ? 'text-destructive' : pct > 0.7 ? 'text-warning' : 'text-muted-foreground/50',
    )}>
      {current}/{max}
    </span>
  );
}

export function FieldLabel({ htmlFor, children, required, charCount, charMax, hint }: {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
  charCount?: number;
  charMax?: number;
  hint?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={htmlFor} className="text-xs font-semibold text-foreground/80">
          {children}
          {required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        {hint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground/40 cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="text-xs max-w-[260px]">{hint}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {charCount !== undefined && charMax !== undefined && (
        <CharCounter current={charCount} max={charMax} />
      )}
    </div>
  );
}

export function SectionCard({ id, title, icon: Icon, children, subtitle }: {
  id: string;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <Card id={`section-${id}`} className="border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden scroll-mt-4">
      <div className="p-5 pb-4 border-b border-border/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </Card>
  );
}
