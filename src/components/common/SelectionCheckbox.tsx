/**
 * SelectionCheckbox — Premium unified selection indicator.
 */
import React from 'react';

import { cn } from '@/lib/utils';

type CheckboxSize = 'lg' | 'md' | 'sm';

interface SelectionCheckboxProps {
  checked: boolean;
  onChange: () => void;
  size?: CheckboxSize;
  className?: string;
  animateEntry?: boolean;
}

const sizeMap: Record<CheckboxSize, { box: string; icon: string; viewBox: string }> = {
  sm: { box: 'w-5 h-5', icon: 'w-3 h-3', viewBox: '0 0 14 14' },
  md: { box: 'w-6 h-6', icon: 'w-3.5 h-3.5', viewBox: '0 0 14 14' },
  lg: { box: 'w-7 h-7', icon: 'w-4 h-4', viewBox: '0 0 14 14' },
};

export const SelectionCheckbox = React.forwardRef<HTMLButtonElement, SelectionCheckboxProps>(
  ({ checked, onChange, size = 'md', className, animateEntry = false }, ref) => {
    const s = sizeMap[size];

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'relative flex items-center justify-center rounded-full transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
          animateEntry && 'animate-scale-in',
          s.box,
          checked
            ? 'border-2 border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25'
            : [
                'border-2 border-foreground/20',
                'bg-background/60 backdrop-blur-sm',
                'hover:border-primary/50 hover:bg-primary/10',
                'hover:shadow-sm',
              ],
          className,
        )}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          onChange();
        }}
        aria-label={checked ? 'Desselecionar' : 'Selecionar'}
      >
        {checked && (
          <svg className={cn(s.icon, 'animate-scale-in')} viewBox={s.viewBox} fill="none">
            <path
              d="M3 7l3 3 5-6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    );
  },
);

SelectionCheckbox.displayName = 'SelectionCheckbox';
