/**
 * Shared helpers for ProductFormFullscreen sections
 */
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
import type { UseFormRegister, UseFormSetValue, UseFormWatch, FieldErrors } from 'react-hook-form';
import type { ProductFormData } from './ProductFormSchema';

// ============================================
// TYPES
// ============================================

export type SectionId =
  | 'classification'
  | 'commercial'
  | 'dimensions'
  | 'fiscal'
  | 'flags'
  | 'info'
  | 'marketing'
  | 'media'
  | 'packaging'
  | 'price'
  | 'seo';

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
  watch: UseFormWatch<ProductFormData>;
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
    <span
      className={cn(
        'text-[10px] font-medium tabular-nums',
        pct > 0.9 ? 'text-destructive' : pct > 0.7 ? 'text-warning' : 'text-muted-foreground/50',
      )}
    >
      {current}/{max}
    </span>
  );
}

export function FieldLabel({
  htmlFor,
  children,
  required,
  charCount,
  charMax,
  hint,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
  charCount?: number;
  charMax?: number;
  hint?: string;
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={htmlFor} className="text-xs font-semibold text-foreground/80">
          {children}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        {hint && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 cursor-help text-muted-foreground/40" />
            </TooltipTrigger>
            <TooltipContent>{hint}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {charCount !== undefined && charMax !== undefined && (
        <CharCounter current={charCount} max={charMax} />
      )}
    </div>
  );
}

export function SectionCard({
  id,
  title,
  icon: iconComponent,
  children,
  subtitle,
}: {
  id: string;
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  subtitle?: string;
}) {
  const Icon = iconComponent;

  return (
    <Card
      id={`section-${id}`}
      className="scroll-mt-4 overflow-hidden border-border/50 bg-card/60 backdrop-blur-sm"
    >
      <div className="border-b border-border/30 p-5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
            {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </Card>
  );
}
