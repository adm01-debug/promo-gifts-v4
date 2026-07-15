/**
 * DEPRECATED — mantido apenas para retrocompatibilidade da API antiga
 * (`confirmText`/`cancelText`). Use `@/components/ui/ConfirmDialog` diretamente.
 * Este wrapper delega ao SSOT para garantir o layout moderno único.
 */
import { useState } from 'react';
import { ConfirmDialog as SsotConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';

type ConfirmVariant = 'default' | 'destructive' | 'success' | 'warning';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
}

const iconMap = {
  default: Info,
  destructive: XCircle,
  warning: AlertTriangle,
  success: CheckCircle2,
} as const;

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'default',
  loading = false,
}: ConfirmDialogProps) {
  const ssotVariant: 'default' | 'destructive' | 'info' | 'warning' =
    variant === 'success' ? 'info' : variant;
  return (
    <SsotConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title={title}
      description={description}
      confirmLabel={loading ? 'Processando...' : confirmText}
      cancelLabel={cancelText}
      variant={ssotVariant}
      icon={iconMap[variant]}
      loading={loading}
    />
  );
}

export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant: ConfirmVariant;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    variant: 'default',
    onConfirm: () => {},
  });

  const confirm = (
    title: string,
    description: string,
    onConfirm: () => void,
    variant: ConfirmVariant = 'default',
  ) => {
    setState({ open: true, title, description, variant, onConfirm });
  };

  const ConfirmDialogComponent = () => (
    <ConfirmDialog
      open={state.open}
      onOpenChange={(open) => setState((s) => ({ ...s, open }))}
      onConfirm={() => {
        state.onConfirm();
        setState((s) => ({ ...s, open: false }));
      }}
      title={state.title}
      description={state.description}
      variant={state.variant}
    />
  );

  return { confirm, ConfirmDialog: ConfirmDialogComponent };
}
