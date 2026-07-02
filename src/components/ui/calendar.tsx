// src/components/ui/calendar.tsx
// Redesign estilo iOS: header grande à esquerda, weekdays de 1 letra,
// dia de hoje em círculo branco, domingo em vermelho.

import * as React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { ptBR } from 'date-fns/locale';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  modifiers,
  modifiersClassNames,
  formatters,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      locale={ptBR}
      showOutsideDays={showOutsideDays}
      className={cn('pointer-events-auto p-3', className)}
      formatters={{
        formatWeekdayName: (date) =>
          ptBR.localize?.day(date.getDay(), { width: 'narrow' }).toUpperCase() ?? '',
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
        caption: 'flex justify-between items-center pt-1 px-1 pb-2',
        caption_label: 'text-xl font-bold capitalize tracking-tight text-foreground',
        nav: 'flex items-center gap-1',
        nav_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-7 w-7 p-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/50',
        ),
        nav_button_previous: 'static',
        nav_button_next: 'static',
        table: 'w-full border-collapse border-t border-border/40 pt-2',
        head_row: 'flex',
        head_cell:
          'text-muted-foreground/60 w-10 h-6 font-medium text-[10px] flex items-center justify-center',
        row: 'flex w-full mt-1',
        cell: 'h-10 w-10 text-center text-sm p-0 relative focus-within:relative focus-within:z-20',
        day: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-10 w-10 p-0 font-normal rounded-full transition-colors hover:bg-accent/50 aria-selected:opacity-100',
        ),
        day_range_end: 'day-range-end',
        day_today:
          'bg-foreground text-background font-semibold hover:bg-foreground hover:text-background focus:bg-foreground focus:text-background',
        day_selected:
          'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
        day_outside: 'day-outside opacity-0 pointer-events-none',
        day_disabled: 'text-muted-foreground/25',
        day_range_middle: 'aria-selected:bg-accent/60 aria-selected:text-accent-foreground rounded-none',
        day_hidden: 'invisible',
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
