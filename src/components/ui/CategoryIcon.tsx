import type { LucideIcon } from 'lucide-react';
import {
  // ✍️ Escrita / Papelaria
  Award,
  Backpack,
  Battery,
  Beer,
  Beef,
  BookOpen,
  Briefcase,
  Calendar,
  Calculator,
  ChefHat,
  Circle,
  CircleDot,
  ClipboardList,
  Clock,
  Coffee,
  CreditCard,
  Crown,
  AlarmClock,
  Car,
  Cpu,
  Dices,
  Droplets,
  Dumbbell,
  Flame,
  Flashlight,
  Flower2,
  Gamepad2,
  Gift,
  Glasses,
  GlassWater,
  Hammer,
  HardDrive,
  Headphones,
  Heart,
  Home,
  Image,
  Key,
  Keyboard,
  Lamp,
  Laptop,
  Layers,
  Leaf,
  Lock,
  Luggage,
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
  Pill,
  Pin,
  Plug,
  Recycle,
  Ruler,
  Scissors,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Speaker,
  Sprout,
  Star,
  Sun,
  Tag,
  Thermometer,
  TreePine,
  Trophy,
  Umbrella,
  Utensils,
  Wallet,
  Watch,
  Wine,
  Wrench,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * @file CategoryIcon.tsx
 * @description Renderizador unificado de ícones para categorias de produtos.
 *
 * ## Como funciona
 *
 * O campo `category_icons.icon` no banco armazena o nome PascalCase de um
 * ícone Lucide (ex: `"Coffee"`). Este componente faz a resolução:
 *
 * ```
 * DB: "Coffee"  →  ICON_MAP["Coffee"]  →  <Coffee size={14} />  (SVG)
 * DB: "Notebook" →  ICON_MAP["Notebook"] →  <Notebook size={14} /> (SVG)
 * DB: "☕"       →  ICON_MAP["☕"] = null  →  <span>☕</span>          (emoji legado)
 * ```
 *
 * ## Adicionando um novo ícone
 *
 * 1. Verifique se o ícone existe em lucide.dev com o nome exato
 * 2. Adicione o import na lista acima
 * 3. Adicione a entrada no ICON_MAP abaixo
 * 4. Atualize category_icons no banco: `UPDATE category_icons SET icon = 'NomeDoIcone' WHERE ...`
 * 5. Atualize KEYWORD_ICONS em useCategoryIcons.ts se necessário
 * 6. Documente em docs/CATEGORY_ICONS_GUIDE.md
 *
 * ## Bibliotecas
 * - lucide-react ^0.309.0 (promo-gifts-v4)
 * - Buscar ícones: https://lucide.dev
 */

/**
 * Mapa completo: nome Lucide (armazenado no DB) → componente React.
 *
 * ### Categorias cobertas
 * - Bar / Bebidas / Gourmet
 * - Tecnologia / Eletrônicos
 * - Papelaria / Escritório
 * - Bolsas / Acessórios / Viagem
 * - Vestuário / Calçados
 * - Ferramentas / Utilidades
 * - Esportes / Bem-Estar / Fitness
 * - Jogos / Entretenimento
 * - Casa / Decoração / Pet
 * - Natureza / Eco / Sustentável
 * - Saúde / Beleza / Higiene
 * - Premium / Corporativo / Premiações
 * - Embalagens / Geral
 *
 * ### Aliases de compatibilidade
 * Entradas com nome diferente do import garantem tolerância a nomes
 * alternativos que possam surgir durante migrações no banco.
 */
const ICON_MAP: Record<string, LucideIcon> = {

  // ── BAR / BEBIDAS / GOURMET ─────────────────────────────────────
  Coffee,          // canécas, xícaras, café, chá, chimarrão
  Wine,            // taças, vinho, caipirinha, gin, espumante
  Beer,            // cerveja, tulipa, chopp
  GlassWater,      // copos, drinks, cantil
  ChefHat,         // fondue, queijo, gourmet
  Utensils,        // talheres, bowl, petisqueira
  Beef,            // churrasco (proteína)
  Flame,           // churrasco, velas aromáticas

  // ── TECNOLOGIA / ELETRÔNICOS ─────────────────────────────
  Smartphone,      // celular, suporte
  Laptop,          // mochila notebook, laptop
  Monitor,         // desktop
  Cpu,             // tecnologia / eletrônicos genérico
  Mouse,           // mouse pad, desk pad, apoio teclado
  Keyboard,        // teclado
  Headphones,      // fone de ouvido
  Speaker,         // caixa de som
  HardDrive,       // pen drive, HD
  Battery,         // powerbank, carregador portátil
  Plug,            // cabos, adaptadores
  Zap,             // massageador elétrico, elétrico genérico

  // ── PAPELARIA / ESCRITÓRIO ──────────────────────────────
  Pen,             // canetas
  PenLine,         // canetas premium, porta-caneta
  Pencil,          // lápis, lapiseiras
  Notebook,        // cadernos, blocos, cadernetas
  BookOpen,        // livros, catálogos
  Calendar,        // agendas, calendários
  ClipboardList,   // papelaria genérica
  Calculator,      // calculadoras
  Paperclip,       // clipes, prendedores

  // ── BOLSAS / ACESSÓRIOS / VIAGEM ───────────────────────
  Backpack,        // mochilas (todas)
  ShoppingBag,     // necessaire, frasqueira, pochete
  Briefcase,       // kit executivo, pasta trabalho
  Wallet,          // carteiras
  Luggage,         // malas, bolsas de viagem, kit viagem

  // ── VESTUÁRIO / CALÇADOS ──────────────────────────────
  Shirt,           // camisetas, roupas
  Glasses,         // óculos de sol, óculos

  // ── FERRAMENTAS / UTILIDADES ──────────────────────────
  Wrench,          // ferramentas, chaves, alicate
  Hammer,          // martelo
  Ruler,           // trenas, réguas
  Scissors,        // cutelaria, facas, escovas
  Flashlight,      // lanternas
  Lamp,            // luminárias, abajur
  Key,             // chaveiros
  Pin,             // pins, bottons, broches
  Lock,            // mochila anti-furto, segurança

  // ── ESPORTES / BEM-ESTAR / FITNESS ────────────────────
  Dumbbell,        // academia, fitness, corrida, calçados esportivos
  Trophy,          // troféus, premiações
  Award,           // premiações, placas, certificados
  Medal,           // medalhas
  Crown,           // premium, premiére, VIP
  Star,            // chaveiros premium (genérico)
  CircleDot,       // esportes de bola: futebol, vôlei, basquete
  Umbrella,        // guarda-chuva, guarda-sol

  // ── RELÓGIOS / TEMPO ────────────────────────────────
  Watch,           // relógio de pulso
  Clock,           // relógio de parede
  AlarmClock,      // relógio de mesa, despertador

  // ── JOGOS / ENTRETENIMENTO ────────────────────────────
  Gamepad2,        // jogos eletrônicos
  Dices,           // dominó, dados, jogos de tabuleiro

  // ── SAÚDE / BELEZA / HIGIENE ─────────────────────────
  Sparkles,        // espelhos, maquiagem, beleza
  Pill,            // porta-comprimido, farmácia
  Heart,           // saúde genérico, bem-estar
  Droplets,        // higiene, banho, kit spa, guarda-sol
  Thermometer,     // térmicos: garrafa, bolsa, caixa térmica, cooler

  // ── NATUREZA / ECO / SUSTENTÁVEL ────────────────────
  Leaf,            // eco genérico, madeira, couro eco
  Sprout,          // agro, kit cultivo, lápis semente, brotos
  Recycle,         // sacola ecobag, reciclados
  TreePine,        // bambu, madeira, floresta
  Sun,             // chapéus, praia, verão, viseiras
  Flower2,         // flores, vasos, plantas

  // ── PET ────────────────────────────────────────────
  PawPrint,        // tudo de pet: cama, coleira, ração, identif.

  // ── CASA / DECORAÇÃO ───────────────────────────────
  Home,            // casa genérico
  Image,           // porta-retrato, quadros, fotos

  // ── EMBALAGENS / GERAL ──────────────────────────────
  Package,         // embalagens, marmitas, caixas (default)
  Layers,          // manta, cobertor, toalha (layered products)
  Circle,          // porta-copo, itens circulares
  Gift,            // brindes, presentes
  Tag,             // acessórios genéricos, tags, bonés
  CreditCard,      // crachás, identificação, cordão

  // ── ALIASES — compatibilidade com nomes alternativos no DB ──
  UtensilsCrossed: Utensils,
  BeerMug:         Beer,
  GlassWine:       Wine,
  PenTool:         Pen,
  Toolbox:         Wrench,
  PlugZap:         Plug,
  Volume2:         Speaker,
  LaptopMinimal:   Laptop,
  AlarmClockCheck: AlarmClock,
  ShieldCheck:     Lock,
} as const;

interface CategoryIconProps {
  /**
   * Nome do ícone Lucide ("Coffee") ou valor legado ("☕", "bottle").
   *
   * Se o valor estiver em ICON_MAP → renderiza componente SVG Lucide.
   * Caso contrário → renderiza como `<span>` (emoji/texto legado do DB).
   *
   * @example
   * // Ícone Lucide (pós-migração):
   * <CategoryIcon value="Coffee" size={14} />    // → <Coffee size={14} />
   * <CategoryIcon value="Luggage" size={14} />   // → <Luggage size={14} />
   *
   * // Emoji legado (compat, pré-migração):
   * <CategoryIcon value="\u2615" size={14} />        // → <span style={{fontSize:14}}>☕</span>
   *
   * // null/undefined → ícone padrão:
   * <CategoryIcon value={null} />               // → <Package size={14} />
   */
  value: string | null | undefined;
  className?: string;
  /**
   * Tamanho em pixels do ícone SVG.
   * Para emojis, vira `font-size` do `<span>`.
   * @default 14
   */
  size?: number;
}

/**
 * Componente de ícone de categoria.
 *
 * Renderiza um ícone Lucide SVG quando o valor é um nome conhecido,
 * ou um emoji/texto em `<span>` como fallback legado.
 *
 * @see docs/CATEGORY_ICONS_GUIDE.md para o guia completo de mapeamentos.
 * @see https://lucide.dev para pesquisar novos ícones.
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
