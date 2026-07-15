/**
 * Clickable — wrapper acessível para `<div>` clicáveis.
 *
 * SSOT do padrão a11y (WCAG 2.1.1 Keyboard): sempre que um elemento não-nativo
 * (div, span, motion.div) precisa reagir a clique, use este helper em vez de
 * duplicar `role`/`tabIndex`/`onKeyDown` inline.
 *
 * Exemplos:
 *   <Clickable onClick={onNavigate}>...</Clickable>
 *   <Clickable as={motion.div} onClick={...} isPressed={selected}>...</Clickable>
 *   <Clickable role="link" onClick={goTo}>...</Clickable>
 *
 * @see docs/architecture/A11Y_CLICKABLE.md
 */
import { forwardRef, type ElementType, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ClickableProps {
  /** Handler disparado por mouse OU teclado (Enter/Space). */
  onClick: (event: MouseEvent | KeyboardEvent) => void;
  children: ReactNode;
  /** Elemento renderizado (default: `div`). Aceita `motion.div`, `span`, etc. */
  as?: ElementType;
  className?: string;
  /** Bloqueia click + keyboard + aplica cursor-not-allowed. */
  disabled?: boolean;
  /** Se true, keyboard só dispara quando o foco está no próprio elemento (não em filho clicável interno). */
  strictTarget?: boolean;
  /** WAI-ARIA role. Default `button`. Use `link`, `menuitem`, `tab`, etc. quando semanticamente correto. */
  role?: string;
  /** Reflete estado toggle (aria-pressed). */
  isPressed?: boolean;
  /** Reflete seleção em lista (aria-selected). */
  isSelected?: boolean;
  /** Reflete expansão (aria-expanded). */
  isExpanded?: boolean;
  /** aria-label acessível quando o texto visível não descreve a ação. */
  'aria-label'?: string;
  /** Referência para grupo/label. */
  'aria-labelledby'?: string;
  /** Descrição adicional. */
  'aria-describedby'?: string;
  /** tabIndex customizado (default 0; use -1 para focus programático). */
  tabIndex?: number;
  /** ID DOM. */
  id?: string;
  /** data-testid para E2E. */
  'data-testid'?: string;
  /** Ativa foco visível padrão (default true). Passe false quando já houver ring custom no className. */
  showFocusRing?: boolean;
  /** Estilo inline (evitar; preferir className). */
  style?: React.CSSProperties;
}

/**
 * Wrapper acessível. Ordem de precedência:
 * 1. `disabled` — bloqueia tudo.
 * 2. `strictTarget` — só dispara keyboard quando `e.target === e.currentTarget`.
 * 3. Enter e Space (com preventDefault para não rolar página).
 */
export const Clickable = forwardRef<HTMLElement, ClickableProps>(function Clickable(
  {
    onClick,
    children,
    as,
    className,
    disabled = false,
    strictTarget = false,
    role = 'button',
    isPressed,
    isSelected,
    isExpanded,
    tabIndex,
    id,
    showFocusRing = true,
    style,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    'data-testid': dataTestId,
  },
  ref,
) {
  const Component = (as ?? 'div') as ElementType;

  const handleClick = (e: MouseEvent) => {
    if (disabled) return;
    onClick(e);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (strictTarget && e.target !== e.currentTarget) return;
    e.preventDefault();
    onClick(e);
  };

  return (
    <Component
      ref={ref}
      id={id}
      role={role}
      tabIndex={disabled ? -1 : (tabIndex ?? 0)}
      aria-disabled={disabled || undefined}
      aria-pressed={isPressed}
      aria-selected={isSelected}
      aria-expanded={isExpanded}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      data-testid={dataTestId}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={style}
      className={cn(
        'cursor-pointer',
        disabled && 'cursor-not-allowed opacity-60 pointer-events-none',
        showFocusRing &&
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
    >
      {children}
    </Component>
  );
});
