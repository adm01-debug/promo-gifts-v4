/**
 * Harness dev-only para validação visual do ConfirmDialog.
 *
 * Rota: /__test/confirm-dialog?variant=destructive&width=180
 * Sem auth, sem redes, sem side-effects. Usado exclusivamente por Playwright
 * (spec `e2e/ui/confirm-dialog-visual.spec.ts`) para regressão de layout.
 *
 * Query params:
 *   - variant: default | destructive | warning | info (default: destructive)
 *   - width:   número em px aplicado como max-width no wrapper (default: 400)
 *
 * O ConfirmDialog é renderizado inline (não portal) via `open` controlado,
 * e a página propaga `data-testid="harness-ready"` para o Playwright aguardar.
 */
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

type Variant = 'default' | 'destructive' | 'info' | 'warning';

const VARIANT_COPY: Record<Variant, { title: string; description: string; confirm: string; confirmShort: string }> = {
  default: {
    title: 'Confirmar ação?',
    description: 'Você deseja prosseguir com esta operação?',
    confirm: 'Prosseguir agora',
    confirmShort: 'Prosseguir',
  },
  destructive: {
    title: 'Descartar alterações?',
    description: 'Você tem alterações não salvas neste item. Deseja realmente fechar e descartá-las?',
    confirm: 'Descartar e fechar',
    confirmShort: 'Descartar',
  },
  warning: {
    title: 'Aplicar em lote?',
    description: 'Isso irá afetar múltiplos itens do orçamento.',
    confirm: 'Aplicar tudo',
    confirmShort: 'Aplicar',
  },
  info: {
    title: 'Enviar para revisão?',
    description: 'O item será enviado para revisão do gerente antes da aprovação.',
    confirm: 'Enviar agora',
    confirmShort: 'Enviar',
  },
};

export default function ConfirmDialogHarness() {
  const [params] = useSearchParams();
  const variant = (params.get('variant') as Variant) || 'destructive';
  const width = Number(params.get('width') ?? '400');

  const copy = useMemo(() => VARIANT_COPY[variant] ?? VARIANT_COPY.destructive, [variant]);

  return (
    <div
      className="min-h-dvh w-full bg-background p-4"
      data-testid="harness-ready"
      data-harness-variant={variant}
      data-harness-width={String(width)}
    >
      <div
        className="mx-auto"
        style={{ maxWidth: `${width}px` }}
        data-testid="harness-wrapper"
      >
        <ConfirmDialog
          open
          onOpenChange={() => {}}
          variant={variant}
          title={copy.title}
          description={copy.description}
          confirmLabel={copy.confirm}
          confirmLabelShort={copy.confirmShort}
          cancelLabel="Continuar editando"
          cancelLabelShort="Continuar"
          onConfirm={() => {}}
        />
      </div>
    </div>
  );
}
