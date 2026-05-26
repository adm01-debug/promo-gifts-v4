import * as React from 'react';

import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Textarea — shadcn/ui base field with accessibility auto-fix.
 *
 * A11y rules enforced (same pattern as Input):
 * - Every <textarea> MUST have an `id` attribute.
 * - Every <textarea> MUST have a `name` attribute.
 *
 * Resolution order:
 *   id   → explicit prop → derive from `name` → React.useId() stable fallback
 *   name → explicit prop → same value as resolved id
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, id, name, ...props }, ref) => {
    const fallbackId = React.useId();
    const resolvedId = id ?? name ?? fallbackId;
    const resolvedName = name ?? resolvedId;

    return (
      <textarea
        id={resolvedId}
        name={resolvedName}
        className={cn(
          'flex min-h-[80px] w-full rounded-lg border border-border bg-background px-4 py-3 text-sm font-medium',
          'ring-offset-background placeholder:text-muted-foreground/60',
          'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25',
          'hover:border-border-strong hover:shadow-medium',
          'shadow-soft transition-all duration-300',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'resize-y',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
