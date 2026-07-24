/**
 * Empty state for MockupGenerator when no product is selected
 * Now updated to be more dynamic (Progressive Preview)
 */
import { Card, CardContent } from '@/components/ui/card';
import {
  Image as ImageIcon,
  CheckCircle2,
  Building2,
  Package,
  Paintbrush,
  Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MockupEmptyStateProps {
  currentStep?: number;
  hasClient?: boolean;
  hasProduct?: boolean;
  hasTechnique?: boolean;
  hasLogo?: boolean;
}

export function MockupEmptyState({
  currentStep = 1,
  hasClient = false,
  hasProduct = false,
  hasTechnique = false,
  hasLogo = false,
}: MockupEmptyStateProps) {
  const steps = [
    {
      label: 'Selecione a empresa',
      isCompleted: hasClient,
      icon: <Building2 className="h-4 w-4" />,
    },
    { label: 'Escolha o produto', isCompleted: hasProduct, icon: <Package className="h-4 w-4" /> },
    {
      label: 'Defina a técnica',
      isCompleted: hasTechnique,
      icon: <Paintbrush className="h-4 w-4" />,
    },
    { label: 'Faça upload do logo', isCompleted: hasLogo, icon: <Upload className="h-4 w-4" /> },
  ];

  return (
    <Card className="group relative overflow-hidden border-border/50 bg-card/30 backdrop-blur-sm">
      {/* Decorative background element */}
      <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/5 blur-3xl transition-colors duration-700 group-hover:bg-primary/10" />

      <CardContent className="relative z-10 flex flex-col items-center justify-center py-20">
        <div className="max-w-sm space-y-6 text-center text-muted-foreground">
          <div className="relative">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/20 to-primary/5 shadow-inner">
              <ImageIcon className="h-10 w-10 text-primary/60" />
            </div>
            {hasProduct && (
              <div className="animate-bounce-subtle absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-success text-success-foreground shadow-lg">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="font-display text-xl font-bold text-foreground">
              {!hasProduct ? 'Selecione um produto' : 'Quase pronto!'}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {!hasProduct
                ? 'Escolha uma empresa e um produto no painel de configuração para começar a criar seu mockup.'
                : 'Agora defina a técnica e envie o logo para visualizar o resultado aqui.'}
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-2.5 pt-4 text-sm">
            {steps.map((step, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-3 rounded-xl border p-2.5 transition-all duration-300',
                  step.isCompleted
                    ? 'border-success/30 bg-success/10 text-success'
                    : i + 1 === currentStep
                      ? 'border-primary/20 bg-primary/5 text-primary ring-1 ring-primary/10'
                      : 'border-transparent bg-muted/30 text-muted-foreground opacity-60',
                )}
              >
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                    step.isCompleted
                      ? 'bg-success text-success-foreground'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {step.isCompleted ? <CheckCircle2 className="h-4 w-4" /> : step.icon}
                </div>
                <span className="font-medium">{step.label}</span>
                {step.isCompleted && (
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider">OK</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
