import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

interface ThemeResetDialogProps {
  onConfirm: () => void;
}

export function ThemeResetDialog({ onConfirm }: ThemeResetDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Original
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">Restaurar tema original?</AlertDialogTitle>
          <AlertDialogDescription>
            Isso irá reverter a skin, modo de cor e raio de borda para os valores padrão. Essa ação
            não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Restaurar padrão</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
