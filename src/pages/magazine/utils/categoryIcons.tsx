/**
 * categoryIcons — 14 pictogramas minimalistas alinhados ao padrão Abreez 2026.
 * Todos herdam `currentColor` e são desenhados em viewBox 24×24 com stroke 1.6.
 * Podem ser usados dentro do `VerticalCategoryStripe` ou em qualquer chip/badge.
 */

import type { SVGProps } from 'react';
import {
  Cpu,
  GlassWater,
  Gift,
  Shirt,
  Badge as BadgeIcon,
  Trophy,
  Package,
  PenLine,
  Backpack,
  Clock as ClockIcon,
  Signpost,
  // `IdCard` NÃO existe no lucide-react instalado: o import virava `undefined` e
  // <undefined/> derruba o React ("Element type is invalid"). `Contact` é o crachá.
  Contact,
  Boxes,
  Sparkles,
} from 'lucide-react';
import type { MagazineCategory } from '@/types/magazine';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const MAP: Record<MagazineCategory, (p: IconProps) => JSX.Element> = {
  technology: (p) => <Cpu strokeWidth={1.6} {...p} />,
  drinkwares: (p) => <GlassWater strokeWidth={1.6} {...p} />,
  general: (p) => <Gift strokeWidth={1.6} {...p} />,
  wearables: (p) => <Shirt strokeWidth={1.6} {...p} />,
  pins: (p) => <BadgeIcon strokeWidth={1.6} {...p} />,
  awards: (p) => <Trophy strokeWidth={1.6} {...p} />,
  packaging: (p) => <Package strokeWidth={1.6} {...p} />,
  stationery: (p) => <PenLine strokeWidth={1.6} {...p} />,
  bags: (p) => <Backpack strokeWidth={1.6} {...p} />,
  clocks: (p) => <ClockIcon strokeWidth={1.6} {...p} />,
  signs: (p) => <Signpost strokeWidth={1.6} {...p} />,
  id: (p) => <Contact strokeWidth={1.6} {...p} />,
  giftsets: (p) => <Boxes strokeWidth={1.6} {...p} />,
  customized: (p) => <Sparkles strokeWidth={1.6} {...p} />,
};


export function CategoryIcon({
  category,
  size = 24,
  ...rest
}: IconProps & { category: MagazineCategory | null | undefined }) {
  const key = (category ?? 'technology') as MagazineCategory;
  const Cmp = MAP[key] ?? MAP.technology;
  return <Cmp width={size} height={size} {...rest} />;
}
