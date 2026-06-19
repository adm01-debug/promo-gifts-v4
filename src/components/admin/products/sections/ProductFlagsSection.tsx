/**
 * Flags / Status section — boolean toggles with expiration selectors
 */
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SectionCard } from '../ProductFormHelpers';
import { ShieldCheck, Info, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { addDays } from 'date-fns';
import type { UseFormSetValue } from 'react-hook-form';
import type { ProductFormData } from '../ProductFormSchema';

interface Props {
  setValue: UseFormSetValue<ProductFormData>;
  flags: Record<string, boolean>;
  expirations: Record<string, string | null>;
}

const EXPIRY_OPTIONS = [
  { value: '7', label: '7 dias' },
  { value: '15', label: '15 dias' },
  { value: '30', label: '30 dias' },
  { value: '90', label: '90 dias' },
  { value: 'none', label: 'Sem limite' },
] as const;

/** Convert days-string to ISO date or null */
function daysToExpiry(days: string): string | null {
  if (days === 'none') return null;
  return addDays(new Date(), Number(days)).toISOString();
}

/** Find the closest option for an existing expiry date */
function expiryToOption(expiresAt: string | null): string {
  if (!expiresAt) return 'none';
  const diff = Math.round((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return '7';
  if (diff <= 10) return '7';
  if (diff <= 20) return '15';
  if (diff <= 60) return '30';
  if (diff <= 120) return '90';
  return 'none';
}

/** Format remaining days for display */
function formatRemaining(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const diff = Math.round((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return 'Expirado';
  return `${diff}d restantes`;
}

type ExpiryKey =
  | 'is_featured_expires_at'
  | 'is_bestseller_expires_at'
  | 'is_new_expires_at'
  | 'is_on_sale_expires_at';

const FLAG_CONFIG: {
  key: keyof ProductFormData;
  label: string;
  hint: string;
  expiryKey?: ExpiryKey;
  activeClass?: string;
}[] = [
  {
    key: 'is_active',
    label: 'Produto Ativo',
    hint: 'Define se o produto aparece no catálogo e pode ser adicionado a orçamentos',
    activeClass: 'bg-success/10 border-success/40',
  },
  {
    key: 'is_featured',
    label: 'Destaque',
    hint: 'Exibe o produto em posições de destaque no catálogo',
    expiryKey: 'is_featured_expires_at',
    activeClass: 'bg-primary/10 border-primary/40',
  },
  {
    key: 'is_bestseller',
    label: 'Mais Vendido',
    hint: 'Marca o produto como best-seller para filtros e exibição especial',
    expiryKey: 'is_bestseller_expires_at',
    activeClass: 'bg-warning/10 border-warning/40',
  },
  {
    key: 'is_new',
    label: 'Lançamento',
    hint: 'Indica que o produto é um lançamento recente no catálogo',
    expiryKey: 'is_new_expires_at',
    activeClass: 'bg-info/10 border-info/40',
  },
  {
    key: 'is_on_sale',
    label: 'Em Promoção',
    hint: 'Sinaliza o produto com badge de promoção',
    expiryKey: 'is_on_sale_expires_at',
    activeClass: 'bg-destructive/10 border-destructive/40',
  },
];

export function ProductFlagsSection({ setValue, flags, expirations }: Props) {
  const flagCount = Object.values(flags).filter(Boolean).length;

  return (
    <SectionCard id="flags" title="Status" icon={ShieldCheck} subtitle={`${flagCount} ativos`}>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {FLAG_CONFIG.map(({ key, label, hint, expiryKey, activeClass }) => {
          const value = !!flags[key];
          const toggle = () => {
            const newVal = !value;
            setValue(key, newVal);
            // When turning on a flag with expiry, default to 30 days
            if (newVal && expiryKey) {
              setValue(expiryKey, daysToExpiry('30'));
            }
            // When turning off, clear expiry
            if (!newVal && expiryKey) {
              setValue(expiryKey, null);
            }
          };

          const expiresAt = expiryKey ? expirations[expiryKey] : null;
          const remaining = expiryKey && value ? formatRemaining(expiresAt) : null;

          return (
            <div
              key={key}
              className={cn(
                'flex flex-col rounded-lg border transition-all duration-200',
                value ? activeClass || 'border-primary/20 bg-primary/5' : 'border-border/50',
              )}
            >
              {/* Toggle row */}
              <div
                className="flex cursor-pointer items-center justify-between rounded-t-lg p-3 hover:bg-accent/30"
                onClick={toggle}
                role="switch"
                aria-checked={value}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggle();
                  }
                }}
              >
                <div className="flex items-center gap-1.5">
                  <Label className="cursor-pointer text-xs font-medium">{label}</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 shrink-0 cursor-help text-muted-foreground/40" />
                    </TooltipTrigger>
                    <TooltipContent>{hint}</TooltipContent>
                  </Tooltip>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Switch checked={value} onCheckedChange={toggle} />
                </div>
              </div>

              {/* Expiry selector — only for flags with expiryKey, when active */}
              {expiryKey && value && (
                <div className="px-3 pb-2.5 pt-0">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                    <Select
                      value={expiryToOption(expiresAt)}
                      onValueChange={(v) => setValue(expiryKey, daysToExpiry(v))}
                    >
                      <SelectTrigger className="h-6 w-full border-border/30 bg-background/50 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPIRY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {remaining && (
                      <span
                        className={cn(
                          'whitespace-nowrap text-[10px] font-medium',
                          remaining === 'Expirado'
                            ? 'text-destructive'
                            : 'text-muted-foreground/60',
                        )}
                      >
                        {remaining}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
