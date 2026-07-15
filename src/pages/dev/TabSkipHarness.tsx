/**
 * Harness dev-only para validar que elementos NÃO focáveis (disabled,
 * aria-disabled com tabIndex=-1, hidden, display:none, visibility:hidden,
 * fora do viewport e inert) NÃO entram no loop de Tab e NÃO alteram o
 * token declarativo de `focus-visible:ring-*` dos vizinhos.
 *
 * Rota: /__test/tab-skip (sem auth, sem side-effects).
 */
import { cn } from '@/lib/utils';

const RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

interface Node {
  id: string;
  label: string;
  focusable: boolean;
  render: () => React.ReactElement;
}

const NODES: Node[] = [
  {
    id: 'focus-1',
    label: 'focus-1',
    focusable: true,
    render: () => (
      <button type="button" data-testid="focus-1" className={cn('rounded border px-3 py-2', RING)}>
        F1
      </button>
    ),
  },
  {
    id: 'disabled',
    label: 'disabled (HTML)',
    focusable: false,
    render: () => (
      <button
        type="button"
        disabled
        data-testid="skip-disabled"
        className={cn('rounded border px-3 py-2 opacity-50', RING)}
      >
        disabled
      </button>
    ),
  },
  {
    id: 'focus-2',
    label: 'focus-2',
    focusable: true,
    render: () => (
      <button type="button" data-testid="focus-2" className={cn('rounded border px-3 py-2', RING)}>
        F2
      </button>
    ),
  },
  {
    id: 'aria-disabled',
    label: 'aria-disabled + tabIndex=-1',
    focusable: false,
    render: () => (
      <button
        type="button"
        aria-disabled="true"
        tabIndex={-1}
        data-testid="skip-aria-disabled"
        className={cn('rounded border px-3 py-2 opacity-50', RING)}
      >
        aria-disabled
      </button>
    ),
  },
  {
    id: 'focus-3',
    label: 'focus-3',
    focusable: true,
    render: () => (
      <button type="button" data-testid="focus-3" className={cn('rounded border px-3 py-2', RING)}>
        F3
      </button>
    ),
  },
  {
    id: 'hidden-attr',
    label: 'hidden',
    focusable: false,
    render: () => (
      <button type="button" hidden data-testid="skip-hidden" className={cn('rounded border px-3 py-2', RING)}>
        hidden
      </button>
    ),
  },
  {
    id: 'focus-4',
    label: 'focus-4',
    focusable: true,
    render: () => (
      <button type="button" data-testid="focus-4" className={cn('rounded border px-3 py-2', RING)}>
        F4
      </button>
    ),
  },
  {
    id: 'display-none',
    label: 'display:none',
    focusable: false,
    render: () => (
      <button
        type="button"
        style={{ display: 'none' }}
        data-testid="skip-display-none"
        className={cn('rounded border px-3 py-2', RING)}
      >
        display-none
      </button>
    ),
  },
  {
    id: 'visibility-hidden',
    label: 'visibility:hidden',
    focusable: false,
    render: () => (
      <button
        type="button"
        style={{ visibility: 'hidden' }}
        data-testid="skip-visibility-hidden"
        className={cn('rounded border px-3 py-2', RING)}
      >
        visibility-hidden
      </button>
    ),
  },
  {
    id: 'focus-5',
    label: 'focus-5',
    focusable: true,
    render: () => (
      <button type="button" data-testid="focus-5" className={cn('rounded border px-3 py-2', RING)}>
        F5
      </button>
    ),
  },
  {
    id: 'inert',
    label: 'inert wrapper',
    focusable: false,
    render: () => (
      // @ts-expect-error — `inert` é um atributo HTML válido; tipos do React podem não expor.
      <div inert="" data-testid="inert-wrapper">
        <button
          type="button"
          data-testid="skip-inert-child"
          className={cn('rounded border px-3 py-2', RING)}
        >
          inside-inert
        </button>
      </div>
    ),
  },
  {
    id: 'focus-6',
    label: 'focus-6',
    focusable: true,
    render: () => (
      <button type="button" data-testid="focus-6" className={cn('rounded border px-3 py-2', RING)}>
        F6
      </button>
    ),
  },
  {
    id: 'offscreen',
    label: 'fora do layout (position:absolute; left:-9999px)',
    // NOTE: fora-de-viewport CONTINUA no loop de Tab por padrão do navegador
    // (só a11y-hidden puro não remove tabbability). Marcamos com tabIndex=-1
    // para representar o padrão correto de "fora do layout + fora do loop".
    focusable: false,
    render: () => (
      <button
        type="button"
        tabIndex={-1}
        data-testid="skip-offscreen"
        style={{ position: 'absolute', left: '-9999px', top: 'auto' }}
        className={cn('rounded border px-3 py-2', RING)}
      >
        offscreen
      </button>
    ),
  },
  {
    id: 'focus-7',
    label: 'focus-7',
    focusable: true,
    render: () => (
      <button type="button" data-testid="focus-7" className={cn('rounded border px-3 py-2', RING)}>
        F7
      </button>
    ),
  },
];

export default function TabSkipHarness() {
  const focusables = NODES.filter((n) => n.focusable).map((n) => n.id);

  return (
    <main
      data-testid="tab-skip-ready"
      data-focusable-ids={focusables.join(',')}
      className="min-h-dvh bg-background p-6"
    >
      <h1 className="mb-4 text-sm font-semibold text-foreground">Tab-skip harness</h1>
      <div className="flex flex-wrap items-center gap-2">
        {NODES.map((n) => (
          <span key={n.id} data-node={n.id}>
            {n.render()}
          </span>
        ))}
      </div>
    </main>
  );
}
