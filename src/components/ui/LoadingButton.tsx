import { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { Button, type ButtonProps } from './button';
import { cn } from '@/lib/utils';

interface LoadingButtonProps extends ButtonProps {
  isLoading?: boolean;
  loadingText?: string;
  successText?: string;
  isSuccess?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

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
        {isLoading ? (
          <span className="flex animate-fade-in items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {loadingText && <span>{loadingText}</span>}
          </span>
        ) : isSuccess ? (
          <span className="flex animate-fade-in items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-4 w-4">
              <path
                d="M5 13l4 4L19 7"
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {successText || children}
          </span>
        ) : (
          <span className="flex items-center gap-2">
            {icon && iconPosition === 'left' && icon}
            {children}
            {icon && iconPosition === 'right' && icon}
          </span>
        )}
      </Button>
    );
  },
);

LoadingButton.displayName = 'LoadingButton';

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
        {isLoading ? (
          <span className="animate-fade-in">
            <Loader2 className="h-4 w-4 animate-spin" />
          </span>
        ) : (
          <span>{children}</span>
        )}
      </Button>
    );
  },
);

IconButton.displayName = 'IconButton';
