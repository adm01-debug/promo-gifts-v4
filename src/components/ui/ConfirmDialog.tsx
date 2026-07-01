import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog';
import { cn } from '@/lib/utils';
import { AlertTriangle, Trash2, Info, HelpCircle, Loader2, type LucideIcon } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void> | void;
  onCancel?: () => void;
  variant?: 'default' | 'destructive' | 'info' | 'warning';
  icon?: LucideIcon;
  loading?: boolean;
  impactPreview?: {
    title: string;
    items: string[];
  };
  /** Optional stable testid forwarded to AlertDialogContent for E2E selectors. */
  testId?: string;
}

const variantConfig = {
  default: {
    icon: HelpCircle,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/10',
    iconRing: 'ring-primary/20',
    iconGlow: 'bg-primary/30',
    buttonVariant: 'default' as const,
  },
  destructive: {
    icon: Trash2,
    iconColor: 'text-destructive',
    iconBg: 'bg-destructive/10',
    iconRing: 'ring-destructive/20',
    iconGlow: 'bg-destructive/30',
    buttonVariant: 'destructive' as const,
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-warning',
    iconBg: 'bg-warning/10',
    iconRing: 'ring-warning/20',
    iconGlow: 'bg-warning/30',
    buttonVariant: 'default' as const,
  },
  info: {
    icon: Info,
    iconColor: 'text-info',
    iconBg: 'bg-info/10',
    iconRing: 'ring-info/20',
    iconGlow: 'bg-info/30',
    buttonVariant: 'default' as const,
  },
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
  variant = 'default',
  icon: CustomIcon,
  loading = false,
  impactPreview,
  testId,
}: ConfirmDialogProps) {
  const config = variantConfig[variant];
  const Icon = CustomIcon || config.icon;

  const handleConfirm = async () => {
    await onConfirm();
    if (!loading) {
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const yesTestId = testId ? `${testId}-yes` : 'confirm-dialog-yes';
  const noTestId = testId ? `${testId}-no` : 'confirm-dialog-no';
  const titleTestId = testId ? `${testId}-title` : 'confirm-dialog-title';
  const descriptionTestId = testId ? `${testId}-description` : 'confirm-dialog-description';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="max-w-md gap-0 overflow-hidden rounded-2xl border border-border/60 bg-card/95 p-0 shadow-2xl backdrop-blur-xl supports-[backdrop-filter]:bg-card/80"
        data-testid={testId}
      >
        {/* Top accent bar — sutil, casa com a variante */}
        <div
          aria-hidden="true"
          className={cn('h-[3px] w-full', {
            'bg-gradient-to-r from-transparent via-primary to-transparent': variant === 'default',
            'bg-gradient-to-r from-transparent via-destructive to-transparent':
              variant === 'destructive',
            'bg-gradient-to-r from-transparent via-warning to-transparent': variant === 'warning',
            'bg-gradient-to-r from-transparent via-info to-transparent': variant === 'info',
          })}
        />

        <div className="px-6 pb-2 pt-6">
          <AlertDialogHeader>
            <div className="flex items-start gap-4">
              {/* Icon tile com glow suave */}
              <div className="relative flex-shrink-0">
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-0 -z-10 rounded-2xl blur-xl opacity-60',
                    config.iconGlow,
                  )}
                />
                <div
                  className={cn(
                    'flex h-12 w-12 animate-scale-in items-center justify-center rounded-2xl ring-1 ring-inset transition-transform duration-300 hover:scale-105',
                    config.iconBg,
                    config.iconRing,
                  )}
                >
                  <Icon className={cn('h-6 w-6', config.iconColor)} strokeWidth={2.2} />
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                <AlertDialogTitle
                  className="text-[17px] font-semibold leading-tight tracking-tight text-foreground"
                  data-testid={titleTestId}
                >
                  {title}
                </AlertDialogTitle>
                {description && (
                  <AlertDialogDescription
                    className="text-sm leading-relaxed text-muted-foreground"
                    data-testid={descriptionTestId}
                  >
                    {description}
                  </AlertDialogDescription>
                )}
              </div>
            </div>
          </AlertDialogHeader>

          {/* Impact Preview */}
          {impactPreview && (
            <div
              className="animate-fade-in-up mt-5 rounded-xl border border-border/60 bg-muted/40 p-4"
              data-testid={testId ? `${testId}-impact` : 'confirm-dialog-impact'}
            >
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {impactPreview.title}
              </h4>
              <ul className="stagger-children space-y-1.5">
                {impactPreview.items.map((item, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-foreground/80"
                  >
                    <span
                      className={cn(
                        'mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full',
                        config.iconColor.replace('text-', 'bg-'),
                      )}
                    />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Divisor sutil + footer */}
        <div className="mt-4 border-t border-border/50 bg-muted/20 px-6 py-4">
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel
              onClick={handleCancel}
              disabled={loading}
              data-testid={noTestId}
              className="mt-0 h-10 rounded-lg border-border/70 bg-transparent px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {cancelLabel}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={loading}
              data-testid={yesTestId}
              className={cn(
                'h-10 rounded-lg px-5 text-sm font-semibold shadow-sm transition-all hover:shadow-md active:scale-[0.98]',
                variant === 'destructive' &&
                  'bg-destructive text-destructive-foreground shadow-destructive/20 hover:bg-destructive/90 hover:shadow-destructive/30',
                variant === 'default' && 'shadow-primary/20 hover:shadow-primary/30',
                variant === 'info' && 'bg-info text-info-foreground hover:bg-info/90',
                variant === 'warning' && 'bg-warning text-warning-foreground hover:bg-warning/90',
              )}
            >
              {loading && (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  data-testid={testId ? `${testId}-loading` : 'confirm-dialog-loading'}
                />
              )}
              {confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// Delete Confirmation
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  entityName,
  itemName,
  onConfirm,
  loading,
  affectedItems,
  testId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName: string;
  itemName?: string;
  onConfirm: () => Promise<void> | void;
  loading?: boolean;
  affectedItems?: string[];
  /** Optional testid scope. Defaults to `delete-confirm-dialog`. */
  testId?: string;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      variant="destructive"
      title={`Excluir ${entityName}?`}
      description={
        itemName
          ? `Você está prestes a excluir "${itemName}". Esta ação não pode ser desfeita.`
          : `Você está prestes a excluir este ${entityName}. Esta ação não pode ser desfeita.`
      }
      confirmLabel="Excluir"
      cancelLabel="Cancelar"
      onConfirm={onConfirm}
      loading={loading}
      testId={testId ?? 'delete-confirm-dialog'}
      impactPreview={
        affectedItems && affectedItems.length > 0
          ? {
              title: 'Isso irá afetar:',
              items: affectedItems,
            }
          : undefined
      }
    />
  );
}

// Unsaved Changes Dialog
export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onDiscard,
  onSave,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
  onSave?: () => Promise<void> | void;
  loading?: boolean;
}) {
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      variant="warning"
      title="Alterações não salvas"
      description="Você tem alterações que não foram salvas. Deseja descartar as alterações ou salvá-las?"
      confirmLabel={onSave ? 'Salvar' : 'Descartar'}
      cancelLabel="Continuar editando"
      onConfirm={onSave || onDiscard}
      onCancel={() => onOpenChange(false)}
      loading={loading}
    />
  );
}
