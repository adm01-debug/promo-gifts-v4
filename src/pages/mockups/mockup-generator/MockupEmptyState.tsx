/**
 * Empty state for MockupGenerator when no product is selected
 * Now updated to be more dynamic (Progressive Preview)
 */
import { Card, CardContent } from "@/components/ui/card";
import { Image as ImageIcon, CheckCircle2, Building2, Package, Paintbrush, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

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
  hasLogo = false 
}: MockupEmptyStateProps) {
  const steps = [
    { label: "Selecione a empresa", isCompleted: hasClient, icon: <Building2 className="h-4 w-4" /> },
    { label: "Escolha o produto", isCompleted: hasProduct, icon: <Package className="h-4 w-4" /> },
    { label: "Defina a técnica", isCompleted: hasTechnique, icon: <Paintbrush className="h-4 w-4" /> },
    { label: "Faça upload do logo", isCompleted: hasLogo, icon: <Upload className="h-4 w-4" /> },
  ];

  return (
    <Card className="border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden relative group">
      {/* Decorative background element */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-700" />
      
      <CardContent className="flex flex-col items-center justify-center py-20 relative z-10">
        <div className="text-center text-muted-foreground max-w-sm space-y-6">
          <div className="relative">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-inner border border-primary/10">
              <ImageIcon className="h-10 w-10 text-primary/60" />
            </div>
            {hasProduct && (
              <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-success text-success-foreground flex items-center justify-center shadow-lg border-2 border-background animate-bounce-subtle">
                <CheckCircle2 className="h-5 w-5" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="font-display text-xl font-bold text-foreground">
              {!hasProduct ? "Selecione um produto" : "Quase pronto!"}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {!hasProduct 
                ? "Escolha uma empresa e um produto no painel de configuração para começar a criar seu mockup."
                : "Agora defina a técnica e envie o logo para visualizar o resultado aqui."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2.5 text-sm w-full pt-4">
            {steps.map((step, i) => (
              <div 
                key={i} 
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-300",
                  step.isCompleted 
                    ? "bg-success/10 border-success/30 text-success" 
                    : i + 1 === currentStep
                      ? "bg-primary/5 border-primary/20 text-primary ring-1 ring-primary/10"
                      : "bg-muted/30 border-transparent text-muted-foreground opacity-60"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-lg shrink-0",
                  step.isCompleted ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {step.isCompleted ? <CheckCircle2 className="h-4 w-4" /> : step.icon}
                </div>
                <span className="font-medium">{step.label}</span>
                {step.isCompleted && <span className="ml-auto text-[10px] font-bold uppercase tracking-wider">OK</span>}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}