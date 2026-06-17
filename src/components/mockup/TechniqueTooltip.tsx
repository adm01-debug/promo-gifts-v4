import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import { Info, Palette, Clock, Layers, Ruler, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Technique {
  id: string;
  name: string;
  code: string | null;
  // Novos campos opcionais (vindos do RPC fn_get_product_customization_options)
  maxColors?: number | null;
  chargesPerColor?: boolean;
  usesDimension?: boolean;
  isCurved?: boolean;
  setupCost?: number | null;
  variationLabel?: string | null;
  groupCode?: string | null;
  maxWidth?: number | null;
  maxHeight?: number | null;
  locationName?: string | null;
}

interface TechniqueTooltipProps {
  technique: Technique;
  children: React.ReactNode;
  className?: string;
}

// Visual examples and descriptions for each technique
const TECHNIQUE_INFO: Record<
  string,
  {
    description: string;
    durability: string;
    colors: string;
    bestFor: string;
    visualStyle: string;
    gradient: string;
  }
> = {
  bordado: {
    description: 'Técnica premium com fios de alta qualidade',
    durability: 'Altíssima - 500+ lavagens',
    colors: 'Até 15 cores',
    bestFor: 'Camisas, bonés, jaquetas',
    visualStyle: 'Textura 3D com linhas visíveis',
    gradient: 'from-warning to-brand-primary',
  },
  silk: {
    description: 'Serigrafia tradicional para grandes quantidades',
    durability: 'Alta - 200+ lavagens',
    colors: 'Até 6 cores (por tela)',
    bestFor: 'Camisetas, sacolas, uniformes',
    visualStyle: 'Cores sólidas e vibrantes',
    gradient: 'from-blue-500 to-cyan-600',
  },
  dtf: {
    description: 'Transfer digital com detalhes fotográficos',
    durability: 'Alta - 100+ lavagens',
    colors: 'Ilimitadas (CMYK)',
    bestFor: 'Fotos, gradientes, designs complexos',
    visualStyle: 'Acabamento brilhante',
    gradient: 'from-primary to-primary',
  },
  laser: {
    description: 'Gravação permanente por remoção de material',
    durability: 'Permanente',
    colors: 'Monocromático',
    bestFor: 'Metal, acrílico, madeira',
    visualStyle: 'Elegante e discreto',
    gradient: 'from-gray-500 to-slate-700',
  },
  sublimacao: {
    description: 'A tinta penetra no material poliéster',
    durability: 'Permanente - não descasca',
    colors: 'Ilimitadas (CMYK)',
    bestFor: 'Poliéster branco, canecas, mousepads',
    visualStyle: 'Integrado ao tecido',
    gradient: 'from-success to-teal-600',
  },
  hot_stamping: {
    description: 'Aplicação de foil metálico com calor',
    durability: 'Alta - efeito luxuoso',
    colors: 'Metálicos (ouro, prata)',
    bestFor: 'Embalagens, agendas, couro',
    visualStyle: 'Brilho metálico premium',
    gradient: 'from-warning/80 to-warning',
  },
  tampografia: {
    description: 'Impressão em superfícies irregulares',
    durability: 'Alta',
    colors: 'Até 4 cores',
    bestFor: 'Canetas, brindes pequenos',
    visualStyle: 'Preciso em curvas',
    gradient: 'from-indigo-500 to-violet-600',
  },
  uv: {
    description: 'Impressão UV com secagem instantânea',
    durability: 'Alta - resistente a UV',
    colors: 'Ilimitadas + branco',
    bestFor: 'Acrílico, vidro, metal',
    visualStyle: 'Textura levemente relevo',
    gradient: 'from-destructive to-destructive',
  },
  default: {
    description: 'Técnica de personalização profissional',
    durability: 'Variável',
    colors: 'Consulte',
    bestFor: 'Diversos produtos',
    visualStyle: 'Acabamento profissional',
    gradient: 'from-primary to-primary/80',
  },
};

function getTechniqueInfo(technique: Technique) {
  const code = (technique.code || (technique.name ?? '')).toLowerCase();

  for (const [key, value] of Object.entries(TECHNIQUE_INFO)) {
    if (code.includes(key)) {
      return value;
    }
  }

  return TECHNIQUE_INFO.default;
}

export function TechniqueTooltip({ technique, children, className }: TechniqueTooltipProps) {
  const info = getTechniqueInfo(technique);

  return (
    <HoverCard openDelay={700} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className={cn('cursor-help', className)}>{children}</div>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="overflow-hidden p-0">
        {/* Visual Header */}
        <div className={cn('bg-gradient-to-r p-3 text-primary-foreground', info.gradient)}>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold leading-tight">{technique.name}</h4>
            <Badge
              variant="secondary"
              className="text-tooltip border-0 bg-white/20 px-1 py-0 font-bold text-primary-foreground"
            >
              {technique.code || 'PRO'}
            </Badge>
          </div>
          <p className="text-tooltip mt-1 opacity-90">{info.description}</p>
        </div>

        {/* Details */}
        <div className="space-y-2 p-3">
          <div className="text-tooltip flex items-start gap-1.5">
            <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <span className="text-muted-foreground">Durabilidade:</span>
              <span className="ml-1 font-medium">{info.durability}</span>
            </div>
          </div>

          <div className="text-tooltip flex items-start gap-1.5">
            <Palette className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <span className="text-muted-foreground">Cores:</span>
              <span className="ml-1 font-medium">{info.colors}</span>
            </div>
          </div>

          <div className="text-tooltip flex items-start gap-1.5">
            <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <span className="text-muted-foreground">Ideal para:</span>
              <span className="ml-1 font-medium">{info.bestFor}</span>
            </div>
          </div>

          {/* ─── Dados reais do produto/área (vindos do RPC) ─── */}
          {(technique.locationName ||
            technique.maxWidth ||
            technique.maxColors !== null ||
            technique.setupCost !== null ||
            technique.groupCode ||
            technique.variationLabel ||
            technique.isCurved) && (
            <div className="mt-1.5 space-y-1 border-t border-white/5 pt-2">
              {technique.locationName && (
                <div className="text-tooltip flex items-start gap-1.5">
                  <Layers className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">Local:</span>
                    <span className="ml-1 font-medium">{technique.locationName}</span>
                  </div>
                </div>
              )}
              {technique.variationLabel && (
                <div className="text-tooltip flex items-start gap-1.5">
                  <Info className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">Variação:</span>
                    <span className="ml-1 font-medium">{technique.variationLabel}</span>
                    {technique.groupCode && (
                      <span className="ml-1 text-muted-foreground">({technique.groupCode})</span>
                    )}
                  </div>
                </div>
              )}
              {technique.maxWidth && technique.maxHeight && (
                <div className="text-tooltip flex items-start gap-1.5">
                  <Ruler className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">Máx:</span>
                    <span className="ml-1 font-medium tabular-nums">
                      {technique.maxWidth}×{technique.maxHeight} cm
                    </span>
                  </div>
                </div>
              )}
              {technique.maxColors !== null && (
                <div className="text-tooltip flex items-start gap-1.5">
                  <Palette className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">Máx cores:</span>
                    <span className="ml-1 font-medium">{technique.maxColors}</span>
                    {technique.chargesPerColor && (
                      <span className="text-tooltip ml-1 text-muted-foreground">
                        (cobra por cor)
                      </span>
                    )}
                  </div>
                </div>
              )}
              {typeof technique.setupCost === 'number' && technique.setupCost > 0 && (
                <div className="text-tooltip flex items-start gap-1.5">
                  <Wrench className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <span className="text-muted-foreground">Setup:</span>
                    <span className="ml-1 font-medium tabular-nums">
                      R$ {technique.setupCost.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
              {technique.isCurved && (
                <Badge variant="outline" className="text-tooltip h-auto px-1.5 py-0.5">
                  Suporta curvo
                </Badge>
              )}
            </div>
          )}

          {/* Visual Style Preview */}
          <div className="mt-1 border-t border-white/5 pt-1.5">
            <p className="text-tooltip text-muted-foreground">
              <span className="font-medium">Aparência:</span> {info.visualStyle}
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
