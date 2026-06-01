/**
 * Dialogs extracted from AdminTemplatesManager
 */
import { Button } from '@/components/ui/button';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, UserPlus, Users } from 'lucide-react';

interface Seller {
  id: string;
  full_name: string | null;
  email: string;
}

interface DeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function TemplateDeleteDialog({ open, onClose, onConfirm }: DeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir template?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. O template será permanentemente excluído.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface CloneDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sellers: Seller[];
  targetSellerId: string;
  setTargetSellerId: (id: string) => void;
}

export function TemplateCloneDialog({
  open,
  onClose,
  onConfirm,
  sellers,
  targetSellerId,
  setTargetSellerId,
}: CloneDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Clonar Template para Vendedor
          </DialogTitle>
          <DialogDescription>
            Selecione o vendedor que receberá uma cópia deste template.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <label className="mb-2 block text-sm font-medium">Vendedor Destino</label>
          <Select value={targetSellerId} onValueChange={setTargetSellerId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um vendedor..." />
            </SelectTrigger>
            <SelectContent>
              {sellers.map((seller) => (
                <SelectItem key={seller.id} value={seller.id}>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{seller.full_name || seller.email}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={!targetSellerId}>
            <Copy className="mr-2 h-4 w-4" />
            Clonar Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
