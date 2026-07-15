import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Clickable } from '../Clickable';

describe('Clickable', () => {
  it('renderiza como div com role=button e tabIndex=0 por padrão', () => {
    render(<Clickable onClick={() => {}}>Ação</Clickable>);
    const el = screen.getByRole('button', { name: 'Ação' });
    expect(el.tagName).toBe('DIV');
    expect(el).toHaveAttribute('tabindex', '0');
  });

  it('dispara onClick por mouse', () => {
    const onClick = vi.fn();
    render(<Clickable onClick={onClick}>Ir</Clickable>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each([['Enter'], [' ']])('dispara onClick por tecla %s', (key) => {
    const onClick = vi.fn();
    render(<Clickable onClick={onClick}>Ir</Clickable>);
    fireEvent.keyDown(screen.getByRole('button'), { key });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ignora teclas irrelevantes', () => {
    const onClick = vi.fn();
    render(<Clickable onClick={onClick}>Ir</Clickable>);
    fireEvent.keyDown(screen.getByRole('button'), { key: 'a' });
    fireEvent.keyDown(screen.getByRole('button'), { key: 'ArrowDown' });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled bloqueia mouse e teclado + define aria-disabled + tabIndex=-1', () => {
    const onClick = vi.fn();
    render(
      <Clickable onClick={onClick} disabled>
        Ir
      </Clickable>,
    );
    const el = screen.getByRole('button');
    expect(el).toHaveAttribute('aria-disabled', 'true');
    expect(el).toHaveAttribute('tabindex', '-1');
    fireEvent.click(el);
    fireEvent.keyDown(el, { key: 'Enter' });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('strictTarget=true ignora tecla vinda de filho', () => {
    const onClick = vi.fn();
    render(
      <Clickable onClick={onClick} strictTarget>
        <button type="button" data-testid="inner">
          filho
        </button>
      </Clickable>,
    );
    // tecla no filho não dispara pai
    fireEvent.keyDown(screen.getByTestId('inner'), { key: 'Enter' });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('propaga isPressed / isSelected / isExpanded para ARIA', () => {
    render(
      <Clickable onClick={() => {}} isPressed isSelected isExpanded={false}>
        x
      </Clickable>,
    );
    const el = screen.getByRole('button');
    expect(el).toHaveAttribute('aria-pressed', 'true');
    expect(el).toHaveAttribute('aria-selected', 'true');
    expect(el).toHaveAttribute('aria-expanded', 'false');
  });

  it('permite override de role', () => {
    render(
      <Clickable onClick={() => {}} role="link">
        L
      </Clickable>,
    );
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('renderiza como elemento customizado via prop as', () => {
    render(
      <Clickable as="span" onClick={() => {}}>
        span
      </Clickable>,
    );
    expect(screen.getByRole('button').tagName).toBe('SPAN');
  });

  it('preventDefault chamado ao apertar Space (evita scroll da página)', () => {
    const onClick = vi.fn();
    render(<Clickable onClick={onClick}>Ir</Clickable>);
    const el = screen.getByRole('button');
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    const prevented = !el.dispatchEvent(event);
    expect(prevented).toBe(true);
    expect(onClick).toHaveBeenCalled();
  });
});
