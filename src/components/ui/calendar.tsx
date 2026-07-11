// src/components/ui/calendar.tsx
// Design iPhone Calendar (iOS): mês em destaque à esquerda com chevron de
// dropdown, setas ‹ › à direita, weekdays de uma letra em cinza uppercase,
// domingos em vermelho (iOS red = destructive), dia de hoje em vermelho,
// selecionado em círculo preenchido, números grandes e espaçados como no
// app Calendário do iPhone.

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { ptBR } from 'date-fns/locale';

import { cn } from '@/lib/utils';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = false,
  modifiers,
  modifiersClassNames,
  formatters,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={ptBR}
      showOutsideDays={showOutsideDays}
      className={cn('pointer-events-auto p-2 select-none overflow-hidden', className)}

        head_cell:
          'flex-1 font-semibold uppercase tracking-[0.08em] text-[9px] leading-none text-muted-foreground/70 flex items-center justify-center',
        row: 'flex w-full gap-0',
        cell: 'flex-1 aspect-square text-center p-0 relative focus-within:relative focus-within:z-20 flex items-center justify-center',

        day: 'inline-flex h-full w-full items-center justify-center rounded-full text-[14px] leading-none font-normal text-foreground transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-selected:opacity-100',
        day_range_end: 'day-range-end',
        day_today:
          'text-destructive font-semibold aria-selected:bg-destructive aria-selected:text-primary-foreground',
        day_selected:
          'bg-destructive text-primary-foreground font-semibold hover:bg-destructive hover:text-primary-foreground focus:bg-destructive focus:text-primary-foreground',
        day_outside: 'invisible pointer-events-none',
        day_disabled: 'text-muted-foreground/30',
        day_range_middle:
          'aria-selected:bg-accent/60 aria-selected:text-accent-foreground rounded-none',
        day_hidden: 'invisible',
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
      }}

      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
