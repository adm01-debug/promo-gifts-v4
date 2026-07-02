/**
 * Harness dev-only para regressão visual do UndoToast.
 *
 * Renderiza `UndoToastContent` diretamente na página (sem portal do sonner)
 * com `frozenMs` para congelar o contador e desativar animações — snapshots
 * PNG estáveis no CI, sem flakiness de timing.
 *
 * Rotas:
 *   /__test/undo-toast?width=375&frozenMs=3000
 *   /__test/undo-toast?width=375&stack=3        (3 toasts empilhados)
 *
 * Sem auth, sem side-effects. Usado por `e2e/ui/undo-toast-visual.spec.ts`.
 */
import { useSearchParams } from 'react-router-dom';
import { UndoToastContent } from '@/utils/undoToast';

const NOOP = () => {};

const SAMPLE_TITLES = [
  'Item removido',
  'Coleção movida para lixeira',
  'Orçamento arquivado',
];

const SAMPLE_DESCRIPTIONS = [
  'Caneca Ecológica Bambu 350ml',
  'Kit Premium — 12 itens',
  'PED-26-0142',
];

export default function UndoToastHarness() {
  const [params] = useSearchParams();
  const width = Number(params.get('width') ?? '375');
  const frozenMs = Number(params.get('frozenMs') ?? '3000');
  const stack = Math.max(1, Math.min(5, Number(params.get('stack') ?? '1')));
  const duration = Number(params.get('duration') ?? '5000');

  return (
    <div
      className="min-h-dvh w-full bg-background p-4"
      data-testid="harness-ready"
      data-harness-width={String(width)}
      data-harness-stack={String(stack)}
      data-harness-frozen-ms={String(frozenMs)}
    >
      <div
        className="mx-auto flex flex-col gap-2"
        style={{ maxWidth: `${width}px` }}
        data-testid="undo-toast-stack"
      >
        {Array.from({ length: stack }).map((_, i) => (
          <div
            key={i}
            data-testid={`undo-toast-slot-${i}`}
            className="rounded-xl border border-border/60 bg-card/95 px-3 py-2.5 shadow-lg backdrop-blur-md"
          >
            <UndoToastContent
              title={SAMPLE_TITLES[i % SAMPLE_TITLES.length]}
              description={SAMPLE_DESCRIPTIONS[i % SAMPLE_DESCRIPTIONS.length]}
              duration={duration}
              frozenMs={frozenMs}
              onUndo={NOOP}
              onTimeout={NOOP}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
