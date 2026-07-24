// src/components/ui/calendar.tsx
// Design iPhone Calendar (iOS): mês em destaque à esquerda com chevron de
// dropdown, setas ‹ › à direita, weekdays de uma letra em cinza uppercase,
// domingos em vermelho (iOS red = destructive), dia de hoje em vermelho,
// selecionado em círculo preenchido, números grandes e espaçados como no
// app Calendário do iPhone.

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import type { Day } from 'date-fns';
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
      className={cn(
        // Mobile: área confortável (44×44 mín. por célula → ~7×44 = 308px de grid + padding).
        // Desktop (md:+): densidade compacta original (180px).
        'pointer-events-auto w-full max-w-[340px] select-none overflow-hidden p-3 md:w-[180px] md:min-w-[180px] md:max-w-[180px] md:p-1.5',
        className,
      )}
      formatters={{
        formatWeekdayName: (date) => {
          const narrow = ptBR.localize?.day(date.getDay() as Day, { width: 'narrow' }) ?? '';
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
        months: 'flex w-full flex-col sm:flex-row gap-2',
        month: 'flex w-full flex-col space-y-2 md:space-y-1',
        caption: 'flex justify-between items-start px-1 pt-0 pb-1 md:px-0.5 md:pb-0.5',
        caption_label:
          'text-[15px] md:text-[11px] font-bold tracking-tight leading-[1.1] text-destructive capitalize flex flex-col items-start gap-0 whitespace-pre-line',
        nav: 'flex items-center gap-2 md:gap-1.5',
        // Mobile: 44×44 tap target. Desktop: h-5 w-5 compacto.
        nav_button:
          'inline-flex h-11 w-11 md:h-5 md:w-5 items-center justify-center rounded-full bg-transparent p-0 text-destructive transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        nav_button_previous: 'static',
        nav_button_next: 'static',
        table: 'flex w-full min-w-0 flex-col border-collapse',
        head: 'block w-full',
        tbody: 'flex w-full flex-col gap-1 md:gap-0.5',
        head_row: 'flex w-full gap-0 pb-1 md:pb-0.5',

        head_cell:
          'flex-1 font-semibold uppercase tracking-[0.08em] text-[10px] md:text-[7px] leading-none text-muted-foreground/70 flex items-center justify-center',
        row: 'flex w-full gap-0',
        // aspect-square + flex-1 mantém proporção; em ~308px de grid → ~44px por célula no mobile.
        cell: 'flex-1 aspect-square text-center p-0 relative focus-within:relative focus-within:z-20 flex items-center justify-center',

        day: 'inline-flex h-full w-full items-center justify-center rounded-full text-[13px] md:text-[10px] leading-none font-normal text-foreground transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-selected:opacity-100',
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
        IconLeft: () => <ChevronLeft className="h-5 w-5 md:h-3 md:w-3" />,
        IconRight: () => <ChevronRight className="h-5 w-5 md:h-3 md:w-3" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
