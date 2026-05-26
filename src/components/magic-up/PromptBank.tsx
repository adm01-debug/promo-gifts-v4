/**
 * PromptBank — Banco de prompts publicitários pré-definidos
 * Categorias: Lifestyle, Corporativo, Outdoor, Esporte, Gastronomia, Varejo
 */

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Briefcase,
  TreePine,
  Dumbbell,
  Coffee,
  ShoppingBag,
  PartyPopper,
  GraduationCap,
  Heart,
  Search,
  Sparkles,
} from 'lucide-react';

export interface ScenePrompt {
  id: string;
  title: string;
  prompt: string;
  category: string;
  icon?: string;
}

interface PromptBankProps {
  selectedPrompt: ScenePrompt | null;
  onSelect: (prompt: ScenePrompt) => void;
  productName?: string;
  /** Ramo de atividade do cliente para sugerir cenários relevantes */
  clientSegment?: string | null;
}

/** Mapeamento de ramos de atividade para categorias de cenário */
const SEGMENT_CATEGORY_MAP: Record<string, string[]> = {
  tecnologia: ['corporativo', 'lifestyle'],
  informática: ['corporativo', 'lifestyle'],
  saúde: ['esporte', 'corporativo'],
  educação: ['educacao', 'corporativo'],
  alimentação: ['gastronomia', 'varejo'],
  alimentos: ['gastronomia', 'varejo'],
  construção: ['outdoor', 'corporativo'],
  esporte: ['esporte', 'outdoor'],
  moda: ['lifestyle', 'varejo'],
  varejo: ['varejo', 'lifestyle'],
  comércio: ['varejo', 'lifestyle'],
  serviços: ['corporativo', 'evento'],
  indústria: ['corporativo', 'outdoor'],
  financeiro: ['corporativo'],
  marketing: ['lifestyle', 'evento', 'corporativo'],
  agronegócio: ['outdoor'],
  turismo: ['outdoor', 'lifestyle', 'gastronomia'],
  eventos: ['evento', 'gastronomia'],
};

const CATEGORIES = [
  { id: 'all', label: 'Todos', icon: Sparkles },
  { id: 'lifestyle', label: 'Lifestyle', icon: Heart },
  { id: 'corporativo', label: 'Corporativo', icon: Briefcase },
  { id: 'outdoor', label: 'Outdoor', icon: TreePine },
  { id: 'esporte', label: 'Esporte', icon: Dumbbell },
  { id: 'gastronomia', label: 'Gastronomia', icon: Coffee },
  { id: 'varejo', label: 'Varejo', icon: ShoppingBag },
  { id: 'evento', label: 'Eventos', icon: PartyPopper },
  { id: 'educacao', label: 'Educação', icon: GraduationCap },
] as const;

