import * as React from 'react';
import type { DialogProps } from '@radix-ui/react-dialog';
import { Command as CommandPrimitive } from 'cmdk';
import { Search } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      'flex h-full w-full flex-col overflow-hidden rounded-md text-popover-foreground [background-color:hsl(var(--command-surface))]',
      className,
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

type CommandDialogProps = DialogProps & {
  /** Accessible label read by screen readers for the search dialog.
   *  Defaults to "Busca rápida". Override when context differs. */
  dialogTitle?: string;
  contentClassName?: string;
};

/**
 * CommandDialog — wraps CommandPrimitive inside a Radix Dialog.
 *
 * A11y notes:
 *   - `<DialogTitle className="sr-only">` satisfies Radix's requirement
 *     that every DialogContent has an accessible name; it is visually
 *     hidden so it doesn't affect layout.
 *   - `aria-describedby={undefined}` is passed explicitly so Radix
 *     recognises the prop key and suppresses the "Missing Description"
 *     console warning. Relying on the auto-injection in dialog.tsx is
 *     not sufficient because Radix's check runs in a useEffect and
 *     tests `props['aria-describedby'] !== undefined`, which evaluates
 *     to false even when the prop is spread with value undefined.
 */
const CommandDialog = ({
  children,
  dialogTitle = 'Busca rápida',
  contentClassName,
  ...props
}: CommandDialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent
        className={cn(
          'max-w-[560px] overflow-hidden !rounded-2xl bg-[hsl(var(--command-surface))] p-0 shadow-[0_24px_80px_hsl(var(--command-shadow))] [border-color:hsl(var(--command-border))] [&>div]:overflow-hidden',
          contentClassName,
        )}
        showCloseButton={false}
        // ── A11y: explicitly opt-out of description ──────────────────────
        // Radix checks `'aria-describedby' in props` (key presence, not
        // value) to determine whether the omission is intentional.
        // Passing `undefined` explicitly satisfies that check.
        aria-describedby={undefined}
      >
        {/* Visually-hidden title — gives screen readers an accessible
            dialog name without affecting the visual layout. */}
        <DialogTitle className="sr-only">{dialogTitle}</DialogTitle>

        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
};

/**
 * CommandInput — a11y-patched wrapper around cmdk's CommandPrimitive.Input.
 *
 * Problems fixed (Chrome DevTools > Problems tab):
 *   - "A form field element should have an id or name attribute" (19 resources)
 *   - "No label associated with a form field" (6 resources)
 *
 * cmdk's raw <input> bypasses the custom Input component (which auto-generates
 * id/name via React.useId()). Every CommandInput instance on the page was
 * emitting both warnings.
 *
 * Resolution order (same pattern as Input/Textarea):
 *   id   -> explicit prop -> React.useId() stable fallback
 *   name -> explicit prop -> same value as resolved id
 *   aria-label -> explicit prop -> 'Buscar' default
 */
const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, id, name, 'aria-label': ariaLabel, ...props }, ref) => {
  const fallbackId = React.useId();
  const resolvedId = id ?? fallbackId;
  const resolvedName = name ?? resolvedId;

  return (
    <div
      className="flex items-center border-b px-3 [border-color:hsl(var(--command-border))] [&:has(input:focus)]:ring-0"
      cmdk-input-wrapper=""
    >
      {/* aria-hidden: purely decorative; the aria-label on the input provides the accessible name */}
      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
      <CommandPrimitive.Input
        ref={ref}
        id={resolvedId}
        name={resolvedName}
        aria-label={ariaLabel ?? 'Buscar'}
        className={cn(
          'flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none ring-0 placeholder:text-muted-foreground focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    </div>
  );
});

CommandInput.displayName = CommandPrimitive.Input.displayName;

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn(
      'max-h-[300px] overflow-y-auto overflow-x-hidden [background-color:hsl(var(--command-surface))]',
      className,
    )}
    {...props}
  />
));

CommandList.displayName = CommandPrimitive.List.displayName;

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm" {...props} />
));

CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      'overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:[color:hsl(var(--command-text-subtle))]',
      className,
    )}
    {...props}
  />
));

CommandGroup.displayName = CommandPrimitive.Group.displayName;

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 h-px [background-color:hsl(var(--command-border))]', className)}
    {...props}
  />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm border border-transparent px-2 py-1.5 text-sm outline-none transition-[background-color,border-color,color] [background-color:transparent] data-[disabled=true]:pointer-events-none data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50 data-[selected='true']:[background-color:hsl(var(--command-accent))] data-[selected=true]:[border-color:hsl(var(--command-border-strong))]",
      className,
    )}
    {...props}
  />
));

CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)}
      {...props}
    />
  );
};
CommandShortcut.displayName = 'CommandShortcut';

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
