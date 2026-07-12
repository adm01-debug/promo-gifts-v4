import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, KeyRound, Loader2 } from 'lucide-react';
import { m as motion } from 'framer-motion';
import { SecretMaskedDiff } from './SecretMaskedDiff';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secretName: string;
  /** When true → "atualizar" wording + diff preview; when false → "configurar" wording */
  isUpdate?: boolean;
  currentSuffix?: string | null;
  currentLength?: number | null;
  newSuffix?: string;
  newLength?: number;
  isLoading: boolean;
  /**
   * Mensagem de erro retornada pelo backend após uma tentativa fracassada.
   * Quando preenchida, o modal permanece aberto e exibe o aviso para o
   * usuário corrigir/repetir sem precisar reabrir o fluxo.
   */
  error?: string | null;
  onConfirm: () => Promise<void> | void;
}

/**
 * Confirmation modal for saving (set/update) a sensitive credential.
 * Mirrors the look & tone of RotateSecretConfirmDialog but uses a
 * neutral "info" treatment since saving is less destructive than rotating.
 */
export function SaveSecretConfirmDialog({
  open,
  onOpenChange,
  secretName,
  isUpdate,
  currentSuffix,
  currentLength,
  newSuffix,
  newLength,
  isLoading,
  error,
  onConfirm,
}: Props) {
  const handleOpenChange = (next: boolean) => {
    if (isLoading) return;
    onOpenChange(next);
  };

  const verb = isUpdate ? 'Atualizar' : 'Salvar';
  const Icon = isUpdate ? KeyRound : ShieldCheck;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent
        className="!max-w-lg w-[92vw] gap-0 overflow-hidden rounded-xl border border-border/60 bg-card/95 p-0 shadow-xl backdrop-blur-xl supports-[backdrop-filter]:bg-card/80"
        data-testid="save-secret-confirm-dialog"
        onEscapeKeyDown={(e) => isLoading && e.preventDefault()}
      >
        <div
          aria-hidden="true"
          className="h-[3px] w-full bg-gradient-to-r from-transparent via-primary to-transparent"
        />
        <div className="px-4 pb-1.5 pt-4">
          <AlertDialogHeader>
            <div className="flex items-start gap-3">
              <div className="relative flex-shrink-0">
                <span
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded-xl blur-lg opacity-60 bg-primary/30"
                />
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/20"
                >
                  <Icon className="h-[18px] w-[18px] text-primary" strokeWidth={2.2} />
                </motion.div>
              </div>
              <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                <AlertDialogTitle className="text-sm font-semibold leading-tight tracking-tight text-foreground">
                  {verb} {secretName}?
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
                  {isUpdate
                    ? 'Você está prestes a sobrescrever o valor atual desta credencial sensível.'
                    : 'Você está prestes a configurar esta credencial sensível pela primeira vez.'}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          {newSuffix !== undefined &&
            (isUpdate ? (
              <SecretMaskedDiff
                currentSuffix={currentSuffix ?? null}
                currentLength={currentLength ?? null}
                newSuffix={newSuffix}
                newLength={newLength ?? newSuffix.length}
                className="mt-3"
              />
            ) : (
              <SecretMaskedDiff
                currentSuffix={null}
                currentLength={null}
                newSuffix={newSuffix}
                newLength={newLength ?? newSuffix.length}
                newOnly
                className="mt-3"
              />
            ))}

          <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Isto irá:
            </h4>
            <ul className="space-y-1.5 text-xs text-foreground/80">
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary" />
                {isUpdate
                  ? 'Substituir imediatamente o valor em uso por todas as integrações'
                  : 'Ativar esta credencial para todas as integrações dependentes'}
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary" />
                Registrar a operação no histórico de auditoria
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-primary" />
                {isUpdate
                  ? 'Invalidar o valor anterior — quem ainda usar a chave antiga falhará'
                  : 'Disparar verificação automática da nova chave'}
              </li>
            </ul>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive duration-200 animate-in fade-in"
            >
              {error}
            </div>
          )}
        </div>

        <div className="mt-3 border-t border-border/50 bg-muted/20 px-4 py-2.5">
          <AlertDialogFooter className="gap-1.5 sm:gap-1.5">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="h-8 rounded-md px-3 text-xs"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => onConfirm()}
              disabled={isLoading}
              className="inline-flex h-[26px] min-h-[26px] items-center rounded-md px-3.5 text-xs font-semibold shadow-sm"
            >
              {isLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Sim, {verb.toLowerCase()}
            </Button>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
