import { useState } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Code2, ShieldCheck, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { type AppRole, type UserWithRole } from "./types";

interface RoleChangeDialogProps {
  user: UserWithRole | null;
  onClose: () => void;
  onConfirm: (userId: string, newRole: AppRole) => void;
}

export function RoleChangeDialog({ user, onClose, onConfirm }: RoleChangeDialogProps) {
  const { isDev } = useAuth();
  const [selectedRole, setSelectedRole] = useState<AppRole | null>(user?.role ?? null);

  // Sync when user changes
  if (user && selectedRole === null) {
    setSelectedRole(user.role);
  }

  const handleClose = () => {
    setSelectedRole(null);
    onClose();
  };

  return (
    <AlertDialog open={!!user} onOpenChange={(open) => !open && handleClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Alterar papel do usuário</AlertDialogTitle>
          <AlertDialogDescription>
            Selecione o novo papel para <span className="font-semibold">{user?.full_name || "este usuário"}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Select value={selectedRole || undefined} onValueChange={(value) => setSelectedRole(value as AppRole)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione um papel" />
            </SelectTrigger>
            <SelectContent>
              {/* Dev só pode ser concedido por outro Dev */}
              {isDev && (
                <SelectItem value="dev">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-purple-600" />
                    <div>
                      <div className="font-medium">Dev</div>
                      <div className="text-xs text-muted-foreground">Acesso total, incluindo área técnica</div>
                    </div>
                  </div>
                </SelectItem>
              )}
              <SelectItem value="supervisor">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <div>
                    <div className="font-medium">Supervisor</div>
                    <div className="text-xs text-muted-foreground">Gestão comercial, descontos e cadastros</div>
                  </div>
                </div>
              </SelectItem>
              <SelectItem value="vendedor">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  <div>
                    <div className="font-medium">Agente</div>
                    <div className="text-xs text-muted-foreground">Acesso somente aos próprios dados</div>
                  </div>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleClose}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!selectedRole || selectedRole === user?.role}
            onClick={() => {
              if (user && selectedRole) {
                onConfirm(user.user_id, selectedRole);
                handleClose();
              }
            }}
          >
            Confirmar alteração
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
