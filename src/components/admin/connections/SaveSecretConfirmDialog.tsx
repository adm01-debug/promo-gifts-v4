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
import { motion } from 'framer-motion';
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
        className="max-w-lg"
        onEscapeKeyDown={(e) => isLoading && e.preventDefault()}
      >
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/10"
            >
              <Icon className="h-6 w-6 text-primary" />
            </motion.div>
            <div className="space-y-1">
              <AlertDialogTitle className="text-lg">
                {verb} {secretName}?
              </AlertDialogTitle>
              <AlertDialogDescription>
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
              className="my-2"
            />
          ) : (
            <SecretMaskedDiff
              currentSuffix={null}
              currentLength={null}
              newSuffix={newSuffix}
              newLength={newLength ?? newSuffix.length}
              newOnly
              className="my-2"
            />
          ))}

        {/* Impact */}
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <h4 className="mb-2 text-sm font-medium">Isto irá:</h4>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
              {isUpdate
                ? 'Substituir imediatamente o valor em uso por todas as integrações'
                : 'Ativar esta credencial para todas as integrações dependentes'}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
              Registrar a operação no histórico de auditoria
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
              {isUpdate
                ? 'Invalidar o valor anterior — quem ainda usar a chave antiga falhará'
                : 'Disparar verificação automática da nova chave'}
            </li>
          </ul>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive duration-200 animate-in fade-in"
          >
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={() => onConfirm()} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sim, {verb.toLowerCase()}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
