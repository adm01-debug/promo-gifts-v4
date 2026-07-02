// src/components/ui/calendar.tsx
// Visual iOS: header grande à esquerda ("Julho 2026"), setas discretas à
// direita, weekdays de 1 letra ("D S T Q Q S S"), domingos em vermelho,
// hoje em círculo claro com texto invertido, selecionado em círculo primário,
// dias fora do mês ocultos.

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
      className={cn('pointer-events-auto p-4', className)}
      formatters={{
        formatWeekdayName: (date) => {
          const narrow = ptBR.localize?.day(date.getDay(), { width: 'narrow' }) ?? '';
          return narrow.charAt(0).toUpperCase();
        },
        ...formatters,
      }}
      modifiers={{
        sunday: (date) => date.getDay() === 0,
        ...modifiers,
      }}
      modifiersClassNames={{
        sunday: 'text-destructive',
        ...modifiersClassNames,
      }}
      classNames={{
        months: 'flex flex-col sm:flex-row gap-4',
        month: 'space-y-3',
        caption: 'flex justify-between items-center px-1 pb-3',
        caption_label: 'text-2xl font-bold tracking-tight text-foreground capitalize',
        nav: 'flex items-center gap-1',
        nav_button:
          'inline-flex h-7 w-7 items-center justify-center rounded-md bg-transparent p-0 text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        nav_button_previous: 'static',
        nav_button_next: 'static',
        table: 'w-full border-collapse',
        head_row: 'flex',
        head_cell:
          'text-muted-foreground/70 w-10 h-8 font-semibold text-[11px] flex items-center justify-center',
        row: 'flex w-full mt-1',
        cell: 'h-10 w-10 text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
        day: 'inline-flex h-10 w-10 items-center justify-center rounded-full text-sm font-normal text-foreground transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-selected:opacity-100',
        day_range_end: 'day-range-end',
        day_today:
          'bg-foreground text-background font-semibold hover:bg-foreground hover:text-background focus:bg-foreground focus:text-background',
        day_selected:
          'bg-primary text-primary-foreground font-semibold hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
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
