/**
 * DatePickerField — substituto shadcn para `<input type="date">`.
 *
 * Por que existe:
 *   - `<input type="date">` renderiza o calendário NATIVO do navegador,
 *     que ignora todo o design system e não pode ser estilizado. Isso
 *     regrediu o redesign iOS Calendar em três pontos:
 *       • PurchaseOrderModal (Previsão de chegada)
 *       • DiscountApprovalFilterBar (De/Até)
 *       • SellerCartsPage → "Prazo p/ envio" (variante compact)
 *
 * Contrato:
 *   - `value` no formato ISO `yyyy-MM-dd` (string) — vazio = `""`.
 *     Compatível com hooks e queries existentes; para APIs que usam
 *     `null`, converte no boundary do consumidor.
 *   - `onChange(value)` recebe a nova string ISO ou `""` quando limpo.
 *   - `variant`:
 *       'input'   → altura h-9 estilo shadcn Input (default)
 *       'compact' → altura h-7 com ícone, para labels inline (ex: prazo p/ envio)
 *   - `showFooter`: exibe botões "Limpar" e "Hoje" abaixo do calendário.
 *   - `allowClear`: exibe botão X no próprio trigger quando há data.
 *
 * Acessibilidade:
 *   - `role="button"` implícito (é `<button>`), com `aria-haspopup="dialog"`
 *     via Radix Popover.
 *   - `aria-invalid` e `aria-describedby` propagados ao trigger para associar
 *     mensagens de erro (mantém contrato com os testes existentes).
 *   - Botão de limpar (X) no trigger é `role="button"` com `tabIndex={0}` e
 *     `onKeyDown` (Enter/Space) — segue política do projeto para divs
 *     clicáveis (aqui em `<span>` para não aninhar `<button>` dentro do
 *     Popover trigger).
 *   - `initialFocus` no Calendar move foco ao abrir; ao selecionar, foco
 *     retorna ao trigger via Radix.
 */
import * as React from 'react';
import { format, parse, isValid, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, CalendarClock, X as XIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

export type DatePickerFieldVariant = 'compact' | 'input';

export interface DatePickerFieldProps {
  /** ISO `yyyy-MM-dd`. Vazio = `""`. */
  value: string;
  onChange: (value: string) => void;
  /** Data mínima permitida (default: sem limite). */
  minDate?: Date;
  /** Data máxima permitida (default: sem limite). */
  maxDate?: Date;
  /** Placeholder mostrado quando `value === ""`. */
  placeholder?: string;
  /** Estilo do trigger. */
  variant?: DatePickerFieldVariant;
  /** Botão X inline no trigger quando há data. */
  allowClear?: boolean;
  /** Exibe "Limpar" / "Hoje" abaixo do calendário. */
  showFooter?: boolean;
  disabled?: boolean;
  id?: string;
  /** Espelhado no `<button>` trigger, por compatibilidade com testes. */
  'data-testid'?: string;
  /** Espelhado no `<button>` trigger. */
  'aria-invalid'?: boolean;
  /** Espelhado no `<button>` trigger. */
  'aria-describedby'?: string;
  /** Espelhado no `<button>` trigger. */
  'aria-label'?: string;
  className?: string;
}

function parseIso(value: string): Date | undefined {
  if (!value) return undefined;
  const parsed = parse(value, 'yyyy-MM-dd', new Date());
  return isValid(parsed) ? parsed : undefined;
}

export function DatePickerField(props: DatePickerFieldProps) {
  const {
    value,
    onChange,
    minDate,
    maxDate,
    placeholder = 'dd/mm/aaaa',
    variant = 'input',
    allowClear = true,
    showFooter = true,
    disabled = false,
    id,
    className,
  } = props;

  const [open, setOpen] = React.useState(false);
  const today = React.useMemo(() => startOfDay(new Date()), []);
  const selectedDate = React.useMemo(() => parseIso(value), [value]);
  const label = selectedDate ? format(selectedDate, 'dd/MM/yyyy') : placeholder;

  const handleSelect = React.useCallback(
    (date: Date | undefined) => {
      if (!date) {
        onChange('');
        return;
      }
      onChange(format(date, 'yyyy-MM-dd'));
      setOpen(false);
    },
    [onChange],
  );

  const handleClear = React.useCallback(() => {
    onChange('');
  }, [onChange]);

  const handleToday = React.useCallback(() => {
    // Se hoje estiver fora do range permitido, ignora.
    if (minDate && today < startOfDay(minDate)) return;
    if (maxDate && today > startOfDay(maxDate)) return;
    onChange(format(today, 'yyyy-MM-dd'));
    setOpen(false);
  }, [onChange, today, minDate, maxDate]);

  const disabledMatcher = React.useMemo(() => {
    if (minDate && maxDate) return { before: minDate, after: maxDate };
    if (minDate) return { before: minDate };
    if (maxDate) return { after: maxDate };
    return undefined;
  }, [minDate, maxDate]);

  const isCompact = variant === 'compact';
  const Icon = isCompact ? CalendarClock : CalendarIcon;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          data-testid={props['data-testid']}
          aria-invalid={props['aria-invalid'] || undefined}
          aria-describedby={props['aria-describedby']}
          aria-label={props['aria-label']}
          data-empty={!selectedDate || undefined}
          data-variant={variant}
          className={cn(
            'inline-flex items-center gap-2 rounded-md border bg-background text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50',
            isCompact
              ? 'h-7 gap-1.5 border-border/30 bg-background/50 px-2 text-xs hover:border-primary/40'
              : 'h-9 justify-start border-input px-3 text-sm hover:border-primary/40',
            props['aria-invalid']
              ? 'border-destructive/60 focus:border-destructive focus:ring-destructive/20'
              : 'focus:border-primary/40',
            !selectedDate && 'text-muted-foreground',
            className,
          )}
        >
          <Icon
            aria-hidden="true"
            className={cn(isCompact ? 'h-3 w-3 text-primary' : 'h-4 w-4 text-muted-foreground')}
          />
          <span className="flex-1 tabular-nums text-left">{label}</span>
          {allowClear && selectedDate && !disabled && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Limpar data"
              data-testid={
                props['data-testid'] ? `${props['data-testid']}-clear` : 'date-picker-clear'
              }
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClear();
                }
              }}
              className={cn(
                'inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40',
                isCompact ? 'h-4 w-4' : 'h-5 w-5',
              )}
            >
              <XIcon aria-hidden="true" className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-0"
        data-testid={
          props['data-testid'] ? `${props['data-testid']}-calendar` : 'date-picker-calendar'
        }
      >
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selectedDate}
          defaultMonth={selectedDate ?? today}
          onSelect={handleSelect}
          disabled={disabledMatcher}
          initialFocus
          className="pointer-events-auto"
        />
        {showFooter && (
          <div className="flex items-center justify-between border-t border-border/40 px-3 py-2">
            <button
              type="button"
              onClick={() => {
                handleClear();
                setOpen(false);
              }}
              className="text-xs font-medium text-destructive hover:text-destructive/80 focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-sm px-1"
              data-testid={
                props['data-testid']
                  ? `${props['data-testid']}-footer-clear`
                  : 'date-picker-footer-clear'
              }
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="text-xs font-medium text-destructive hover:text-destructive/80 focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-sm px-1"
              data-testid={
                props['data-testid']
                  ? `${props['data-testid']}-footer-today`
                  : 'date-picker-footer-today'
              }
            >
              Hoje
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default DatePickerField;
