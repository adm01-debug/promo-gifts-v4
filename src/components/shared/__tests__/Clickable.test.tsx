/**
 * Suíte exaustiva do <Clickable>. Cobre comportamento core, a11y, passthrough,
 * polymorphism (`as`), ref forwarding e estados combinados.
 *
 * Ver plano em qa/CLICKABLE_EXHAUSTIVE_AUDIT.md.
 */
import { describe, it, expect, vi } from 'vitest';
import { createRef, forwardRef, useRef, type ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Clickable } from '../Clickable';

// Fake motion.div — evita depender do runtime do framer-motion dentro do jsdom.
// Um forwardRef que renderiza `<div>` e captura todos os props extras (motion
// props caem no passthrough e viram atributos no DOM sob `data-motion-*`).
const FakeMotionDiv = forwardRef<
  HTMLDivElement,
  Record<string, unknown> & { children?: ReactNode }
>((props, ref) => {
  const {
    children,
    layout,
    initial,
    animate,
    transition,
    whileHover,
    variants,
    exit,
    layoutId,
    ...rest
  } = props as Record<string, unknown> & { children?: ReactNode };
  const motionAttrs: Record<string, string> = {};
  if (layout !== undefined) motionAttrs['data-motion-layout'] = String(layout);
  if (initial !== undefined) motionAttrs['data-motion-initial'] = 'set';
  if (animate !== undefined) motionAttrs['data-motion-animate'] = 'set';
  if (transition !== undefined) motionAttrs['data-motion-transition'] = 'set';
  if (whileHover !== undefined) motionAttrs['data-motion-whilehover'] = 'set';
  if (variants !== undefined) motionAttrs['data-motion-variants'] = 'set';
  if (exit !== undefined) motionAttrs['data-motion-exit'] = 'set';
  if (layoutId !== undefined) motionAttrs['data-motion-layoutid'] = String(layoutId);
  return (
    <div ref={ref} {...(rest as React.HTMLAttributes<HTMLDivElement>)} {...motionAttrs}>
      {children as ReactNode}
    </div>
  );
});

// Fake shadcn Card — forwardRef, aceita className.
const FakeCard = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...rest }, ref) => (
    <div ref={ref} data-fake-card="true" className={`card-base ${className ?? ''}`} {...rest}>
      {children}
    </div>
  ),
);

