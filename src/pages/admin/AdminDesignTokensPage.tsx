import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSEO } from '@/components/seo/PageSEO';
import { cn } from '@/lib/utils';

/**
 * /admin/design-tokens — Paleta visual viva dos tokens do sistema.
 * SSOT documental: docs/DESIGN_TOKENS.md
 * Esta página reflete em tempo real os valores de src/index.css.
 */

interface TokenSwatchProps {
  name: string;
  cssVar: string;
  twClass: string;
  description?: string;
  textOn?: string;
}

const TokenSwatch = ({ name, cssVar, twClass, description, textOn }: TokenSwatchProps) => (
  <div className="flex items-stretch gap-3 rounded-lg border bg-card p-3">
    <div
      className={`h-16 w-16 shrink-0 rounded-md border ${twClass} flex items-center justify-center`}
    >
      {textOn && <span className={cn('text-xs font-bold', textOn)}>Aa</span>}
    </div>
    <div className="flex min-w-0 flex-col justify-center">
      <div className="truncate font-display text-sm font-bold text-foreground">{name}</div>
      <code className="truncate text-[11px] text-muted-foreground">{cssVar}</code>
      <code className="truncate text-[11px] text-primary">{twClass}</code>
      {description && <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>}
    </div>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h2 className="border-b border-border pb-2 font-display text-xl font-bold text-foreground">
      {title}
    </h2>
    {children}
  </section>
);

const BRAND_TOKENS: TokenSwatchProps[] = [
  {
    name: 'Primary',
    cssVar: '--primary',
    twClass: 'bg-primary',
    textOn: 'text-primary-foreground',
    description: 'Cor de marca, CTAs',
  },
  {
    name: 'Primary Hover',
    cssVar: '--primary-hover',
    twClass: 'bg-primary-hover',
    textOn: 'text-primary-foreground',
  },
  {
    name: 'Primary Active',
    cssVar: '--primary-active',
    twClass: 'bg-primary-active',
    textOn: 'text-primary-foreground',
  },
  {
    name: 'Primary Glow',
    cssVar: '--primary-glow',
    twClass: 'bg-primary-glow',
    textOn: 'text-primary-foreground',
  },
];

const SURFACE_TOKENS: TokenSwatchProps[] = [
  {
    name: 'Background',
    cssVar: '--background',
    twClass: 'bg-background border-border',
    textOn: 'text-foreground',
  },
  {
    name: 'Foreground',
    cssVar: '--foreground',
    twClass: 'bg-foreground',
    textOn: 'text-background',
  },
  { name: 'Card', cssVar: '--card', twClass: 'bg-card', textOn: 'text-card-foreground' },
  {
    name: 'Card Elevated',
    cssVar: '--card-elevated',
    twClass: 'bg-card-elevated',
    textOn: 'text-foreground',
  },
  { name: 'Surface', cssVar: '--surface', twClass: 'bg-surface', textOn: 'text-foreground' },
  {
    name: 'Popover',
    cssVar: '--popover',
    twClass: 'bg-popover',
    textOn: 'text-popover-foreground',
  },
  { name: 'Muted', cssVar: '--muted', twClass: 'bg-muted', textOn: 'text-muted-foreground' },
];

const FUNCTIONAL_TOKENS: TokenSwatchProps[] = [
  {
    name: 'Success',
    cssVar: '--success',
    twClass: 'bg-success',
    textOn: 'text-success-foreground',
  },
  {
    name: 'Warning',
    cssVar: '--warning',
    twClass: 'bg-warning',
    textOn: 'text-warning-foreground',
  },
  {
    name: 'Destructive',
    cssVar: '--destructive',
    twClass: 'bg-destructive',
    textOn: 'text-destructive-foreground',
  },
  { name: 'Info', cssVar: '--info', twClass: 'bg-info', textOn: 'text-info-foreground' },
];

