import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Code2, ShieldCheck, Shield, UserCog } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { type AppRole, type UserWithRole } from './types';

interface RoleChangeDialogProps {
  user: UserWithRole | null;
  onClose: () => void;
  onConfirm: (userId: string, newRole: AppRole) => void;
}

export function RoleChangeDialog({ user, onClose, onConfirm }: RoleChangeDialogProps) {
  const { isDev } = useAuth();
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(user?.role ?? null);

  if (user && selectedRole === null) {
    setSelectedRole(user.role);
  }

  const handleClose = () => {
    setSelectedRole(null);
    onClose();
  };

  return (
    <AlertDialog open={!!user} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent className="!max-w-[420px] w-[92vw] gap-0 overflow-hidden rounded-xl border border-border/60 bg-card/95 p-0 shadow-xl backdrop-blur-xl supports-[backdrop-filter]:bg-card/80" data-testid="role-change-confirm-dialog">
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
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-inset ring-primary/20">
                  <UserCog className="h-[18px] w-[18px] text-primary" strokeWidth={2.2} />
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                <AlertDialogTitle className="text-sm font-semibold leading-tight tracking-tight text-foreground">
                  Alterar papel do usuário
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground">
                  Selecione o novo papel para{' '}
                  <span className="font-semibold text-foreground">
                    {user?.full_name || 'este usuário'}
                  </span>
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="mt-3">
            <Select
              value={selectedRole || undefined}
              onValueChange={(value) => setSelectedRole(value as AppRole)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um papel" />
              </SelectTrigger>
              <SelectContent>
                {isDev && (
                  <SelectItem value="dev">
                    <div className="flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-primary" />
                      <div>
                        <div className="font-medium">Dev</div>
                        <div className="text-xs text-muted-foreground">
                          Acesso total, incluindo área técnica
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                )}
                <SelectItem value="supervisor">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <div>
                      <div className="font-medium">Supervisor</div>
                      <div className="text-xs text-muted-foreground">
                        Gestão comercial, descontos e cadastros
                      </div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="vendedor">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Agente</div>
                      <div className="text-xs text-muted-foreground">
                        Acesso somente aos próprios dados
                      </div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="mt-3 border-t border-border/50 bg-muted/20 px-4 py-2.5">
          <AlertDialogFooter className="gap-1.5 sm:gap-1.5">
            <AlertDialogCancel
              onClick={handleClose}
              className="mt-0 h-8 whitespace-nowrap rounded-md border-border/70 bg-transparent px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!selectedRole || selectedRole === user?.role}
              onClick={() => {
                if (user && selectedRole) {
                  onConfirm(user.user_id, selectedRole);
                  handleClose();
                }
              }}
              className="inline-flex h-8 items-center whitespace-nowrap rounded-md px-3.5 text-xs font-semibold shadow-sm transition-all hover:shadow-md active:scale-[0.98] disabled:opacity-60"
            >
              Confirmar alteração
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
