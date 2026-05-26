/**
 * Constants for PromptGenerator — objectives, tones, audiences, seasons
 */
import { Megaphone, Zap, Target, Star, Lightbulb } from 'lucide-react';

export const OBJECTIVES = [
  { value: 'brand-awareness', label: 'Reconhecimento de marca', icon: Megaphone },
  { value: 'product-launch', label: 'Lançamento de produto', icon: Zap },
  { value: 'corporate-gift', label: 'Brinde corporativo', icon: Target },
  { value: 'social-media', label: 'Redes sociais', icon: Star },
  { value: 'catalog', label: 'Catálogo / E-commerce', icon: Lightbulb },
];

export const TONES = [
  { value: 'premium', label: 'Premium & Sofisticado' },
  { value: 'fun', label: 'Divertido & Vibrante' },
  { value: 'professional', label: 'Profissional & Clean' },
  { value: 'warm', label: 'Acolhedor & Humano' },
  { value: 'bold', label: 'Ousado & Impactante' },
  { value: 'minimalist', label: 'Minimalista & Elegante' },
];

export const AUDIENCES = [
  { value: 'executives', label: 'Executivos / C-Level' },
  { value: 'young-professionals', label: 'Jovens Profissionais' },
  { value: 'students', label: 'Estudantes' },
  { value: 'families', label: 'Famílias' },
  { value: 'athletes', label: 'Atletas / Fitness' },
  { value: 'general', label: 'Público Geral' },
];

export const SEASONS = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'christmas', label: '🎄 Natal' },
  { value: 'new-year', label: '🎆 Ano Novo' },
  { value: 'carnival', label: '🎭 Carnaval' },
  { value: 'easter', label: '🐰 Páscoa' },
  { value: 'mothers-day', label: '👩 Dia das Mães' },
  { value: 'fathers-day', label: '👨 Dia dos Pais' },
  { value: 'valentines', label: '💕 Dia dos Namorados' },
  { value: 'black-friday', label: '🏷️ Black Friday' },
  { value: 'summer', label: '☀️ Verão' },
  { value: 'winter', label: '❄️ Inverno' },
  { value: 'back-to-school', label: '📚 Volta às aulas' },
  { value: 'corporate-event', label: '🏢 Evento Corporativo' },
];

export const MOOD_COLORS: Record<string, string> = {
  warm: 'bg-brand-primary/10 text-brand-primary border-brand-primary/20',
  elegant: 'bg-primary/10 text-primary border-primary/20',
  dynamic: 'bg-primary/15 text-primary/80 border-primary/25',
  serene: 'bg-primary/10 text-primary border-primary/20',
  bold: 'bg-destructive/10 text-destructive border-destructive/20',
  playful: 'bg-primary/10 text-primary/70 border-primary/15',
  professional: 'bg-muted/30 text-muted-foreground border-border',
  cozy: 'bg-warning/10 text-warning border-warning/20',
};

export function getMoodColor(mood: string) {
  return MOOD_COLORS[mood.toLowerCase()] || 'bg-muted text-muted-foreground border-border';
}
