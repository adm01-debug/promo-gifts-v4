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
      className={cn('pointer-events-auto p-1.5', className)}
      formatters={{
        // fix_version: calendar-ios-type-safe-2026-07-03 — cast Day para satisfazer date-fns typings
        formatWeekdayName: (date) => {
          const narrow = ptBR.localize?.day(date.getDay() as import('date-fns').Day, { width: 'narrow' }) ?? '';
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
        months: 'flex w-full flex-col sm:flex-row gap-4',
        month: 'flex w-full flex-col',
        caption: 'flex justify-between items-center px-0.5 pt-0.5 pb-1.5 mb-1',
        caption_label: 'text-[15px] font-bold tracking-tight leading-none text-foreground capitalize',
        nav: 'flex items-center gap-0.5',
        nav_button:
          'inline-flex h-6 w-6 items-center justify-center rounded-full bg-transparent p-0 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        nav_button_previous: 'static',
        nav_button_next: 'static',
        table: 'flex w-full min-w-0 flex-col border-collapse',
        head: 'block w-full',
        tbody: 'flex w-full flex-col justify-between',
        head_row: 'flex w-full justify-between gap-0',
        head_cell:
          'w-[14.285714%] shrink-0 font-medium uppercase tracking-wider text-[10px] text-muted-foreground/60 flex items-center justify-center',
        row: 'flex w-full justify-between gap-0',
        cell: 'w-[14.285714%] shrink-0 aspect-square text-center text-[11px] p-0 relative focus-within:relative focus-within:z-20 flex items-center justify-center',

        day: 'inline-flex h-full w-full items-center justify-center rounded-full text-[11px] font-normal text-foreground transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-selected:opacity-100',
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
        IconLeft: () => <ChevronLeft className="h-3.5 w-3.5" />,
        IconRight: () => <ChevronRight className="h-3.5 w-3.5" />,
      }}

      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
