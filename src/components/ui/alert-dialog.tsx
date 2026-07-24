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
// Title & Description — declarados ANTES de AlertDialogContent para que possam
// ser referenciados diretamente em TITLE_TYPES / DESCRIPTION_TYPES.
//
// BUG-A11Y-2 ROOT CAUSE FIX (2026-06-25):
// A versão anterior declarava AlertDialogTitle/Description APÓS AlertDialogContent,
// impossibilitando referenciá-los em TITLE_TYPES/DESCRIPTION_TYPES. O fallback
// de string 'AlertDialogTitle' também estava errado: o Radix define displayName
// como 'AlertDialog.Title' (com ponto), não 'AlertDialogTitle'. Resultado:
//   • childrenHaveType() sempre retornava false mesmo quando AlertDialogTitle
//     já estava no tree → fallback sr-only era SEMPRE injetado.
//   • Dois AlertDialogPrimitive.Title no DOM → IDs duplicados → console.error
//     do Radix sobre Title obrigatório + console.warn sobre Description ausente.
// Fix: mover as declarações para cima + adicionar referências diretas de componente
// (match por identidade de objeto, 100% robusto, independe de displayName).
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// A11y helpers
// ---------------------------------------------------------------------------

/**
 * BUG-A11Y-1 FIX (2026-06-25): Busca recursiva em profundidade arbitrária.
 *
 * BUG-A11Y-2 FIX (2026-06-25): TITLE_TYPES agora inclui referências diretas
 * aos componentes AlertDialogTitle e AlertDialogDescription declarados acima.
 * A match por identidade de objeto (match === t) é O(1) e 100% confiável —
 * independe de displayName, que varia por versão do Radix e pode incluir
 * ponto ('AlertDialog.Title') em vez do esperado ('AlertDialogTitle').
 * Mantemos os fallbacks de string 'AlertDialogTitle' e 'AlertDialog.Title'
 * para resistência a re-exports, wrappers externos e versões futuras do Radix.
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
  AlertDialogPrimitive.Title, // Radix primitive diretamente
  AlertDialogTitle,           // BUG-A11Y-2 FIX: referência ao wrapper exportado
  'AlertDialogTitle',         // fallback legacy (re-exports, mocks)
  'AlertDialog.Title',        // fallback: displayName real que o Radix define
];
const DESCRIPTION_TYPES: Array<React.ElementType | string> = [
  AlertDialogPrimitive.Description, // Radix primitive diretamente
  AlertDialogDescription,            // BUG-A11Y-2 FIX: referência ao wrapper exportado
  'AlertDialogDescription',          // fallback legacy
  'AlertDialog.Description',         // fallback: displayName real que o Radix define
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
