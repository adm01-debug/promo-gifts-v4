/**
 * SelectionCheckbox — Premium unified selection indicator.
 *
 * Design strategy:
 * - Circular shape (harmonizes with product thumbnails and rounded cards)
 * - Glassmorphism unselected state (blends with any background)
 * - Smooth scale + opacity spring animation on enter
 * - Animated SVG checkmark with draw effect
 * - Three sizes: sm (table), md (list), lg (grid overlay)
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

type CheckboxSize = 'sm' | 'md' | 'lg';

interface SelectionCheckboxProps {
  checked: boolean;
  onChange: () => void;
  size?: CheckboxSize;
  className?: string;
  /** Animate entry with spring (for grid overlay mode) */
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

    const Wrapper = animateEntry ? motion.button : 'button';
    const wrapperProps = animateEntry
      ? {
          initial: { scale: 0, opacity: 0 },
          animate: { scale: 1, opacity: 1 },
          exit: { scale: 0, opacity: 0 },
          transition: { type: 'spring', stiffness: 500, damping: 28 },
          whileTap: { scale: 0.85 },
        }
      : {};

    return (
      <Wrapper
        ref={ref}
        type="button"
        className={cn(
          'relative flex items-center justify-center rounded-full transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
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
        {...wrapperProps}
      >
        <AnimatePresence>
          {checked && (
            <motion.svg
              key="check"
              className={s.icon}
              viewBox={s.viewBox}
              fill="none"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 600, damping: 25 }}
            >
              <motion.path
                d="M3 7l3 3 5-6"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.25, delay: 0.05 }}
              />
            </motion.svg>
          )}
        </AnimatePresence>
      </Wrapper>
    );
  },
);

SelectionCheckbox.displayName = 'SelectionCheckbox';
