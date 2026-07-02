/**
 * Harness dev-only para validação visual do AlertDialog "cru" com o mesmo
 * dimensionamento aplicado em `QuoteItemEditorSheet` (`!max-w-[358px] w-[92vw]`).
 *
 * Rota: /__test/alert-dialog?width=180
 * Sem auth, sem side-effects. Usado pelo spec `e2e/ui/alert-dialog-visual.spec.ts`.
 */
import { useSearchParams } from 'react-router-dom';
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

export default function AlertDialogHarness() {
  const [params] = useSearchParams();
  const width = Number(params.get('width') ?? '400');

  return (
    <div
      className="min-h-dvh w-full bg-background p-4"
      data-testid="harness-ready"
      data-harness-width={String(width)}
    >
      <div className="mx-auto" style={{ maxWidth: `${width}px` }}>
        <AlertDialog open>
          <AlertDialogContent
            data-testid="alert-dialog-content"
            className="!max-w-[358px] w-[92vw]"
          >
            <AlertDialogHeader>
              <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
              <AlertDialogDescription>
                Você tem alterações não salvas neste item. Deseja realmente fechar e
                descartá-las?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="alert-dialog-cancel">
                Continuar editando
              </AlertDialogCancel>
              <AlertDialogAction data-testid="alert-dialog-confirm">
                Descartar e fechar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
