import type { LucideIcon } from 'lucide-react';
import {
  Award,
  Backpack,
  Battery,
  Beer,
  Beef,
  BookOpen,
  Briefcase,
  Calendar,
  ChefHat,
  Circle,
  ClipboardList,
  Coffee,
  CreditCard,
  Crown,
  Dices,
  Droplets,
  Dumbbell,
  Flame,
  Flashlight,
  Flower2,
  Gamepad2,
  Gift,
  GlassWater,
  Hammer,
  HardDrive,
  Headphones,
  Heart,
  Home,
  Key,
  Keyboard,
  Layers,
  Leaf,
  Medal,
  Monitor,
  Mouse,
  Notebook,
  Package,
  Paperclip,
  PawPrint,
  Pen,
  PenLine,
  Pencil,
  Plug,
  Recycle,
  Ruler,
  Scissors,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Speaker,
  Star,
  Sun,
  Tag,
  TreePine,
  Trophy,
  Utensils,
  Wallet,
  Watch,
  Wine,
  Wrench,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Mapa: nome do ícone armazenado no DB → componente Lucide.
 *
 * Chave  = string gravada em category_icons.icon (ex: "Coffee")
 * Valor  = componente Lucide correspondente
 *
 * Aliases garantem compatibilidade com variações de nome durante a migração.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  // ✍️  Escrita / Papelaria
  Pen,
  PenLine,
  Pencil,
  BookOpen,
  Notebook,
  Calendar,
  ClipboardList,
  Paperclip,

  // 💻  Tecnologia
  Plug,
  Battery,
  Headphones,
  Mouse,
  Keyboard,
  HardDrive,
  Smartphone,
  Monitor,
  Speaker,
  Zap,

  // ☕  Bar / Cozinha / Gourmet
  Coffee,
  Wine,
  Beer,
  Beef,
  Utensils,
  ChefHat,
  GlassWater,

  // 🎒  Bolsas / Acessórios
  ShoppingBag,
  Backpack,
  Briefcase,
  Wallet,

  // 👕  Vestuário
  Shirt,

  // 🔧  Ferramentas
  Wrench,
  Key,
  Ruler,
  Hammer,
  Scissors,
  Flashlight,

  // 🏋️  Esportes / Lazer / Bem-Estar
  Dumbbell,
  Trophy,
  Award,
  Medal,
  Star,
  Sun,
  Droplets,
  Heart,

  // 🎮  Jogos / Entretenimento
  Gamepad2,
  Dices,

  // 🏠  Casa / Decoração
  Home,
  Flame,
  Watch,
  Flower2,
  Layers,

  // 🌿  Natureza / Eco / Sustentável
  Leaf,
  Recycle,
  TreePine,

  // ✨  Saúde / Beleza / Higiene
  Sparkles,

  // 🐾  Pet
  PawPrint,

  // 👑  Premium / Corporativo
  Crown,
  Tag,
  CreditCard,

  // 📦  Geral / Embalagens / Default
  Package,
  Circle,
  Gift,

  // ─── Aliases para tolerância de nomes alternativos no DB ───
  UtensilsCrossed: Utensils,
  BeerMug: Beer,
  GlassWine: Wine,
  PenTool: Pen,
  Toolbox: Wrench,
  PlugZap: Plug,
  Volume2: Speaker,
} as const;

interface CategoryIconProps {
  /**
   * Nome do ícone Lucide ("Coffee") ou emoji/texto legado ("☕").
   *
   * - Nome Lucide reconhecido → renderiza componente SVG
   * - Qualquer outro string   → renderiza como emoji/texto (fallback legado)
   */
  value: string | null | undefined;
  className?: string;
  /** Tamanho em px. Default: 14 (alinhado com text-sm dos badges). */
  size?: number;
}

/**
 * Renderizador unificado de ícones de categoria.
 *
 * ## Estratégia de renderização
 *
 * ```
 * DB: category_icons.icon
 *       │
 *       ├─ Nome Lucide ("Coffee") ──► <Coffee size={14} />   ✅ SVG limpo
 *       │
 *       └─ Emoji legado ("☕")    ──► <span>☕</span>        ✅ backward-compat
 * ```
 *
 * Isso permite migração progressiva: o DB pode ter mix de nomes Lucide e
 * emojis antigos — ambos funcionam sem quebrar a UI.
 *
 * @example
 * // Após migração do DB (nome Lucide):
 * <CategoryIcon value="Coffee" size={14} />      // → <Coffee size={14} />
 *
 * // Antes da migração (emoji legado):
 * <CategoryIcon value="☕" size={14} />          // → <span style={{fontSize:14}}>☕</span>
 *
 * // Sem ícone / null:
 * <CategoryIcon value={null} />                 // → <Package size={14} /> (default)
 */
export function CategoryIcon({ value, className, size = 14 }: CategoryIconProps) {
  const iconValue = value?.trim() || 'Package';
  const LucideComponent = ICON_MAP[iconValue];

  if (LucideComponent) {
    return (
      <LucideComponent
        className={cn('inline-block shrink-0', className)}
        size={size}
        aria-hidden="true"
      />
    );
  }

  // Fallback: emoji ou texto legado (dados no DB ainda não migrados)
  return (
    <span
      className={cn('inline-block leading-none select-none', className)}
      style={{ fontSize: size }}
      aria-hidden="true"
    >
      {iconValue}
    </span>
  );
}