const SCENE_PROMPTS: ScenePrompt[] = [
  // Lifestyle
  {
    id: 'life-01',
    category: 'lifestyle',
    title: 'Escritório Moderno',
    prompt:
      'A young professional using the product at a modern, well-lit office desk with minimalist decor, natural light streaming through large windows, warm and inviting atmosphere',
  },
  {
    id: 'life-02',
    category: 'lifestyle',
    title: 'Home Office Aconchegante',
    prompt:
      'Person working from home at a cozy home office setup, the product prominently placed on the desk, soft ambient lighting, plants in the background, lifestyle photography',
  },
  {
    id: 'life-03',
    category: 'lifestyle',
    title: 'Café da Manhã',
    prompt:
      'Person enjoying breakfast at a beautiful kitchen counter, using the product naturally, morning sunlight, fresh fruits and coffee on the table, warm tones',
  },
  {
    id: 'life-04',
    category: 'lifestyle',
    title: 'Viagem Urbana',
    prompt:
      'Stylish traveler walking through a vibrant city street carrying/using the product, urban architecture in background, golden hour lighting, street photography style',
  },
  {
    id: 'life-05',
    category: 'lifestyle',
    title: 'Momento Relax',
    prompt:
      'Person relaxing on a comfortable sofa reading a book, with the product visible nearby, soft interior lighting, cozy living room setting, hygge atmosphere',
  },

  // Corporativo
  {
    id: 'corp-01',
    category: 'corporativo',
    title: 'Reunião de Negócios',
    prompt:
      'Professional business meeting in a modern conference room, the product placed on the table among executives, clean corporate environment, sharp focus',
  },
  {
    id: 'corp-02',
    category: 'corporativo',
    title: 'Recepção Empresarial',
    prompt:
      'Elegant corporate reception desk with the product displayed as a welcome gift, professional lobby with marble and glass, sophisticated branding environment',
  },
  {
    id: 'corp-03',
    category: 'corporativo',
    title: 'Onboarding Kit',
    prompt:
      'New employee welcome kit elegantly arranged on a desk, the product as the centerpiece, modern office environment, warm welcome atmosphere, flatlay style',
  },
  {
    id: 'corp-04',
    category: 'corporativo',
    title: 'Palestrante no Palco',
    prompt:
      'Confident speaker on a well-lit stage at a corporate conference, holding or displaying the product, audience in soft focus background, professional event photography',
  },
  {
    id: 'corp-05',
    category: 'corporativo',
    title: 'Mesa do CEO',
    prompt:
      'Executive desk in a high-end corner office, the product prominently placed as a premium item, city skyline visible through floor-to-ceiling windows, luxury business setting',
  },

  // Outdoor
  {
    id: 'out-01',
    category: 'outdoor',
    title: 'Trilha na Montanha',
    prompt:
      'Adventurous person hiking on a scenic mountain trail, using the product during a break, breathtaking landscape backdrop, adventure photography, vibrant nature colors',
  },
  {
    id: 'out-02',
    category: 'outdoor',
    title: 'Praia ao Pôr do Sol',
    prompt:
      'Person relaxing at a beautiful beach during golden hour sunset, the product clearly visible, waves and warm sky in background, summer vibes, editorial style',
  },
  {
    id: 'out-03',
    category: 'outdoor',
    title: 'Parque Urbano',
    prompt:
      'Young person sitting on grass in a lush urban park, casually using the product, trees and greenery surrounding, dappled sunlight, natural and authentic feel',
  },
  {
    id: 'out-04',
    category: 'outdoor',
    title: 'Camping Aventura',
    prompt:
      'Camping scene with tent and campfire, the product being used in the wilderness, starry sky or forest backdrop, warm campfire glow, adventure lifestyle',
  },

  // Esporte
  {
    id: 'spt-01',
    category: 'esporte',
    title: 'Academia Fitness',
    prompt:
      'Fit person at a modern gym, using the product during workout break, industrial-chic gym interior, motivational atmosphere, dynamic sports photography',
  },
  {
    id: 'spt-02',
    category: 'esporte',
    title: 'Corrida Matinal',
    prompt:
      'Runner in athletic wear pausing in a scenic park, holding/using the product, early morning light, dewy grass, active lifestyle photography',
  },
  {
    id: 'spt-03',
    category: 'esporte',
    title: 'Yoga ao Ar Livre',
    prompt:
      'Person practicing yoga outdoors on a beautiful terrace, the product placed on a yoga mat nearby, serene setting, zen atmosphere, soft natural light',
  },

  // Gastronomia
  {
    id: 'gas-01',
    category: 'gastronomia',
    title: 'Café Artesanal',
    prompt:
      'Artisan coffee shop setting, the product on a wooden table alongside a latte art coffee, rustic-chic interior, warm ambient lighting, foodie photography',
  },
  {
    id: 'gas-02',
    category: 'gastronomia',
    title: 'Restaurante Sofisticado',
    prompt:
      'Upscale restaurant table setting, the product elegantly placed as part of the dining experience, fine dining ambiance, soft candlelight, luxurious atmosphere',
  },
  {
    id: 'gas-03',
    category: 'gastronomia',
    title: 'Churrasco com Amigos',
    prompt:
      'Friends gathering around a BBQ party, someone using the product, outdoor patio setting, festive atmosphere, warm afternoon light, lifestyle documentary style',
  },

  // Varejo
  {
    id: 'var-01',
    category: 'varejo',
    title: 'Vitrine de Loja',
    prompt:
      'Beautiful retail store window display featuring the product as the hero item, professional visual merchandising, eye-catching lighting, premium presentation',
  },
  {
    id: 'var-02',
    category: 'varejo',
    title: 'Unboxing Premium',
    prompt:
      'Luxurious unboxing experience, hands carefully removing the product from elegant packaging, close-up flatlay angle, premium materials, aspirational product photography',
  },
  {
    id: 'var-03',
    category: 'varejo',
    title: 'Gift Box Elegante',
    prompt:
      'The product beautifully wrapped as a gift inside an elegant box with tissue paper and ribbon, gift-giving moment, warm festive atmosphere, premium presentation',
  },

  // Eventos
  {
    id: 'evt-01',
    category: 'evento',
    title: 'Feira de Negócios',
    prompt:
      'Busy trade show booth with the product on display, professional attendees, modern exhibition design, bright expo lighting, commercial event photography',
  },
  {
    id: 'evt-02',
    category: 'evento',
    title: 'Festa de Confraternização',
    prompt:
      'Year-end company party celebration, employees holding the product as corporate gift, festive decorations, happy atmosphere, event photography',
  },
  {
    id: 'evt-03',
    category: 'evento',
    title: 'Workshop Criativo',
    prompt:
      'Creative workshop setting with participants using the product, collaborative workspace, colorful supplies, engaged atmosphere, candid photography',
  },

  // Educação
  {
    id: 'edu-01',
    category: 'educacao',
    title: 'Sala de Aula',
    prompt:
      'Student at a university classroom desk using the product, books and notebooks around, academic environment, focused study atmosphere, educational setting',
  },
  {
    id: 'edu-02',
    category: 'educacao',
    title: 'Formatura',
    prompt:
      'Graduate in cap and gown proudly holding the product as a graduation gift, university campus in background, celebratory moment, achievement photography',
  },
];

