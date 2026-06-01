import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from './button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface LoadingButtonProps extends ButtonProps {
  isLoading?: boolean;
  loadingText?: string;
  successText?: string;
  isSuccess?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

/**
 * LoadingButton - Button with loading state and optional success state
 * Shows spinner when loading, optional success state with checkmark
 */
export const LoadingButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      children,
      isLoading = false,
      loadingText,
      successText,
      isSuccess = false,
      icon,
      iconPosition = 'left',
      disabled,
      className,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <Button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'relative overflow-hidden',
          isLoading && 'cursor-wait',
          isSuccess && 'bg-success hover:bg-success/90',
          className,
        )}
        {...props}
      >
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.span
              key="loading"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              {loadingText && <span>{loadingText}</span>}
            </motion.span>
          ) : isSuccess ? (
            <motion.span
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-2"
            >
              <motion.svg
                viewBox="0 0 24 24"
                className="h-4 w-4"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.3 }}
              >
                <motion.path
                  d="M5 13l4 4L19 7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </motion.svg>
              {successText || children}
            </motion.span>
          ) : (
            <motion.span
              key="default"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2"
            >
              {icon && iconPosition === 'left' && icon}
              {children}
              {icon && iconPosition === 'right' && icon}
            </motion.span>
          )}
        </AnimatePresence>
      </Button>
    );
  },
);

LoadingButton.displayName = 'LoadingButton';

/**
 * IconButton - Compact button for icons only
 */
export const IconButton = forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ children, isLoading, className, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        size="icon"
        className={cn('relative', isLoading && 'cursor-wait', className)}
        disabled={props.disabled || isLoading}
        {...props}
        aria-label="AnimatePresence"
      >
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.span
              key="loading"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
            >
              <Loader2 className="h-4 w-4 animate-spin" />
            </motion.span>
          ) : (
            <motion.span
              key="icon"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              {children}
            </motion.span>
          )}
        </AnimatePresence>
      </Button>
    );
  },
);

IconButton.displayName = 'IconButton';
