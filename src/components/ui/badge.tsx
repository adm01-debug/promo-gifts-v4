import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 active:scale-95 cursor-default',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-soft hover:-translate-y-0.5 active:translate-y-0',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-soft',
        destructive:
          'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-soft',
        success:
          'border-transparent bg-success text-success-foreground hover:bg-success/90 hover:shadow-soft',
        outline:
          'text-foreground border-border-strong hover:bg-accent hover:text-accent-foreground hover:border-primary/50 hover:shadow-soft',
        gradient: 'border-transparent bg-gradient-primary text-primary-foreground shadow-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />;
  },
);
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