export function PromptBank({
  selectedPrompt,
  onSelect,
  productName,
  clientSegment,
}: PromptBankProps) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');

  // Determinar categorias sugeridas pelo segmento do cliente
  const suggestedCategories = useMemo(() => {
    if (!clientSegment) return null;
    const seg = clientSegment.toLowerCase();
    for (const [key, cats] of Object.entries(SEGMENT_CATEGORY_MAP)) {
      if (seg.includes(key)) return cats;
    }
    return null;
  }, [clientSegment]);

  const filtered = useMemo(() => {
    let items = SCENE_PROMPTS.filter((p) => {
      if (activeCategory !== 'all' && p.category !== activeCategory) return false;
      if (search) {
        const q = search.toLowerCase();
        return p.title.toLowerCase().includes(q) || p.prompt.toLowerCase().includes(q);
      }
      return true;
    });

    // Ordenar: cenários sugeridos primeiro
    if (suggestedCategories && activeCategory === 'all' && !search) {
      items = [...items].sort((a, b) => {
        const aScore = suggestedCategories.includes(a.category) ? 0 : 1;
        const bScore = suggestedCategories.includes(b.category) ? 0 : 1;
        return aScore - bScore;
      });
    }

    return items;
  }, [activeCategory, search, suggestedCategories]);

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar cenário..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 pl-9"
        />
      </div>

      {/* Category chips */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          const isSuggested = suggestedCategories?.includes(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : isSuggested
                    ? 'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground',
              )}
            >
              <Icon className="h-3 w-3" />
              {cat.label}
              {isSuggested && !isActive && <span className="text-[8px] opacity-70">★</span>}
            </button>
          );
        })}
      </div>

      {suggestedCategories && activeCategory === 'all' && !search && (
        <p className="flex items-center gap-1 text-[10px] text-primary/70">
          ★ Cenários sugeridos para o segmento do cliente aparecem primeiro
        </p>
      )}

      {/* Prompt grid */}
      <div className="grid max-h-[320px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {filtered.map((scene) => {
          const isSelected = selectedPrompt?.id === scene.id;
          const catInfo = CATEGORIES.find((c) => c.id === scene.category);
          return (
            <Card
              key={scene.id}
              className={cn(
                'group cursor-pointer transition-all hover:shadow-md',
                isSelected
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'hover:border-primary/40',
              )}
              onClick={() => onSelect(scene)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={cn('truncate text-sm font-medium', isSelected && 'text-primary')}>
                      {scene.title}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                      {scene.prompt.slice(0, 90)}...
                    </p>
                  </div>
                  {catInfo && (
                    <Badge variant="outline" className="shrink-0 px-1.5 text-[9px]">
                      {catInfo.label}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <div className="col-span-2 py-8 text-center text-sm text-muted-foreground">
            Nenhum cenário encontrado
          </div>
        )}
      </div>

      <p className="text-center text-[10px] text-muted-foreground">
        {filtered.length} cenários disponíveis
      </p>
    </div>
  );
}
