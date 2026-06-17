/**
 * QA visual do sidebar — dev-only.
 *
 * Renderiza réplicas estáticas dos estilos do sidebar (mesmas classes
 * Tailwind usadas em `SidebarNavGroup.tsx`) em todos os estados visuais
 * relevantes (default, hover, active, focus-visible, collapsed) e em
 * múltiplas larguras representativas (320 / 768 / 1024 / 1502 px), em
 * light e dark mode lado a lado.
 *
 * Use para validar contraste e ausência de sombras/brilho rapidamente
 * sem precisar abrir o app real.
 */
import { useState } from 'react';
import { Package, ShoppingCart, ChevronDown, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageSEO } from '@/components/seo/PageSEO';

const VIEWPORT_WIDTHS = [
  { label: 'Mobile 320', value: 320 },
  { label: 'Tablet 768', value: 768 },
  { label: 'Desktop 1024', value: 1024 },
  { label: 'Wide 1502', value: 1502 },
] as const;

const STATES = ['default', 'hover', 'active', 'focus', 'collapsed'] as const;
type State = (typeof STATES)[number];

/** Réplica do NavLink ativo/inativo do SidebarNavGroup (mesmas classes). */
function NavItemSample({ state, collapsed }: { state: State; collapsed: boolean }) {
  const isActive = state === 'active';
  const forceHover = state === 'hover';
  const forceFocus = state === 'focus';

  return (
    <div
      className={cn(
        'group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200',
        // hover simulado via classes não-prefixadas
        forceHover && !isActive && 'bg-sidebar-accent/70 text-sidebar-foreground',
        // focus-visible simulado via ring estático
        forceFocus && 'ring-2 ring-primary ring-offset-2',
        isActive
          ? 'bg-brand-primary/15 font-bold text-brand-primary before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-brand-primary'
          : 'text-sidebar-foreground/75 before:absolute before:left-0 before:top-1/2 before:h-0 before:w-[2px] before:-translate-y-1/2 before:rounded-r-full before:bg-brand-primary/50',
      )}
    >
      <Package
        className={cn(
          'h-4 w-4 shrink-0 transition-colors',
          isActive ? 'text-brand-primary' : 'text-sidebar-foreground/60',
        )}
      />
      {!collapsed && <span className="flex-1 truncate text-sm">Produtos</span>}
    </div>
  );
}

/** Réplica do botão de grupo (Collapsible). */
function GroupHeaderSample({ active }: { active: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200',
        'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
        active && 'bg-brand-primary/15 text-brand-primary',
      )}
    >
      <ShoppingCart
        className={cn(
          'h-4 w-4 shrink-0',
          active ? 'text-brand-primary' : 'text-sidebar-foreground/40',
        )}
      />
      <span className="flex-1 text-left text-xs font-semibold uppercase tracking-wider">
        Vendas
      </span>
      <ChevronDown className="h-3 w-3 text-sidebar-foreground/30" />
    </button>
  );
}

/** Sidebar inteiro replicado em uma largura X, com estados forçados. */
function SidebarPreview({ width, dark }: { width: number; dark: boolean }) {
  const collapsed = width < 768;
  return (
    <div
      className={cn('overflow-hidden rounded-xl border border-border', dark && 'dark')}
      style={{ width: collapsed ? 72 : Math.min(width, 280) }}
    >
      <div className="space-y-3 bg-sidebar p-3 text-sidebar-foreground">
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-primary">
            {collapsed ? (
              <span className="text-[10px] font-bold text-primary-foreground">PG</span>
            ) : (
              <Gift className="h-4 w-4 text-primary-foreground" />
            )}
          </div>
          {!collapsed && (
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-bold text-sidebar-foreground">Promo Gifts</span>
              <span className="text-[10px] uppercase tracking-widest text-sidebar-foreground/40">
                Plataforma
              </span>
            </div>
          )}
        </div>

        {!collapsed && <GroupHeaderSample active />}

        <div className="space-y-1">
          {STATES.map((s) => (
            <div key={s}>
              <div
                className={cn(
                  'mb-1 px-2 text-[9px] font-semibold uppercase tracking-wider',
                  dark ? 'text-white/40' : 'text-black/40',
                )}
              >
                {s}
              </div>
              <NavItemSample state={s} collapsed={collapsed} />
            </div>
          ))}
        </div>
      </div>
      <div
        className={cn(
          'px-3 py-1.5 font-mono text-[10px]',
          dark ? 'bg-black/40 text-white/60' : 'bg-black/5 text-black/50',
        )}
      >
        {width}px {dark ? '· dark' : '· light'}
      </div>
    </div>
  );
}

export default function SidebarQAPage() {
  const [showSideBySide, setShowSideBySide] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <PageSEO
        title="QA — Sidebar | Promo Gifts"
        description="Validação visual do sidebar"
        noIndex
      />
      <div className="mx-auto max-w-[1920px] space-y-6 p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="page-title-sidebar-qa">
              QA Visual — Sidebar
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Estados (default · hover · active · focus · collapsed) × breakpoints (
              {VIEWPORT_WIDTHS.map((v) => v.value).join(' · ')} px) × light/dark.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              ✓ Sem efeitos de brilho ou sombras neon. Foco usa{' '}
              <code>ring-2 ring-primary ring-offset-2</code>.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showSideBySide}
              onChange={(e) => setShowSideBySide(e.target.checked)}
            />
            Light + Dark lado a lado
          </label>
        </header>

        <section className="space-y-8">
          {VIEWPORT_WIDTHS.map((vp) => (
            <div key={vp.value} className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {vp.label}
              </h2>
              <div className="flex flex-wrap items-start gap-6">
                <SidebarPreview width={vp.value} dark={false} />
                {showSideBySide && <SidebarPreview width={vp.value} dark={true} />}
              </div>
            </div>
          ))}
        </section>

        <section className="space-y-2 rounded-xl border border-border p-4 text-sm text-muted-foreground">
          <h3 className="font-semibold text-foreground">Checklist de validação</h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Item <strong>active</strong>: fundo laranja sólido translúcido + indicador lateral 3px
              (totalmente plano, sem brilho).
            </li>
            <li>
              Item <strong>hover</strong>: fundo accent ~70% + texto mais forte (sem brilho).
            </li>
            <li>
              Item <strong>focus</strong>: ring sólido primário 2px com offset (visível em qualquer
              fundo).
            </li>
            <li>
              Item <strong>collapsed</strong> (320px): apenas ícone + indicadores; sem texto.
            </li>
            <li>Texto inativo legível em light e dark (foreground/75 ≥ WCAG AA).</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
