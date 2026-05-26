import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Input — shadcn/ui base field with accessibility auto-fix.
 *
 * A11y rules enforced:
 * - Every <input> MUST have an `id` attribute (Chrome DevTools: "form field
 *   should have an id or name attribute").
 * - Every <input> MUST have a `name` attribute so the browser can autocomplete
 *   and form serialisation works correctly.
 *
 * Resolution order:
 *   id   → explicit prop → derive from `name` → React.useId() stable fallback
 *   name → explicit prop → same value as resolved id
 *
 * This means a bare <Input /> gets a unique, stable id/name pair at no cost
 * to the caller. Callers that already supply id/name are unaffected.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, id, name, ...props }, ref) => {
    const fallbackId = React.useId();
    // Resolve id: explicit > derived from name > unique fallback
    const resolvedId = id ?? name ?? fallbackId;
    // Resolve name: explicit > same as id so the field is always serialisable
    const resolvedName = name ?? resolvedId;

    return (
      <input
        type={type}
        id={resolvedId}
        name={resolvedName}
        className={cn(
          "flex h-11 w-full rounded-lg border border-border bg-background px-4 py-2 text-sm ring-offset-background",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground/60 font-medium",
          "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:border-primary",
          "transition-all duration-300 shadow-soft",
          "hover:border-border-strong hover:shadow-medium",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
