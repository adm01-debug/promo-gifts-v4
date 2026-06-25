import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { useOverlayInteractivity } from '@/hooks/use-overlay-interactivity';

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-50 bg-[hsl(var(--overlay-color)/var(--overlay-opacity))] backdrop-blur-[var(--overlay-blur)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
    ref={ref}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

// ---------------------------------------------------------------------------
// A11y helpers
// ---------------------------------------------------------------------------

/**
 * BUG-A11Y-1 FIX (2026-06-25): Busca recursiva em profundidade arbitrária.
 *
 * A implementação anterior só verificava 2 níveis (children + grandchildren).
 * O ConfirmDialog (ui) tem AlertDialogTitle em NÍVEL 4:
 *   AlertDialogContent > AlertDialogHeader > div.flex > div.space-y-2 > AlertDialogTitle
 *
 * Com apenas 2 níveis, hasTitle=false → fallback sr-only é injetado → dois
 * <h2 id={titleId}> no DOM → IDs duplicados → Radix UI emite console.error.
 *
 * A recursão tem limite de profundidade (maxDepth=8) para evitar percorrer
 * árvores arbitrariamente grandes em componentes com muitos filhos.
 */
function childrenHaveType(
  children: React.ReactNode,
  types: Array<React.ElementType | string>,
  maxDepth = 8,
): boolean {
  if (maxDepth === 0) return false;
  let found = false;
  React.Children.forEach(children, (child) => {
    if (found) return;
    if (!React.isValidElement(child)) return;
    const t = child.type as React.ElementType;
    if (
      types.some((match) => match === t || (t as { displayName?: string }).displayName === match)
    ) {
      found = true;
      return;
    }
    const nested = (child.props as { children?: React.ReactNode }).children;
    if (nested && maxDepth > 1) {
      found = childrenHaveType(nested, types, maxDepth - 1);
    }
  });
  return found;
}

const TITLE_TYPES: Array<React.ElementType | string> = [
  AlertDialogPrimitive.Title,
  'AlertDialogTitle',
];
const DESCRIPTION_TYPES: Array<React.ElementType | string> = [
  AlertDialogPrimitive.Description,
  'AlertDialogDescription',
];

// ---------------------------------------------------------------------------

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, children, onCloseAutoFocus, ...props }, ref) => {
  const hasTitle = childrenHaveType(children, TITLE_TYPES);
  const hasDescription = childrenHaveType(children, DESCRIPTION_TYPES);
  const { handleClose } = useOverlayInteractivity();

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        ref={ref}
        {...props}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          handleClose();
        }}
        className={cn(
          'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border-2 border-border bg-background p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-2xl',
          className,
        )}
      >
        {!hasTitle && (
          <AlertDialogPrimitive.Title className="sr-only" aria-hidden={false}>
            Confirmação de ação
          </AlertDialogPrimitive.Title>
        )}
        {!hasDescription && (
          <AlertDialogPrimitive.Description className="sr-only">
            Por favor, confirme se deseja prosseguir com esta ação.
          </AlertDialogPrimitive.Description>
        )}
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPortal>
  );
});
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2 text-center sm:text-left', className)} {...props} />
);
AlertDialogHeader.displayName = 'AlertDialogHeader';

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);
AlertDialogFooter.displayName = 'AlertDialogFooter';

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold', className)}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

const AlertDialogAction = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
));
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Cancel>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: 'outline' }), 'mt-2 sm:mt-0', className)}
    {...props}
  />
));
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