const SHADOW_TOKENS = [
  { name: 'shadow-sm (soft)', twClass: 'shadow-sm', description: 'Repouso default' },
  { name: 'shadow-md (medium)', twClass: 'shadow-md', description: 'Hover / agrupamentos' },
  { name: 'shadow-xl (premium)', twClass: 'shadow-xl', description: 'Modais, hero' },
  { name: 'shadow-none', twClass: 'shadow-none', description: 'Sem sombra' },
];

const RADIUS_TOKENS = [
  { name: 'xs (4px)', twClass: 'rounded-xs' },
  { name: 'sm (8px)', twClass: 'rounded-sm' },
  { name: 'md (12px)', twClass: 'rounded-md' },
  { name: 'lg (16px)', twClass: 'rounded-lg', hint: 'Padrão de inputs/buttons' },
  { name: 'xl (20px)', twClass: 'rounded-xl' },
  { name: '2xl (24px)', twClass: 'rounded-2xl', hint: 'Padrão de cards/dialogs' },
  { name: 'full', twClass: 'rounded-full' },
];

const GRADIENT_TOKENS = [
  { name: 'Primary', twClass: 'bg-gradient-primary' },
  { name: 'CTA (Success)', twClass: 'bg-gradient-cta' },
  { name: 'Hero', twClass: 'bg-gradient-hero' },
  { name: 'Glow', twClass: 'bg-gradient-glow' },
  { name: 'Subtle', twClass: 'bg-gradient-subtle' },
  { name: 'Card', twClass: 'bg-gradient-card' },
  { name: 'Highlight', twClass: 'bg-gradient-highlight' },
];

const BORDER_WIDTHS = [
  { name: 'hairline (1px)', twClass: 'border-hairline' },
  { name: 'border (1.5px) — DEFAULT', twClass: 'border' },
  { name: 'border-2 (2px) — strong', twClass: 'border-2' },
];

