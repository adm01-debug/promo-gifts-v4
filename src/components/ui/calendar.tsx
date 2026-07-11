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
      formatters={{
        formatWeekdayName: (date) => {
          const narrow = ptBR.localize?.day(date.getDay() as import('date-fns').Day, { width: 'narrow' }) ?? '';
          return narrow.charAt(0).toUpperCase();
        },
        formatCaption: (date) => {
          const month = date.toLocaleDateString('pt-BR', { month: 'long' });
          const year = date.getFullYear();
          return `${month.charAt(0).toUpperCase()}${month.slice(1)}\n${year}` as unknown as string;
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
        months: 'flex w-full flex-col sm:flex-row gap-3',
        month: 'flex w-full flex-col space-y-1',
        caption: 'flex justify-between items-start px-0.5 pt-0 pb-1',
        caption_label:
          'text-[14px] font-bold tracking-tight leading-[1.1] text-destructive capitalize flex flex-col items-start gap-0 whitespace-pre-line',
        nav: 'flex items-center gap-2',
        nav_button:
          'inline-flex h-6 w-6 items-center justify-center rounded-full bg-transparent p-0 text-destructive transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        nav_button_previous: 'static',
        nav_button_next: 'static',
        table: 'flex w-full min-w-0 flex-col border-collapse',
        head: 'block w-full',
        tbody: 'flex w-full flex-col gap-1',
        head_row: 'flex w-full gap-0 pb-1',


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
