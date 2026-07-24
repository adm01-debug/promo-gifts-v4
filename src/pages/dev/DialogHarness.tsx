/**
 * Harness dev-only para validação visual do Dialog genérico (`@/components/ui/dialog`)
 * com o mesmo dimensionamento aplicado em drawers/sheets do orçamento
 * (`!max-w-[358px] w-[92vw]`).
 *
 * Rota: /__test/dialog?width=180
 * Sem auth, sem side-effects. Usado pelo spec `e2e/ui/dialog-visual.spec.ts`.
 */
import { useSearchParams } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function DialogHarness() {
  const [params] = useSearchParams();
  const width = Number(params.get('width') ?? '400');

  return (
    <div
      className="min-h-dvh w-full bg-background p-4"
      data-testid="harness-ready"
      data-harness-width={String(width)}
    >
      <div className="mx-auto" style={{ maxWidth: `${width}px` }}>
        <Dialog open>
          <DialogContent
            data-testid="dialog-content"
            className="!max-w-[358px] w-[92vw]"
          >
            <DialogHeader>
              <DialogTitle>Compartilhar orçamento</DialogTitle>
              <DialogDescription>
                Gere um link público de leitura para enviar ao cliente por WhatsApp
                ou e-mail.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" data-testid="dialog-cancel">
                Cancelar
              </Button>
              <Button data-testid="dialog-confirm">Gerar link</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