describe('Clickable — comportamento core', () => {
  it('renderiza como div com role=button e tabIndex=0 por padrão', () => {
    render(<Clickable onClick={() => {}}>Ação</Clickable>);
    const el = screen.getByRole('button', { name: 'Ação' });
    expect(el.tagName).toBe('DIV');
    expect(el).toHaveAttribute('tabindex', '0');
  });

  it('click de mouse dispara onClick uma vez', () => {
    const onClick = vi.fn();
    render(<Clickable onClick={onClick}>Ir</Clickable>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('Enter dispara onClick + preventDefault', () => {
    const onClick = vi.fn();
    render(<Clickable onClick={onClick}>Ir</Clickable>);
    const el = screen.getByRole('button');
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    const notPrevented = el.dispatchEvent(event);
    expect(notPrevented).toBe(false); // preventDefault chamado
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('Space dispara onClick + preventDefault (evita scroll)', () => {
    const onClick = vi.fn();
    render(<Clickable onClick={onClick}>Ir</Clickable>);
    const el = screen.getByRole('button');
    const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    const notPrevented = el.dispatchEvent(event);
    expect(notPrevented).toBe(false);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it.each(['Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'a', 'z', '1', 'Shift', 'Control'])(
    'tecla %s NÃO dispara onClick',
    (key) => {
      const onClick = vi.fn();
      render(<Clickable onClick={onClick}>Ir</Clickable>);
      fireEvent.keyDown(screen.getByRole('button'), { key });
      expect(onClick).not.toHaveBeenCalled();
    },
  );

  it('handler recebe evento não-nulo', () => {
    const onClick = vi.fn();
    render(<Clickable onClick={onClick}>x</Clickable>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick.mock.calls[0][0]).toBeTruthy();
    expect(onClick.mock.calls[0][0].type).toBe('click');
  });

  it('strictTarget=true bloqueia teclado quando target !== currentTarget', () => {
    const onClick = vi.fn();
    render(
      <Clickable onClick={onClick} strictTarget>
        <button type="button" data-testid="inner">
          filho
        </button>
      </Clickable>,
    );
    fireEvent.keyDown(screen.getByTestId('inner'), { key: 'Enter' });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('strictTarget=true permite teclado quando target === currentTarget', () => {
    const onClick = vi.fn();
    render(
      <Clickable onClick={onClick} strictTarget>
        <span data-testid="child">x</span>
      </Clickable>,
    );
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('sem strictTarget teclado no filho ainda dispara pai', () => {
    const onClick = vi.fn();
    render(
      <Clickable onClick={onClick}>
        <span data-testid="child">x</span>
      </Clickable>,
    );
    fireEvent.keyDown(screen.getByTestId('child'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Clickable — disabled', () => {
  it('disabled=true bloqueia mouse', () => {
    const onClick = vi.fn();
    render(
      <Clickable onClick={onClick} disabled>
        x
      </Clickable>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled=true bloqueia Enter', () => {
    const onClick = vi.fn();
    render(
      <Clickable onClick={onClick} disabled>
        x
      </Clickable>,
    );
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled=true bloqueia Space', () => {
    const onClick = vi.fn();
    render(
      <Clickable onClick={onClick} disabled>
        x
      </Clickable>,
    );
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('disabled=true define aria-disabled, tabIndex=-1 e classes de estado', () => {
    render(
      <Clickable onClick={() => {}} disabled>
        x
      </Clickable>,
    );
    const el = screen.getByRole('button');
    expect(el).toHaveAttribute('aria-disabled', 'true');
    expect(el).toHaveAttribute('tabindex', '-1');
    expect(el.className).toMatch(/cursor-not-allowed/);
    expect(el.className).toMatch(/opacity-60/);
    expect(el.className).toMatch(/pointer-events-none/);
  });

  it('disabled=false não emite aria-disabled', () => {
    render(<Clickable onClick={() => {}}>x</Clickable>);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-disabled');
  });
});

describe('Clickable — a11y ARIA', () => {
  it('default role=button', () => {
    render(<Clickable onClick={() => {}}>x</Clickable>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it.each(['link', 'menuitem', 'tab', 'option', 'switch'])('override role=%s', (role) => {
    render(
      <Clickable onClick={() => {}} role={role}>
        x
      </Clickable>,
    );
    expect(screen.getByRole(role as 'link')).toBeInTheDocument();
  });

  it.each([
    [true, 'true'],
    [false, 'false'],
  ])('isPressed=%s → aria-pressed=%s', (isPressed, expected) => {
    render(
      <Clickable onClick={() => {}} isPressed={isPressed}>
        x
      </Clickable>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', expected);
  });

  it('isPressed=undefined → aria-pressed ausente', () => {
    render(<Clickable onClick={() => {}}>x</Clickable>);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed');
  });

  it.each([
    [true, 'true'],
    [false, 'false'],
  ])('isSelected=%s → aria-selected=%s', (isSelected, expected) => {
    render(
      <Clickable onClick={() => {}} isSelected={isSelected}>
        x
      </Clickable>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-selected', expected);
  });

  it.each([
    [true, 'true'],
    [false, 'false'],
  ])('isExpanded=%s → aria-expanded=%s', (isExpanded, expected) => {
    render(
      <Clickable onClick={() => {}} isExpanded={isExpanded}>
        x
      </Clickable>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', expected);
  });

  it('aria-label renderiza como accessible name', () => {
    render(
      <Clickable onClick={() => {}} aria-label="Abrir card">
        <span aria-hidden="true">🎯</span>
      </Clickable>,
    );
    expect(screen.getByRole('button', { name: 'Abrir card' })).toBeInTheDocument();
  });

  it('aria-labelledby renderiza', () => {
    render(
      <>
        <span id="lbl">Rótulo externo</span>
        <Clickable onClick={() => {}} aria-labelledby="lbl">
          x
        </Clickable>
      </>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-labelledby', 'lbl');
  });

  it('aria-describedby renderiza', () => {
    render(
      <Clickable onClick={() => {}} aria-describedby="desc">
        x
      </Clickable>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('aria-describedby', 'desc');
  });

  it('tabIndex custom sobrescreve default', () => {
    render(
      // eslint-disable-next-line jsx-a11y/tabindex-no-positive
      <Clickable onClick={() => {}} tabIndex={5}>
        x
      </Clickable>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '5');
  });

  it('tabIndex=-1 quando disabled tem prioridade sobre custom', () => {
    render(
      // eslint-disable-next-line jsx-a11y/tabindex-no-positive
      <Clickable onClick={() => {}} tabIndex={5} disabled>
        x
      </Clickable>,
    );
    expect(screen.getByRole('button')).toHaveAttribute('tabindex', '-1');
  });
});

describe('Clickable — passthrough de props', () => {
  it('data-testid chega ao DOM', () => {
    render(
      <Clickable onClick={() => {}} data-testid="tid-a">
        x
      </Clickable>,
    );
    expect(screen.getByTestId('tid-a')).toBeInTheDocument();
  });

  it('data-* custom sobrevive', () => {
    render(
      <Clickable
        onClick={() => {}}
        data-testid="tid-b"
        data-selected="yes"
        data-analytics-id="btn-42"
      >
        x
      </Clickable>,
    );
    const el = screen.getByTestId('tid-b');
    expect(el).toHaveAttribute('data-selected', 'yes');
    expect(el).toHaveAttribute('data-analytics-id', 'btn-42');
  });

  it('aria-* custom sobrevive', () => {
    render(
      <Clickable
        onClick={() => {}}
        aria-haspopup="menu"
        aria-controls="menu-1"
        aria-current="page"
        data-testid="tid-c"
      >
        x
      </Clickable>,
    );
    const el = screen.getByTestId('tid-c');
    expect(el).toHaveAttribute('aria-haspopup', 'menu');
    expect(el).toHaveAttribute('aria-controls', 'menu-1');
    expect(el).toHaveAttribute('aria-current', 'page');
  });

  it('title (HTML attr) chega', () => {
    render(
      <Clickable onClick={() => {}} title="Dica" data-testid="t">
        x
      </Clickable>,
    );
    expect(screen.getByTestId('t')).toHaveAttribute('title', 'Dica');
  });

  it('id chega', () => {
    render(
      <Clickable onClick={() => {}} id="btn-x">
        x
      </Clickable>,
    );
    expect(screen.getByRole('button').id).toBe('btn-x');
  });

  it('style inline chega', () => {
    render(
      <Clickable onClick={() => {}} style={{ backgroundColor: 'red', padding: '4px' }}>
        x
      </Clickable>,
    );
    const el = screen.getByRole('button');
    expect(el.style.backgroundColor).toBe('red');
    expect(el.style.padding).toBe('4px');
  });

  it('onMouseEnter/onMouseLeave chegam ao DOM', () => {
    const enter = vi.fn();
    const leave = vi.fn();
    render(
      <Clickable onClick={() => {}} onMouseEnter={enter} onMouseLeave={leave}>
        x
      </Clickable>,
    );
    const el = screen.getByRole('button');
    fireEvent.mouseEnter(el);
    fireEvent.mouseLeave(el);
    expect(enter).toHaveBeenCalledTimes(1);
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('onFocus/onBlur chegam', () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    render(
      <Clickable onClick={() => {}} onFocus={onFocus} onBlur={onBlur}>
        x
      </Clickable>,
    );
    const el = screen.getByRole('button');
    fireEvent.focus(el);
    fireEvent.blur(el);
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('className do usuário é mergeado (mantém defaults)', () => {
    render(
      <Clickable onClick={() => {}} className="custom-x">
        x
      </Clickable>,
    );
    const el = screen.getByRole('button');
    expect(el.className).toMatch(/custom-x/);
    expect(el.className).toMatch(/cursor-pointer/);
  });

  it('motion props (layout/initial/animate/transition/whileHover/variants/exit/layoutId) chegam ao componente motion', () => {
    render(
      <Clickable
        as={FakeMotionDiv}
        onClick={() => {}}
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        whileHover={{ scale: 1.05 }}
        variants={{ v: { opacity: 1 } }}
        exit={{ opacity: 0 }}
        layoutId="lid-1"
        data-testid="motion-el"
      >
        x
      </Clickable>,
    );
    const el = screen.getByTestId('motion-el');
    expect(el).toHaveAttribute('data-motion-layout', 'true');
    expect(el).toHaveAttribute('data-motion-initial', 'set');
    expect(el).toHaveAttribute('data-motion-animate', 'set');
    expect(el).toHaveAttribute('data-motion-transition', 'set');
    expect(el).toHaveAttribute('data-motion-whilehover', 'set');
    expect(el).toHaveAttribute('data-motion-variants', 'set');
    expect(el).toHaveAttribute('data-motion-exit', 'set');
    expect(el).toHaveAttribute('data-motion-layoutid', 'lid-1');
  });
});

describe('Clickable — polymorphism (as)', () => {
  it.each([
    ['div', 'DIV'],
    ['span', 'SPAN'],
    ['article', 'ARTICLE'],
    ['li', 'LI'],
    ['section', 'SECTION'],
  ])('as=%s renderiza tag %s', (as, tag) => {
    render(
      <Clickable as={as as 'div'} onClick={() => {}}>
        x
      </Clickable>,
    );
    expect(screen.getByRole('button').tagName).toBe(tag);
  });

  it('as={motion.div} renderiza como div (FakeMotionDiv)', () => {
    render(
      <Clickable as={FakeMotionDiv} onClick={() => {}} data-testid="m">
        x
      </Clickable>,
    );
    expect(screen.getByTestId('m').tagName).toBe('DIV');
  });

  it('as={FakeCard} — className mergea com base da Card', () => {
    render(
      <Clickable as={FakeCard} onClick={() => {}} className="ck-extra" data-testid="c">
        conteudo
      </Clickable>,
    );
    const el = screen.getByTestId('c');
    expect(el).toHaveAttribute('data-fake-card', 'true');
    expect(el.className).toMatch(/card-base/);
    expect(el.className).toMatch(/ck-extra/);
  });
});

describe('Clickable — ref forwarding', () => {
  it('encaminha ref para HTMLElement (div default)', () => {
    const ref = createRef<HTMLElement>();
    render(
      <Clickable ref={ref} onClick={() => {}}>
        x
      </Clickable>,
    );
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current?.tagName).toBe('DIV');
  });

  it('ref.current.focus() funciona', () => {
    const ref = createRef<HTMLElement>();
    render(
      <Clickable ref={ref} onClick={() => {}}>
        x
      </Clickable>,
    );
    ref.current?.focus();
    expect(document.activeElement).toBe(ref.current);
  });

  it('ref funciona com as={FakeMotionDiv}', () => {
    const ref = createRef<HTMLElement>();
    render(
      <Clickable ref={ref} as={FakeMotionDiv} onClick={() => {}} data-testid="m">
        x
      </Clickable>,
    );
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current).toBe(screen.getByTestId('m'));
  });

  it('ref funciona com as={FakeCard} (forwardRef externo)', () => {
    const ref = createRef<HTMLElement>();
    render(
      <Clickable ref={ref} as={FakeCard} onClick={() => {}} data-testid="c">
        x
      </Clickable>,
    );
    expect(ref.current).toBe(screen.getByTestId('c'));
  });

  it('useRef em componente pai que passa ref para Clickable', () => {
    function Wrapper() {
      const ref = useRef<HTMLElement>(null);
      return (
        <Clickable ref={ref} onClick={() => ref.current?.setAttribute('data-clicked', 'yes')}>
          x
        </Clickable>
      );
    }
    render(<Wrapper />);
    const el = screen.getByRole('button');
    fireEvent.click(el);
    expect(el).toHaveAttribute('data-clicked', 'yes');
  });
});

describe('Clickable — focus ring', () => {
  it('showFocusRing=true (default) aplica classes de focus ring', () => {
    render(<Clickable onClick={() => {}}>x</Clickable>);
    expect(screen.getByRole('button').className).toMatch(/focus-visible:ring-2/);
  });

  it('showFocusRing=false não aplica classe de focus ring', () => {
    render(
      <Clickable onClick={() => {}} showFocusRing={false}>
        x
      </Clickable>,
    );
    expect(screen.getByRole('button').className).not.toMatch(/focus-visible:ring-2/);
  });

  it('disabled + showFocusRing=true → mantém opacity e cursor-not-allowed', () => {
    render(
      <Clickable onClick={() => {}} disabled>
        x
      </Clickable>,
    );
    const el = screen.getByRole('button');
    expect(el.className).toMatch(/opacity-60/);
    expect(el.className).toMatch(/cursor-not-allowed/);
  });
});

describe('Clickable — children complexos', () => {
  it('aceita React node complexo como children', () => {
    render(
      <Clickable onClick={() => {}}>
        <div>
          <span>Aninhado</span>
          <strong>bold</strong>
        </div>
      </Clickable>,
    );
    expect(screen.getByText('Aninhado')).toBeInTheDocument();
    expect(screen.getByText('bold')).toBeInTheDocument();
  });

  it('funciona com children null/false (curto-circuito)', () => {
    render(
      <Clickable onClick={() => {}}>
        {false}
        {null}
        <span>ok</span>
      </Clickable>,
    );
    expect(screen.getByText('ok')).toBeInTheDocument();
  });
});

describe('Clickable — onKeyDown composition', () => {
  it('onKeyDown externo é chamado para teclas quaisquer (não apenas Enter/Space)', () => {
    const externalHandler = vi.fn();
    render(
      <Clickable onClick={() => {}} onKeyDown={externalHandler}>
        x
      </Clickable>,
    );
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Tab' });
    expect(externalHandler).toHaveBeenCalledTimes(1);
  });

  it('onKeyDown externo NÃO substitui o handler interno — Enter dispara ambos', () => {
    const onClick = vi.fn();
    const externalHandler = vi.fn();
    render(
      <Clickable onClick={onClick} onKeyDown={externalHandler}>
        x
      </Clickable>,
    );
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(externalHandler).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('onKeyDown externo NÃO substitui o handler interno — Space dispara ambos', () => {
    const onClick = vi.fn();
    const externalHandler = vi.fn();
    render(
      <Clickable onClick={onClick} onKeyDown={externalHandler}>
        x
      </Clickable>,
    );
    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
    expect(externalHandler).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('onKeyDown externo não é chamado quando disabled=true', () => {
    const externalHandler = vi.fn();
    render(
      <Clickable onClick={() => {}} onKeyDown={externalHandler} disabled>
        x
      </Clickable>,
    );
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
    expect(externalHandler).not.toHaveBeenCalled();
  });

  it('strictTarget=true impede o onClick interno para eventos do filho', () => {
    const onClick = vi.fn();
    const externalHandler = vi.fn();
    render(
      <Clickable onClick={onClick} onKeyDown={externalHandler} strictTarget>
        <button type="button" data-testid="inner">
          filho
        </button>
      </Clickable>,
    );
    fireEvent.keyDown(screen.getByTestId('inner'), { key: 'Enter' });
    // strictTarget checks currentTarget, but onKeyDown fires before the strictTarget guard
    // for onClick — externalHandler runs for all target matches at the element level
    expect(onClick).not.toHaveBeenCalled();
    expect(externalHandler).toHaveBeenCalledTimes(1);
  });
});

describe('Clickable — event control', () => {
  it('handler pode chamar stopPropagation para bloquear bubbling', () => {
    const outer = vi.fn();
    const inner = vi.fn((e: React.KeyboardEvent | React.MouseEvent) => {
      e.stopPropagation();
    });
    render(
      <div onClick={outer}>
        <Clickable onClick={inner} data-testid="inner-click">
          x
        </Clickable>
      </div>,
    );
    fireEvent.click(screen.getByTestId('inner-click'));
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });

  it('sem stopPropagation, evento borbulha ao pai', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <div onClick={outer}>
        <Clickable onClick={inner} data-testid="inner-click2">
          x
        </Clickable>
      </div>,
    );
    fireEvent.click(screen.getByTestId('inner-click2'));
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it('múltiplos cliques disparam múltiplas vezes', () => {
    const onClick = vi.fn();
    render(<Clickable onClick={onClick}>x</Clickable>);
    const el = screen.getByRole('button');
    fireEvent.click(el);
    fireEvent.click(el);
    fireEvent.click(el);
    expect(onClick).toHaveBeenCalledTimes(3);
  });
});
