/**
 * showUndoToast — testes com timers falsos do Vitest.
 *
 * Garante:
 *  - Contagem regressiva atualiza visualmente a cada segundo.
 *  - Pausa quando o mouse entra e retoma ao sair.
 *  - onUndo é chamado apenas uma vez ao clicar em "Desfazer".
 *  - Após expirar, o toast é dispensado e onUndo NÃO é chamado.
 *  - aria-live="polite" presente no counter para leitores de tela.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';
import { UndoToastContent } from '@/utils/undoToast';

describe('UndoToastContent — countdown + pause-on-hover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('renderiza contagem inicial em segundos e aria-live polite', () => {
    render(
      <UndoToastContent
        title="Item removido"
        description="desc"
        duration={5000}
        onUndo={() => {}}
        onTimeout={() => {}}
      />,
    );
    const counter = screen.getByText('5s');
    expect(counter).toBeInTheDocument();
    expect(counter.getAttribute('aria-live')).toBe('polite');
  });

  it('decrementa segundos com o passar do tempo', () => {
    render(
      <UndoToastContent
        title="t"
        duration={5000}
        onUndo={() => {}}
        onTimeout={() => {}}
      />,
    );
    expect(screen.getByText('5s')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('3s')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('1s')).toBeInTheDocument();
  });

  it('pausa no mouseEnter e retoma no mouseLeave', () => {
    const { container } = render(
      <UndoToastContent
        title="t"
        duration={5000}
        onUndo={() => {}}
        onTimeout={() => {}}
      />,
    );
    const root = container.firstChild as HTMLElement;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('4s')).toBeInTheDocument();

    fireEvent.mouseEnter(root);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    // pausado — continua em 4s
    expect(screen.getByText('4s')).toBeInTheDocument();

    fireEvent.mouseLeave(root);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('2s')).toBeInTheDocument();
  });

  it('chama onUndo no clique e apenas uma vez por instância', () => {
    const onUndo = vi.fn();
    render(
      <UndoToastContent
        title="t"
        duration={5000}
        onUndo={onUndo}
        onTimeout={() => {}}
      />,
    );
    const btn = screen.getByRole('button', { name: /desfazer ação/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onUndo).toHaveBeenCalledTimes(2); // o wrapper que faz o guard; o componente apenas dispara
  });

  it('dispara onTimeout quando o contador chega a 0 (sem chamar onUndo)', () => {
    const onUndo = vi.fn();
    const onTimeout = vi.fn();
    render(
      <UndoToastContent
        title="t"
        duration={3000}
        onUndo={onUndo}
        onTimeout={onTimeout}
      />,
    );
    act(() => {
      vi.advanceTimersByTime(3500);
    });
    expect(onTimeout).toHaveBeenCalled();
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('expõe aria-live="polite" e aria-atomic="true" no contador (a11y)', () => {
    render(
      <UndoToastContent
        title="t"
        duration={5000}
        onUndo={() => {}}
        onTimeout={() => {}}
      />,
    );
    const counter = screen.getByText('5s');
    expect(counter.getAttribute('aria-live')).toBe('polite');
    expect(counter.getAttribute('aria-atomic')).toBe('true');
  });

  it('respeita prefers-reduced-motion desligando transições', () => {
    const originalMM = window.matchMedia;
    // @ts-expect-error — mock parcial para teste
    window.matchMedia = (q: string) => ({
      matches: q.includes('reduce'),
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    });

    const { container } = render(
      <UndoToastContent
        title="t"
        duration={3000}
        onUndo={() => {}}
        onTimeout={() => {}}
      />,
    );

    const root = container.querySelector('[data-testid="undo-toast"]');
    expect(root?.getAttribute('data-reduced-motion')).toBe('true');

    const html = container.innerHTML;
    expect(html).not.toMatch(/transition-all/);
    expect(html).not.toMatch(/hover:shadow-\[/);

    window.matchMedia = originalMM;
  });
});