export default function AdminDesignTokensPage() {
  return (
    <>
      <PageSEO
        title="Design Tokens"
        description="Paleta visual viva dos tokens do sistema."
        path="/admin/design-tokens"
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <header className="space-y-2">
          <h1
            data-testid="page-title-design-tokens"
            className="font-display text-4xl font-bold text-foreground"
          >
            Design Tokens — Orange Premium
          </h1>
          <p className="max-w-3xl text-muted-foreground">
            Paleta visual viva do sistema. Reflete em tempo real os valores de{' '}
            <code className="text-primary">src/index.css</code>. Documentação completa em{' '}
            <code className="text-primary">docs/DESIGN_TOKENS.md</code>.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="outline">Light + Dark</Badge>
            <Badge variant="outline">SSOT em index.css</Badge>
            <Badge className="bg-primary text-primary-foreground">WCAG AA validado</Badge>
          </div>
        </header>

        <Section title="1. Brand — Orange Premium">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {BRAND_TOKENS.map((t) => (
              <TokenSwatch key={t.cssVar} {...t} />
            ))}
          </div>
        </Section>

        <Section title="2. Surfaces & Foreground">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {SURFACE_TOKENS.map((t) => (
              <TokenSwatch key={t.cssVar} {...t} />
            ))}
          </div>
        </Section>

        <Section title="3. Funcionais">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {FUNCTIONAL_TOKENS.map((t) => (
              <TokenSwatch key={t.cssVar} {...t} />
            ))}
          </div>
        </Section>

        <Section title="4. Contraste — Pares validados">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Card className="bg-primary p-4 text-primary-foreground">
              <div className="font-display font-bold">Primary</div>
              <div className="text-sm opacity-90">on primary-foreground</div>
            </Card>
            <Card className="bg-card p-4 text-card-foreground">
              <div className="font-display font-bold">Card</div>
              <div className="text-sm text-muted-foreground">on muted-foreground</div>
            </Card>
            <Card className="bg-success p-4 text-success-foreground">
              <div className="font-display font-bold">Success</div>
              <div className="text-sm opacity-90">on success-foreground</div>
            </Card>
            <Card className="bg-destructive p-4 text-destructive-foreground">
              <div className="font-display font-bold">Destructive</div>
              <div className="text-sm opacity-90">on destructive-foreground</div>
            </Card>
          </div>
        </Section>

        <Section title="5. Sombras">
          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <TokenSwatch
              name="Shadow Soft"
              cssVar="--shadow-soft"
              twClass="shadow-soft"
              description="Padrão discreto"
            />
            <TokenSwatch
              name="Shadow Medium"
              cssVar="--shadow-medium"
              twClass="shadow-medium"
              description="Hover"
            />
            <TokenSwatch
              name="Shadow XL"
              cssVar="--shadow-xl"
              twClass="shadow-xl"
              description="Modais"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 rounded-lg bg-surface p-6 md:grid-cols-2 lg:grid-cols-5">
            {SHADOW_TOKENS.map((s) => (
              <div key={s.twClass} className="space-y-2">
                <div
                  className={`h-20 rounded-lg border bg-card ${s.twClass} transition-all duration-300`}
                />
                <div className="text-xs">
                  <div className="font-bold text-foreground">{s.name}</div>
                  <div className="text-muted-foreground">{s.description}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="6. Radius">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
            {RADIUS_TOKENS.map((r) => (
              <div key={r.twClass} className="space-y-2 text-center">
                <div
                  className={cn('h-20 w-full border-2 border-primary bg-primary/20', r.twClass)}
                />
                <div className="text-xs">
                  <div className="font-bold text-foreground">{r.name}</div>
                  <code className="text-[10px] text-primary">{r.twClass}</code>
                  {r.hint && <div className="text-[10px] text-muted-foreground">{r.hint}</div>}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="7. Border Width">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {BORDER_WIDTHS.map((b) => (
              <div
                key={b.twClass}
                className={`h-20 rounded-lg border-primary bg-card ${b.twClass} flex items-center justify-center`}
              >
                <span className="text-sm font-bold text-foreground">{b.name}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="8. Gradientes (Hero & CTA)">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {GRADIENT_TOKENS.map((g) => (
              <div
                key={g.twClass}
                className={`h-24 rounded-lg ${g.twClass} flex items-end border p-3`}
              >
                <div className="text-xs">
                  <div className="rounded bg-background/80 px-2 py-0.5 font-bold text-foreground backdrop-blur">
                    {g.name}
                  </div>
                  <code className="mt-1 inline-block rounded bg-background/80 px-2 text-[10px] text-foreground backdrop-blur">
                    {g.twClass}
                  </code>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="9. Tipografia">
          <Card className="space-y-3 p-6">
            <div className="font-display text-5xl font-bold text-foreground">Outfit Display</div>
            <div className="text-sm text-muted-foreground">
              Headlines, números grandes, CTAs — <code>font-display</code>
            </div>
            <hr className="border-border" />
            <div className="font-sans text-base text-foreground">
              Plus Jakarta Sans — corpo de texto padrão. The quick orange fox jumps over the lazy
              dog. <span className="font-medium">medium</span>{' '}
              <span className="font-semibold">semibold</span>{' '}
              <span className="font-bold">bold</span>.
            </div>
            <div className="text-sm text-muted-foreground">
              Default — <code>font-sans</code>
            </div>
          </Card>
        </Section>

        <Section title="10. Componentes em ação">
          <Card className="space-y-4 p-6">
            <div className="flex flex-wrap gap-2">
              <Button variant="default">Default</Button>
              <Button variant="premium">Premium (CTA gradient)</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>
          </Card>
        </Section>

        <footer className="border-t border-border pt-6 text-center text-sm text-muted-foreground">
          Para alterar tokens edite <code className="text-primary">src/index.css</code> (raiz
          `:root` + `.dark`). Esta página reflete automaticamente.
        </footer>
      </div>
    </>
  );
}
