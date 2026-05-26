/**
 * Kit Templates
 * Quick-start templates for common kit types
 */

import { type Gift, Star, Heart, Briefcase, PartyPopper, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface KitTemplate {
  id: string;
  name: string;
  description: string;
  icon: typeof Gift;
  suggestedItems: string[];
  kitType: 'montado' | 'original' | 'simples';
  color: string;
}

const TEMPLATES: KitTemplate[] = [
  {
    id: 'welcome',
    name: 'Kit Boas-Vindas',
    description: 'Ideal para onboarding de novos colaboradores',
    icon: Star,
    suggestedItems: ['Caderno', 'Caneta', 'Garrafa', 'Necessaire'],
    kitType: 'montado',
    color: 'text-primary',
  },
  {
    id: 'end-year',
    name: 'Kit Fim de Ano',
    description: 'Presentes corporativos para final de ano',
    icon: PartyPopper,
    suggestedItems: ['Caixa Premium', 'Vinho', 'Taça', 'Chocolates'],
    kitType: 'montado',
    color: 'text-warning',
  },
  {
    id: 'executive',
    name: 'Kit Executivo',
    description: 'Para clientes VIP e parceiros estratégicos',
    icon: Briefcase,
    suggestedItems: ['Caneta Metal', 'Caderno Couro', 'Porta-cartão'],
    kitType: 'montado',
    color: 'text-primary',
  },
  {
    id: 'wellness',
    name: 'Kit Bem-Estar',
    description: 'Saúde e qualidade de vida no trabalho',
    icon: Heart,
    suggestedItems: ['Garrafa Térmica', 'Toalha', 'Necessaire', 'Balm'],
    kitType: 'montado',
    color: 'text-destructive',
  },
];

interface KitTemplatesProps {
  onSelectTemplate: (template: KitTemplate) => void;
  visible: boolean;
}

export function KitTemplates({ onSelectTemplate, visible }: KitTemplatesProps) {
  if (!visible) return null;

  return (
    <Card className="border-dashed border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          Comece com um Template
          <Badge variant="secondary" className="text-[10px]">
            Atalho
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {TEMPLATES.map((template) => {
            const Icon = template.icon;
            return (
              <button
                key={template.id}
                onClick={() => onSelectTemplate(template)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-lg border border-border/50 p-3',
                  'bg-card transition-all hover:border-primary/30 hover:bg-accent',
                  'group cursor-pointer text-center',
                )}
              >
                <Icon
                  className={cn(
                    'h-5 w-5 transition-transform group-hover:scale-110',
                    template.color,
                  )}
                />
                <span className="text-xs font-medium">{template.name}</span>
                <span className="text-[10px] leading-tight text-muted-foreground">
                  {template.description}
                </span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export type { KitTemplate };
