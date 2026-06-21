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
    buttonVariant: 'default' as const,
  },
  destructive: {
    icon: Trash2,
    iconColor: 'text-destructive',
    iconBg: 'bg-destructive/10',
    buttonVariant: 'destructive' as const,
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-warning',
    iconBg: 'bg-warning/10',
    buttonVariant: 'default' as const,
  },
  info: {
    icon: Info,
    iconColor: 'text-info',
    iconBg: 'bg-info/10',
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

  // Quando o consumidor passa um `testId` (ex.: "cart-confirm-dialog"),
  // derivamos testids específicos para os botões e título — ex.:
  // "cart-confirm-dialog-yes" / "cart-confirm-dialog-no" / "cart-confirm-dialog-title".
  // Isso elimina o uso do testid genérico "confirm-dialog-yes" quando vários
  // diálogos podem coexistir na mesma tela. Os genéricos continuam disponíveis
  // como fallback para compatibilidade com specs já existentes.
  const yesTestId = testId ? `${testId}-yes` : 'confirm-dialog-yes';
  const noTestId = testId ? `${testId}-no` : 'confirm-dialog-no';
  const titleTestId = testId ? `${testId}-title` : 'confirm-dialog-title';
  const descriptionTestId = testId ? `${testId}-description` : 'confirm-dialog-description';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md" data-testid={testId}>
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'flex h-12 w-12 flex-shrink-0 animate-scale-in items-center justify-center rounded-full',
                config.iconBg,
              )}
            >
              <Icon className={cn('h-6 w-6', config.iconColor)} />
            </div>
            <div className="space-y-2">
              <AlertDialogTitle className="text-lg" data-testid={titleTestId}>
                {title}
              </AlertDialogTitle>
              {description && (
                <AlertDialogDescription data-testid={descriptionTestId}>
                  {description}
                </AlertDialogDescription>
              )}
            </div>
          </div>
        </AlertDialogHeader>

        {/* Impact Preview */}
        {impactPreview && (
          <div
            className="animate-fade-in-up my-4 rounded-lg border border-border bg-muted/50 p-4"
            data-testid={testId ? `${testId}-impact` : 'confirm-dialog-impact'}
          >
            <h4 className="mb-2 text-sm font-medium">{impactPreview.title}</h4>
            <ul className="stagger-children space-y-1">
              {impactPreview.items.map((item, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={loading} data-testid={noTestId}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            data-testid={yesTestId}
            className={cn(
              variant === 'destructive' &&
                'bg-destructive text-destructive-foreground hover:bg-destructive/90',
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
