// =====================================================
// THEME PRESETS SYSTEM — buildPreset() factory
// Covers ALL CSS vars from index.css for DEEP theming
// =====================================================

export interface ThemeModeColors {
  // === SUPERFÍCIES CORE ===
  background: string;
  foreground: string;
  card: string;
  'card-foreground': string;
  'card-elevated': string;
  popover: string;
  'popover-foreground': string;

  // === CORES PRIMÁRIAS ===
  primary: string;
  'primary-foreground': string;
  'primary-hover': string;
  'primary-active': string;
  'primary-glow': string;

  // === CORES SECUNDÁRIAS ===
  secondary: string;
  'secondary-foreground': string;

  // === MUTED ===
  muted: string;
  'muted-foreground': string;

  // === ACCENT ===
  accent: string;
  'accent-foreground': string;

  // === BORDAS & INPUTS ===
  border: string;
  input: string;
  ring: string;

  // === SEMANTIC ===
  surface: string;
  'surface-hover': string;
  'text-secondary': string;
  interactive: string;
  divider: string;

  // === ORANGE (Promo Gifts brand orange — fixed across presets) ===
  orange: string;
  'orange-hover': string;
  'orange-active': string;
  'orange-glow': string;
  'orange-foreground': string;

  // === SIDEBAR ===
  'sidebar-background': string;
  'sidebar-foreground': string;
  'sidebar-primary': string;
  'sidebar-primary-foreground': string;
  'sidebar-accent': string;
  'sidebar-accent-foreground': string;
  'sidebar-border': string;
  'sidebar-ring': string;

  // === ELEVAÇÃO ===
  elevated: string;
  'elevated-hover': string;

  // === GLASS MORPHISM (ALL variants) ===
  'glass-bg': string;
  'glass-bg-strong': string;
  'glass-bg-subtle': string;
  'glass-border': string;
  'glass-border-strong': string;
  'glass-shadow': string;

  // === GRADIENTES (ALL used in index.css) ===
  'gradient-primary': string;
  'gradient-secondary': string;
  'gradient-success': string;
  'gradient-surface': string;
  'gradient-divider': string;
  'gradient-hero': string;
  'gradient-novelty': string;

  // === SOMBRAS GLOW (ALL) ===
  'shadow-glow': string;
  'shadow-glow-primary': string;
  'shadow-glow-secondary': string;
  'shadow-glow-success': string;
  'shadow-glow-warning': string;

  // === SOMBRAS DEPTH ===
  'shadow-lg': string;
  'shadow-xl': string;
  'shadow-header': string;

  // === CHART ===
  'chart-1': string;
}

export const CSS_VARS_TO_APPLY: (keyof ThemeModeColors)[] = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'card-elevated',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'primary-hover',
  'primary-active',
  'primary-glow',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'border',
  'input',
  'ring',
  'surface',
  'surface-hover',
  'text-secondary',
  'interactive',
  'divider',
  'sidebar-background',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
  'elevated',
  'elevated-hover',
  'glass-bg',
  'glass-bg-strong',
  'glass-bg-subtle',
  'glass-border',
  'glass-border-strong',
  'glass-shadow',
  'gradient-primary',
  'gradient-secondary',
  'gradient-success',
  'gradient-surface',
  'gradient-divider',
  'gradient-hero',
  'gradient-novelty',
  'shadow-glow',
  'shadow-glow-primary',
  'shadow-glow-secondary',
  'shadow-glow-success',
  'shadow-glow-warning',
  'shadow-lg',
  'shadow-xl',
  'shadow-header',
  'chart-1',
  // BUG-04 fix: orange-* tokens ausentes — applyThemePreset() nunca
  // atualizava --orange-* ao trocar de preset.
  // @see docs/design-system-audit-2026-05-25.md
  'orange',
  'orange-hover',
  'orange-active',
  'orange-glow',
  'orange-foreground',
];

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  emoji: string;
  swatches: [string, string, string, string];
  light: ThemeModeColors;
  dark: ThemeModeColors;
  /** Optional category badge (e.g., "GX" for Opera GX inspired). */
  category?: 'classic' | 'gx';
  /**
   * Border-radius (em px) sugerido pelo skin. Quando definido, o helper
   * `applyThemePreset` aplica esse valor ao `--radius` global. Permite
   * que skins angulares (Opera GX = 4px) coexistam com skins arredondados.
   */
  borderRadius?: number;
  /**
   * Família de fonte (CSS font-family list) sugerida pelo skin. Quando
   * definida, é aplicada às variáveis globais `--font-sans` e
   * `--font-display`. Permite skins com tipografia distinta (ex.: skins
   * Opera GX usam Inter, igual ao dashboard do Cloudflare).
   */
  font?: string;
}

export interface ThemeConfig {
  presetId: string;
  radius: number;
  mode: 'light' | 'dark';
}

// =====================================================
// BUILD PRESET FACTORY — generates ALL 80+ CSS vars
// =====================================================

interface PresetParams {
  id: string;
  name: string;
  description: string;
  emoji: string;
  h: number; // Primary hue
  s: number; // Primary saturation
  l: number; // Primary lightness
  gh: number; // Glow hue
  sh: number; // Secondary hue
  ss: number; // Secondary saturation
  sl: number; // Secondary lightness
}

function buildPreset(p: PresetParams): ThemePreset {
  const { id, name, description, emoji, h, s, l, gh, sh, ss, sl } = p;

  const primary = `${h} ${s}% ${l}%`;
  const primaryHover = `${h} ${s}% ${Math.max(l - 5, 5)}%`;
  const primaryActive = `${h} ${s}% ${Math.max(l - 10, 5)}%`;
  const primaryGlow = `${gh} ${s}% ${Math.min(l + 10, 95)}%`;
  const secondary = `${sh} ${ss}% ${sl}%`;

  // Success color stays green-ish but tinted towards the skin's hue
  const successH = 142;
  const successS = 71;
  const successL = 45;

  // Warning stays amber-ish
  const warningH = 38;
  const warningS = 92;
  const warningL = 50;

  const light: ThemeModeColors = {
    background: `${h} 20% 97%`,
    foreground: '222 25% 10%',
    card: '0 0% 100%',
    'card-foreground': '222 25% 10%',
    'card-elevated': '0 0% 100%',
    popover: '0 0% 100%',
    'popover-foreground': '222 25% 10%',
    primary,
    'primary-foreground': '0 0% 100%',
    'primary-hover': primaryHover,
    'primary-active': primaryActive,
    'primary-glow': primaryGlow,
    secondary: `${h} 14% 92%`,
    'secondary-foreground': '222 25% 18%',
    muted: `${h} 14% 90%`,
    'muted-foreground': `${h} 12% 46%`,
    accent: `${h} 14% 92%`,
    'accent-foreground': '222 25% 13%',
    border: `${h} 14% 86%`,
    input: `${h} 14% 90%`,
    ring: primary,
    surface: `${h} 14% 98%`,
    'surface-hover': `${h} 14% 95%`,
    'text-secondary': `${h} 12% 42%`,
    interactive: primary,
    divider: `${h} 14% 86%`,
    'sidebar-background': `${h} 14% 98%`,
    'sidebar-foreground': '222 25% 10%',
    'sidebar-primary': primary,
    'sidebar-primary-foreground': '0 0% 100%',
    'sidebar-accent': `${h} 14% 93%`,
    'sidebar-accent-foreground': '222 25% 13%',
    'sidebar-border': `${h} 14% 90%`,
    'sidebar-ring': primary,
    elevated: '0 0% 100%',
    'elevated-hover': `${h} 14% 97%`,
    // Glass
    'glass-bg': '0 0% 100% / 0.8',
    'glass-bg-strong': '0 0% 100% / 0.9',
    'glass-bg-subtle': '0 0% 100% / 0.6',
    'glass-border': `${h} 14% 86% / 0.4`,
    'glass-border-strong': `${h} 14% 86% / 0.6`,
    'glass-shadow': `0 4px 30px hsl(222 25% 10% / 0.06)`,
    // Gradients
    'gradient-primary': `linear-gradient(135deg, hsl(${primary}), hsl(${primaryGlow}))`,
    'gradient-secondary': `linear-gradient(135deg, hsl(${secondary}), hsl(${sh} ${ss}% ${Math.min(sl + 10, 95)}%))`,
    'gradient-success': `linear-gradient(135deg, hsl(${successH} ${successS}% ${successL}%), hsl(${successH + 10} ${successS}% ${successL + 10}%))`,
    'gradient-surface': `linear-gradient(180deg, hsl(0 0% 100%), hsl(${h} 14% 96%))`,
    'gradient-divider': `linear-gradient(90deg, transparent, hsl(${h} 14% 86% / 0.5), transparent)`,
    'gradient-hero': `linear-gradient(135deg, hsl(${primary} / 0.08) 0%, hsl(${primaryGlow} / 0.04) 100%)`,
    'gradient-novelty': `linear-gradient(135deg, hsl(${successH} ${successS}% ${successL}%), hsl(${successH + 10} 76% 40%))`,
    // Shadows
    'shadow-glow': `0 0 20px hsl(${primary} / 0.2)`,
    'shadow-glow-primary': `0 0 20px hsl(${primary} / 0.2)`,
    'shadow-glow-secondary': `0 0 20px hsl(${secondary} / 0.3)`,
    'shadow-glow-success': `0 0 20px hsl(${successH} ${successS}% ${successL}% / 0.2)`,
    'shadow-glow-warning': `0 0 20px hsl(${warningH} ${warningS}% ${warningL}% / 0.25)`,
    'shadow-lg': `0 10px 15px -3px hsl(222 25% 10% / 0.08), 0 4px 6px -4px hsl(222 25% 10% / 0.05)`,
    'shadow-xl': `0 20px 25px -5px hsl(222 25% 10% / 0.1), 0 8px 10px -6px hsl(222 25% 10% / 0.06)`,
    'shadow-header': `0 1px 3px hsl(222 25% 10% / 0.06), 0 1px 2px hsl(222 25% 10% / 0.04)`,
    'chart-1': primary,
    // Orange — Promo Gifts brand orange (BUG-04 fix)
    orange: '25 95% 53%',
    'orange-hover': '25 95% 48%',
    'orange-active': '25 95% 43%',
    'orange-glow': `0 0 20px hsl(25 95% 53% / 0.3)`,
    'orange-foreground': '0 0% 100%',
  };

  const dark: ThemeModeColors = {
    background: '240 6% 6%',
    foreground: '210 40% 98%',
    card: '240 5% 10%',
    'card-foreground': '210 40% 98%',
    'card-elevated': '240 5% 13%',
    popover: '240 5% 10%',
    'popover-foreground': '210 40% 98%',
    primary,
    'primary-foreground': '0 0% 100%',
    'primary-hover': primaryHover,
    'primary-active': primaryActive,
    'primary-glow': primaryGlow,
    secondary: '240 5% 16%',
    'secondary-foreground': '210 40% 92%',
    muted: '240 4% 18%',
    'muted-foreground': '215 20% 75%',
    accent: '240 5% 16%',
    'accent-foreground': '210 40% 98%',
    border: '240 4% 18%',
    input: '240 5% 14%',
    ring: primary,
    surface: '240 5% 9%',
    'surface-hover': '240 5% 12%',
    'text-secondary': '215 20% 72%',
    interactive: primary,
    divider: '240 4% 20%',
    'sidebar-background': '240 6% 5%',
    'sidebar-foreground': '210 40% 98%',
    'sidebar-primary': primary,
    'sidebar-primary-foreground': '0 0% 100%',
    'sidebar-accent': '240 5% 12%',
    'sidebar-accent-foreground': '210 40% 98%',
    'sidebar-border': '240 4% 14%',
    'sidebar-ring': primary,
    elevated: '240 5% 12%',
    'elevated-hover': '240 5% 15%',
    // Glass — dark mode with primary tint
    'glass-bg': '240 6% 8% / 0.85',
    'glass-bg-strong': '240 8% 6% / 0.92',
    'glass-bg-subtle': '240 5% 10% / 0.65',
    'glass-border': `${h} 30% 30% / 0.15`,
    'glass-border-strong': `${h} 40% 35% / 0.25`,
    'glass-shadow': `0 4px 30px hsl(225 20% 2% / 0.4), 0 0 40px hsl(${primary} / 0.03)`,
    // Gradients — all tinted with primary
    'gradient-primary': `linear-gradient(135deg, hsl(${primary}), hsl(${primaryGlow}))`,
    'gradient-secondary': `linear-gradient(135deg, hsl(${secondary}), hsl(${sh} ${ss}% ${Math.min(sl + 10, 95)}%))`,
    'gradient-success': `linear-gradient(135deg, hsl(${successH} 76% 48%), hsl(${successH + 10} 80% 42%))`,
    'gradient-surface': `linear-gradient(180deg, hsl(240 5% 10%), hsl(240 6% 6%))`,
    'gradient-divider': `linear-gradient(90deg, transparent, hsl(${h} 50% 40% / 0.15), transparent)`,
    'gradient-hero': `linear-gradient(135deg, hsl(${primary} / 0.12) 0%, hsl(${gh} 60% 50% / 0.06) 50%, hsl(${primary} / 0.08) 100%)`,
    'gradient-novelty': `linear-gradient(135deg, hsl(${successH} 76% 48%), hsl(${successH + 10} 80% 42%))`,
    // Shadows — dramatic glow with primary color
    'shadow-glow': `0 0 30px hsl(${primary} / 0.4), 0 0 60px hsl(${primary} / 0.15)`,
    'shadow-glow-primary': `0 0 30px hsl(${primary} / 0.4), 0 0 60px hsl(${primary} / 0.15)`,
    'shadow-glow-secondary': `0 0 25px hsl(${secondary} / 0.5)`,
    'shadow-glow-success': `0 0 25px hsl(${successH} 76% 48% / 0.35)`,
    'shadow-glow-warning': `0 0 25px hsl(${warningH} 95% 52% / 0.4)`,
    'shadow-lg': `0 10px 15px -3px hsl(225 20% 2% / 0.7), 0 4px 6px -4px hsl(225 20% 2% / 0.5), 0 0 20px hsl(${primary} / 0.04)`,
    'shadow-xl': `0 20px 25px -5px hsl(225 20% 2% / 0.8), 0 8px 10px -6px hsl(225 20% 2% / 0.6), 0 0 30px hsl(${primary} / 0.06)`,
    'shadow-header': `0 1px 3px hsl(225 20% 2% / 0.7), 0 0 20px hsl(${primary} / 0.03), inset 0 1px 0 hsl(225 15% 18% / 0.3)`,
    'chart-1': primary,
    // Orange — Promo Gifts brand orange (BUG-04 fix)
    orange: '25 95% 53%',
    'orange-hover': '25 95% 48%',
    'orange-active': '25 95% 43%',
    'orange-glow': `0 0 30px hsl(25 95% 53% / 0.45)`,
    'orange-foreground': '0 0% 100%',
  };

  return {
    id,
    name,
    description,
    emoji,
    swatches: [
      `hsl(${h} ${s}% ${l}%)`,
      `hsl(${sh} ${ss}% ${sl}%)`,
      `hsl(${gh} ${Math.max(s - 5, 0)}% ${Math.min(l + 6, 100)}%)`,
      `hsl(${h} ${Math.round(s * 0.5)}% ${Math.min(l + 15, 100)}%)`,
    ],
    light,
    dark,
  };
}

// =====================================================
// 10 PRESETS + DIVERSITY
// =====================================================

const diversityBase = buildPreset({
  id: 'diversity',
  name: 'Diversity',
  description: 'Pride 🏳️‍🌈 — celebrando a comunidade LGBTQIA+',
  emoji: '🏳️‍🌈',
  // Magenta/pink como hue base (cor mais "actionable" e visível)
  h: 330,
  s: 85,
  l: 55,
  gh: 290,
  sh: 130,
  ss: 70,
  sl: 45,
});

// ===== ARCO-ÍRIS — paleta oficial usada em todos os gradients e accents =====
// Cores escolhidas para combinar com a bandeira LGBTQIA+ moderna.
const PRIDE_RED = '0 85% 55%';
const PRIDE_ORANGE = '30 90% 55%';
const PRIDE_YELLOW = '55 90% 50%';
const PRIDE_GREEN = '130 70% 45%';
const PRIDE_BLUE = '210 80% 55%';
const PRIDE_PURPLE = '280 80% 58%';
const PRIDE_PINK = '330 85% 52%'; // Reduzido de 58% para 52% para contraste > 3:1 com branco

// Rainbow completo — reservado a MOMENTOS CERIMONIAIS (logo, novidade, divider).
const rainbowGrad = `linear-gradient(135deg, hsl(${PRIDE_RED}), hsl(${PRIDE_ORANGE}), hsl(${PRIDE_YELLOW}), hsl(${PRIDE_GREEN}), hsl(${PRIDE_BLUE}), hsl(${PRIDE_PURPLE}))`;
const rainbowDivider = `linear-gradient(90deg, hsl(${PRIDE_RED} / 0.5), hsl(${PRIDE_YELLOW} / 0.5), hsl(${PRIDE_GREEN} / 0.5), hsl(${PRIDE_BLUE} / 0.5), hsl(${PRIDE_PURPLE} / 0.5))`;

const diversityPreset: ThemePreset = {
  ...diversityBase,
  swatches: [
    `hsl(${PRIDE_RED})`,
    `hsl(${PRIDE_YELLOW})`,
    `hsl(${PRIDE_GREEN})`,
    `hsl(${PRIDE_PURPLE})`,
  ],
  light: {
    ...diversityBase.light,
    // === SLOTS SEMÂNTICOS DISTRIBUÍDOS PELO ARCO-ÍRIS ===
    // Primary = magenta (cor principal de ação, mais visível)
    primary: PRIDE_PINK,
    'primary-foreground': '0 0% 100%',
    'primary-hover': '330 85% 50%',
    'primary-active': '330 85% 45%',
    'primary-glow': '290 85% 60%',
    // Secondary = verde pride (botões secundários)
    secondary: PRIDE_GREEN,
    'secondary-foreground': '0 0% 100%',
    // Accent = amarelo pride sobre superfície clara (ajustado para legibilidade)
    accent: '55 100% 94%',
    'accent-foreground': '20 80% 25%',
    // Anel de foco e elementos interativos
    ring: PRIDE_PINK,
    interactive: PRIDE_PINK,
    // Sidebar com identidade pink + accent violeta suave
    'sidebar-primary': PRIDE_PINK,
    'sidebar-primary-foreground': '0 0% 100%',
    'sidebar-accent': '290 50% 96%',
    'sidebar-accent-foreground': '290 80% 35%',
    'sidebar-border': '330 40% 92%',
    'sidebar-ring': PRIDE_PINK,
    // === GRADIENTES — TODOS RAINBOW (identidade pride preservada) ===
    'gradient-primary': rainbowGrad,
    'gradient-secondary': rainbowGrad,
    'gradient-success': `linear-gradient(135deg, hsl(${PRIDE_GREEN}), hsl(${PRIDE_BLUE}))`,
    'gradient-novelty': rainbowGrad,
    'gradient-hero': `linear-gradient(135deg, hsl(${PRIDE_RED} / 0.08), hsl(${PRIDE_GREEN} / 0.06), hsl(${PRIDE_PURPLE} / 0.08))`,
    'gradient-divider': rainbowDivider,
    'gradient-surface': `linear-gradient(180deg, hsl(330 30% 98%), hsl(280 20% 96%))`,
    // === SOMBRAS GLOW — CADA UMA EM UMA COR DIFERENTE ===
    'shadow-glow': `0 0 24px hsl(${PRIDE_PINK} / 0.25)`,
    'shadow-glow-primary': `0 0 24px hsl(${PRIDE_PINK} / 0.3)`,
    'shadow-glow-secondary': `0 0 24px hsl(${PRIDE_GREEN} / 0.25)`,
    'shadow-glow-success': `0 0 24px hsl(${PRIDE_GREEN} / 0.3)`,
    'shadow-glow-warning': `0 0 24px hsl(${PRIDE_YELLOW} / 0.35)`,
    // Chart token (para indicadores)
    'chart-1': PRIDE_PINK,
    // Orange — pride orange (BUG-04 fix: overrides default Promo Gifts orange)
    orange: PRIDE_ORANGE,
    'orange-hover': '30 90% 50%',
    'orange-active': '30 90% 45%',
    'orange-glow': `0 0 24px hsl(${PRIDE_ORANGE} / 0.35)`,
    'orange-foreground': '0 0% 100%',
  },
  dark: {
    ...diversityBase.dark,
    // === SLOTS SEMÂNTICOS DISTRIBUÍDOS ===
    primary: '330 85% 60%',
    'primary-foreground': '0 0% 100%',
    'primary-hover': '330 85% 55%',
    'primary-active': '330 85% 50%',
    'primary-glow': '290 85% 65%',
    secondary: PRIDE_GREEN,
    'secondary-foreground': '0 0% 100%',
    accent: '280 50% 22%',
    'accent-foreground': '290 85% 78%',
    ring: '330 85% 60%',
    interactive: '330 85% 60%',
    'sidebar-primary': '330 85% 60%',
    'sidebar-primary-foreground': '0 0% 100%',
    'sidebar-accent': '280 50% 18%',
    'sidebar-accent-foreground': '290 85% 78%',
    'sidebar-border': '330 30% 18%',
    'sidebar-ring': '330 85% 60%',
    // === GRADIENTES — TODOS RAINBOW ===
    'gradient-primary': rainbowGrad,
    'gradient-secondary': rainbowGrad,
    'gradient-success': `linear-gradient(135deg, hsl(${PRIDE_GREEN}), hsl(${PRIDE_BLUE}))`,
    'gradient-novelty': rainbowGrad,
    'gradient-hero': `linear-gradient(135deg, hsl(${PRIDE_RED} / 0.14), hsl(${PRIDE_GREEN} / 0.08), hsl(${PRIDE_PURPLE} / 0.14))`,
    'gradient-divider': rainbowDivider,
    'gradient-surface': `linear-gradient(180deg, hsl(280 25% 9%), hsl(330 20% 6%))`,
    // === SOMBRAS GLOW NEON ===
    'shadow-glow': `0 0 30px hsl(330 85% 60% / 0.4), 0 0 60px hsl(${PRIDE_PURPLE} / 0.18)`,
    'shadow-glow-primary': `0 0 30px hsl(330 85% 60% / 0.4), 0 0 60px hsl(${PRIDE_PURPLE} / 0.18)`,
    'shadow-glow-secondary': `0 0 28px hsl(${PRIDE_GREEN} / 0.4)`,
    'shadow-glow-success': `0 0 28px hsl(${PRIDE_GREEN} / 0.4)`,
    'shadow-glow-warning': `0 0 28px hsl(${PRIDE_YELLOW} / 0.4)`,
    'chart-1': '330 85% 60%',
    // Orange — pride orange dark (BUG-04 fix)
    orange: PRIDE_ORANGE,
    'orange-hover': '30 90% 50%',
    'orange-active': '30 90% 45%',
    'orange-glow': `0 0 30px hsl(${PRIDE_ORANGE} / 0.5)`,
    'orange-foreground': '0 0% 100%',
  },
};

// =====================================================
// OPERA GX-INSPIRED PRESETS — Zapp Web canonical port
// =====================================================
//
// Implementação alinhada com `adm01-debug/zapp-web` para garantir
// padrão de cores entre os dois sistemas. Os 9 skins GX abaixo usam
// os mesmos hue/sat/light que o Zapp Web; a pipeline usa três helpers
// que reproduzem a "RGB feel" do Opera GX:
//   1. applyGxDarkSurfaces — fundo roxo escuro #251F33 (hue 265)
//   2. applyGxNeonGlow      — boost de alpha nas sombras coloridas
//   3. applyGxGlass         — glass translúcido tingido pela primária
//
// Diferenças deliberadas vs. Zapp Web:
//   • Tipografia: usamos Inter (família do Cloudflare Sans) em vez de
//     Rajdhani — mais profissional e adequado ao Promo Gifts B2B.
//   • Tokens extras do Promo Gifts (surface, divider, shadow-glow,
//     glass-bg-strong/subtle) recebem versões coerentes do tratamento
//     GX já que não existem no Zapp.

// Hex de referência: #251F33 (roxo escuro icônico do Opera GX).
// Aplicamos uma família de tons em torno desse hue (265) para dar
// identidade "GX" em todas as superfícies do dark mode.
function applyGxDarkSurfaces(preset: ThemePreset): ThemePreset {
  const d = preset.dark;
  // Fundo roxo escuro #251F33 (hue 265) - paridade canônica Zapp Web
  d.background = '265 22% 8%';
  d.card = '265 22% 12%';
  d['card-elevated'] = '265 18% 17%';
  d.popover = '265 22% 14%';
  d.muted = '265 18% 17%';
  d.input = '265 18% 17%';
  d.border = '265 18% 22%';
  d.secondary = '265 18% 17%';
  d.accent = '265 18% 17%';

  // Tokens específicos mantendo a coesão visual e legibilidade
  d.surface = '265 22% 10%';
  d['surface-hover'] = '265 18% 17%';
  d.divider = '265 18% 22%';
  d['sidebar-background'] = '265 24% 10%';
  d['sidebar-accent'] = '265 18% 17%';
  d['sidebar-border'] = '265 18% 20%';
  d.elevated = '265 18% 17%';
  d['elevated-hover'] = '265 18% 22%';
  d['gradient-surface'] = 'linear-gradient(180deg, hsl(265 22% 12%), hsl(265 24% 8%))';

  // Garantir contraste do foreground em superfícies GX
  d.foreground = '210 40% 98%';
  d['muted-foreground'] = '215 20% 75%';
  return preset;
}

// Substitui o alpha da última ocorrência hsl(... / X) de uma string
// `box-shadow`, preservando offset/blur/spread e a cor base. Trabalhar
// com a última ocorrência permite manter drop shadows neutros antes do
// glow colorido (caso comum nas sombras dark do Promo Gifts).
//   '0 0 30px hsl(347 96% 54% / 0.4)' → '0 0 30px hsl(347 96% 54% / 0.7)'
function boostGlowAlpha(shadow: string, alpha: number): string {
  const matches = shadow.match(/\/\s*[0-9.]+\s*\)/g);
  if (!matches || matches.length === 0) return shadow;
  const last = matches[matches.length - 1];
  const idx = shadow.lastIndexOf(last);
  return `${shadow.slice(0, idx)}/ ${alpha})${shadow.slice(idx + last.length)}`;
}

// Aplica o "neon glow" característico do Opera GX, aumentando a opacidade
// das sombras coloridas para um visual mais vibrante.
function applyGxNeonGlow(preset: ThemePreset): ThemePreset {
  const { light, dark } = preset;

  light['shadow-glow-primary'] = boostGlowAlpha(light['shadow-glow-primary'], 0.45);
  light['shadow-glow-secondary'] = boostGlowAlpha(light['shadow-glow-secondary'], 0.4);
  light['shadow-glow'] = boostGlowAlpha(light['shadow-glow'], 0.45);

  dark['shadow-glow-primary'] = boostGlowAlpha(dark['shadow-glow-primary'], 0.7);
  dark['shadow-glow-secondary'] = boostGlowAlpha(dark['shadow-glow-secondary'], 0.65);
  dark['shadow-glow'] = boostGlowAlpha(dark['shadow-glow'], 0.7);

  return preset;
}

// Reduz drasticamente a opacidade do glass-bg e tinge a glass-border
// com a cor primária do skin — efeito de painéis translúcidos do Opera GX.
function applyGxGlass(preset: ThemePreset, h: number, s: number, l: number): ThemePreset {
  preset.light['glass-bg'] = '0 0% 100% / 0.55';
  preset.light['glass-bg-strong'] = '0 0% 100% / 0.7';
  preset.light['glass-bg-subtle'] = '0 0% 100% / 0.4';
  preset.light['glass-border'] = `${h} ${s}% ${l}% / 0.35`;
  preset.light['glass-border-strong'] = `${h} ${s}% ${l}% / 0.55`;

  preset.dark['glass-bg'] = '265 22% 12% / 0.55';
  preset.dark['glass-bg-strong'] = '265 22% 10% / 0.75';
  preset.dark['glass-bg-subtle'] = '265 22% 14% / 0.4';
  preset.dark['glass-border'] = `${h} ${Math.min(100, s + 5)}% ${l}% / 0.5`;
  preset.dark['glass-border-strong'] = `${h} ${Math.min(100, s + 10)}% ${l}% / 0.65`;
  return preset;
}

// Implementação do factory para skins GX com tipografia Inter e cantos 10px.
function buildGxPreset(p: PresetParams): ThemePreset {
  const preset = applyGxGlass(applyGxNeonGlow(applyGxDarkSurfaces(buildPreset(p))), p.h, p.s, p.l);
  preset.category = 'gx';
  // Skins GX usam cantos um toque mais compactos que os clássicos para
  // manter identidade visual, mas suficientemente arredondados para o
  // visual friendly do Promo Gifts (em vez do 4px canon Opera GX).
  preset.borderRadius = 10;
  // Font override: Inter (família do Cloudflare Sans).
  preset.font = "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif";
  return preset;
}

// Para presets cuja cor primária é clara demais para texto branco (contraste
// WCAG < 3:1 em primary buttons), aplicamos texto escuro como foreground. É o
// mesmo padrão usado canonicamente em `gx-cyberpunk` (amarelo neon).
// Skins afetados: gx-rose-quartz, gx-hackerman, gx-frutti-di-mare, gx-razer.
// Contraste resultante: 6.18:1 a 9.59:1 (margem confortável vs threshold 3:1).
function withDarkPrimaryFg(preset: ThemePreset): ThemePreset {
  preset.light['primary-foreground'] = '222 25% 10%';
  preset.dark['primary-foreground'] = '222 25% 10%';
  // Sidebar primary também segue primary — para consistência visual completa
  // (badges/active states no sidebar usando primary background).
  preset.light['sidebar-primary-foreground'] = '222 25% 10%';
  preset.dark['sidebar-primary-foreground'] = '222 25% 10%';
  return preset;
}

export const THEME_PRESETS: ThemePreset[] = [
  // === CLASSIC PRESETS (mantidas) ===
  {
    ...buildPreset({
      id: 'corporate',
      name: 'Padrão',
      emoji: '💼',
      h: 221,
      s: 83,
      l: 53,
      gh: 230,
      sh: 215,
      ss: 70,
      sl: 55,
      description: 'Azul profissional',
    }),
    category: 'classic',
  },
  {
    ...buildPreset({
      id: 'purpure',
      name: 'Púrpure',
      emoji: '💜',
      h: 254,
      s: 92,
      l: 55, // Lightness reduzida de 62 para 55 para contraste WCAG com texto branco
      gh: 260,
      sh: 260,
      ss: 90,
      sl: 67,
      description: 'Roxo vibrante',
    }),
    category: 'classic',
  },
  {
    ...buildPreset({
      id: 'emerald',
      name: 'Esmeralda',
      emoji: '💎',
      h: 160,
      s: 84,
      l: 35, // Lightness reduzida de 45 para 35 para garantir contraste WCAG com texto branco
      gh: 170,
      sh: 145,
      ss: 70,
      sl: 50,
      description: 'Verde sofisticado',
    }),
    category: 'classic',
  },
  {
    ...buildPreset({
      id: 'sunset',
      name: 'Pôr do Sol',
      emoji: '🌅',
      h: 25,
      s: 95,
      l: 48, // Ajuste para 48 (era 53) para contraste 3:1 com texto branco
      gh: 35,
      sh: 15,
      ss: 80,
      sl: 50,
      description: 'Quente e acolhedor',
    }),
    category: 'classic',
  },
  {
    ...buildPreset({
      id: 'rose',
      name: 'Rosé',
      emoji: '🌸',
      h: 346,
      s: 77,
      l: 50,
      gh: 355,
      sh: 330,
      ss: 70,
      sl: 55,
      description: 'Elegante e moderno',
    }),
    category: 'classic',
  },
  {
    ...buildPreset({
      id: 'minimal',
      name: 'Minimal',
      emoji: '⚪',
      h: 220,
      s: 15,
      l: 50,
      gh: 220,
      sh: 220,
      ss: 10,
      sl: 45,
      description: 'Clean e neutro',
    }),
    category: 'classic',
  },
  {
    ...buildPreset({
      id: 'ocean',
      name: 'Oceano',
      emoji: '🌊',
      h: 200,
      s: 85,
      l: 48, // Ajuste para 48 (era 55) para contraste 3:1 com texto branco
      gh: 210,
      sh: 190,
      ss: 75,
      sl: 50,
      description: 'Azul profundo',
    }),
    category: 'classic',
  },
  {
    ...buildPreset({
      id: 'amber',
      name: 'Âmbar',
      emoji: '✨',
      h: 38,
      s: 92,
      l: 42, // Ajuste para 42 (era 50) para contraste com texto branco no Âmbar
      gh: 45,
      sh: 30,
      ss: 80,
      sl: 55,
      description: 'Dourado e premium',
    }),
    category: 'classic',
  },
  {
    ...buildPreset({
      id: 'cyber',
      name: 'Cyber',
      emoji: '🤖',
      h: 180,
      s: 100,
      l: 30, // Reduzido drasticamente para contraste 3:1 com texto branco
      gh: 300,
      sh: 320,
      ss: 100,
      sl: 60,
      description: 'Neon futurista',
    }),
    category: 'classic',
  },
  { ...diversityPreset, category: 'classic' },

  // === OPERA GX EDITION ===
  // Skins inspirados nos temas oficiais do navegador Opera GX.
  // HSL idênticos ao repo `adm01-debug/zapp-web` para padronização entre
  // os sistemas. Tipografia trocada para Inter (Cloudflare Sans family).
  buildGxPreset({
    id: 'gx-classic',
    name: 'GX Classic',
    emoji: '🦈',
    description: 'Vermelho neon assinatura do Opera GX',
    h: 347,
    s: 96,
    l: 54,
    gh: 340,
    sh: 280,
    ss: 60,
    sl: 40,
  }),
  buildGxPreset({
    id: 'gx-pink-addiction',
    name: 'Pink Addiction',
    emoji: '🍭',
    description: 'Rosa intenso e viciante',
    h: 330,
    s: 95,
    l: 60, // zapp parity (gx-pink-addiction)
    gh: 340,
    sh: 300,
    ss: 90,
    sl: 55,
  }),
  buildGxPreset({
    id: 'gx-purple-haze',
    name: 'Purple Haze',
    emoji: '🟣',
    description: 'Roxo profundo e psicodélico',
    h: 265,
    s: 65,
    l: 50,
    gh: 275,
    sh: 245,
    ss: 70,
    sl: 55,
  }),
  withDarkPrimaryFg(
    buildGxPreset({
      id: 'gx-rose-quartz',
      name: 'Rose Quartz',
      emoji: '💗',
      description: 'Rosa quartzo cristalino',
      h: 345,
      s: 75,
      l: 68, // zapp parity (gx-rose-quartz)
      gh: 355,
      sh: 320,
      ss: 60,
      sl: 70,
      // hsl(345 75% 68%) vs branco = 2.90:1 (abaixo de WCAG 3:1).
      // Texto escuro eleva o contraste para 6.18:1 mantendo a cor primária.
    }),
  ),
  buildGxPreset({
    id: 'gx-ultraviolet',
    name: 'Ultraviolet',
    emoji: '🔮',
    description: 'Violeta UV vibrante',
    h: 271,
    s: 76,
    l: 53,
    gh: 280,
    sh: 255,
    ss: 80,
    sl: 55,
  }),
  withDarkPrimaryFg(
    buildGxPreset({
      id: 'gx-hackerman',
      name: 'Hackerman',
      emoji: '👨‍💻',
      description: 'Verde Matrix de hacker',
      h: 127,
      s: 65,
      l: 46, // zapp parity (gx-hackerman)
      gh: 135,
      sh: 115,
      ss: 60,
      sl: 42,
      // hsl(127 65% 46%) vs branco = 2.38:1 (abaixo de WCAG 3:1).
      // Texto escuro eleva o contraste para 7.54:1.
    }),
  ),
  withDarkPrimaryFg(
    buildGxPreset({
      id: 'gx-frutti-di-mare',
      name: 'Frutti di Mare',
      emoji: '🐙',
      description: 'Azul-petróleo do fundo do mar',
      h: 182,
      s: 90,
      l: 42, // zapp parity (gx-frutti-di-mare)
      gh: 190,
      sh: 200,
      ss: 75,
      sl: 45,
      // hsl(182 90% 42%) vs branco = 2.13:1 (abaixo de WCAG 3:1).
      // Texto escuro eleva o contraste para 8.43:1.
    }),
  ),
  withDarkPrimaryFg(
    buildGxPreset({
      id: 'gx-cyberpunk',
      name: 'Cyberpunk',
      emoji: '⚡',
      description: 'Amarelo neon de Night City',
      h: 55,
      s: 100,
      l: 51,
      gh: 180,
      sh: 320,
      ss: 95,
      sl: 55,
      // hsl(55 100% 51%) vs branco = 1.07:1 — amarelo neon precisa texto escuro.
      // Contraste com texto escuro = 14.56:1 (excelente).
    }),
  ),
  withDarkPrimaryFg(
    buildGxPreset({
      id: 'gx-razer',
      name: 'Razer',
      emoji: '🐍',
      description: 'Verde RGB Razer Chroma',
      h: 113,
      s: 70,
      l: 51, // zapp parity (gx-razer)
      gh: 120,
      sh: 100,
      ss: 60,
      sl: 48,
      // hsl(113 70% 51%) vs branco = 1.87:1 (abaixo de WCAG 3:1).
      // Texto escuro eleva o contraste para 9.59:1.
    }),
  ),
];

// =====================================================
// STORAGE & APPLICATION
// =====================================================

const STORAGE_KEY = 'gifts-store-theme-config';

/** Valor padrão das variáveis de fonte do projeto (igual ao index.css). */
export const DEFAULT_FONT_SANS = "'Plus Jakarta Sans', system-ui, sans-serif";
export const DEFAULT_FONT_DISPLAY = "'Outfit', system-ui, sans-serif";

export function getDefaultConfig(): ThemeConfig {
  return { presetId: 'corporate', radius: 14, mode: 'dark' };
}

export function loadThemeConfig(): ThemeConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = { ...getDefaultConfig(), ...JSON.parse(stored) };
      // Support both light/dark if ever expanded, but default to dark for now
      parsed.mode = parsed.mode || 'dark';
      if (!THEME_PRESETS.find((p) => p.id === parsed.presetId)) {
        parsed.presetId = 'corporate';
      }
      return parsed;
    }
  } catch {
    // localStorage indisponível ou JSON inválido: usa defaults
  }
  return getDefaultConfig();
}

export function saveThemeConfig(config: ThemeConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/**
 * Aplica todos os tokens visuais de um preset:
 *   • CSS vars de cor (light ou dark)
 *   • --radius, se o preset definir borderRadius (ex.: GX = 4px)
 *   • --font-sans / --font-display, se o preset definir font (ex.: GX = Inter)
 * Quando o preset não define radius/font, restaura os defaults para que
 * voltar de uma skin GX para uma clássica desfaça os overrides.
 */
export function applyThemePreset(presetId: string, mode: 'light' | 'dark' = 'dark'): void {
  const actualMode = mode === 'light' ? 'light' : 'dark';
  const preset = THEME_PRESETS.find((p) => p.id === presetId);
  if (!preset) {
    if (import.meta.env.DEV) {
      console.warn(`[applyThemePreset] Preset '${presetId}' not found, falling back to corporate.`);
    }
    const fallback = THEME_PRESETS.find((p) => p.id === 'corporate');
    if (!fallback) return;

    const root = document.documentElement;
    root.classList.add('theme-transitioning');
    const colors = fallback[mode];
    CSS_VARS_TO_APPLY.forEach((key) => {
      const value = colors[key];
      if (value !== undefined) root.style.setProperty(`--${key}`, value);
    });
    setTimeout(() => root.classList.remove('theme-transitioning'), 500);
    return;
  }

  const root = document.documentElement;

  // Enable smooth transition for all elements
  root.classList.add('theme-transitioning');

  // Stamp the active preset id so components can react to specific skins
  // (e.g. AppLogo rainbow gradient for diversity skin).
  root.dataset.presetId = presetId;

  const colors = preset[actualMode];

  CSS_VARS_TO_APPLY.forEach((key) => {
    const value = colors[key];
    if (value !== undefined) {
      root.style.setProperty(`--${key}`, value);
    }
  });

  // Aplica a fonte definida no preset ou restaura para os valores padrão
  // (Plus Jakarta Sans + Outfit) garantindo consistência em todas as skins.
  if (preset.font) {
    root.style.setProperty('--font-sans', preset.font);
    root.style.setProperty('--font-display', preset.font);
  } else if (root.style.getPropertyValue('--font-sans') !== DEFAULT_FONT_SANS) {
    root.style.setProperty('--font-sans', DEFAULT_FONT_SANS);
    root.style.setProperty('--font-display', DEFAULT_FONT_DISPLAY);
  }

  // Per-preset radius override (Opera GX skins → 4px angular).
  // Quando definido, vence sobre o slider global do usuário enquanto a
  // skin estiver ativa.
  if (preset.borderRadius !== undefined) {
    root.style.setProperty('--radius', `${preset.borderRadius / 16}rem`);
  }

  // Remove transition class after animation completes
  setTimeout(() => root.classList.remove('theme-transitioning'), 500);
}

export function applyRadius(px: number): void {
  document.documentElement.style.setProperty('--radius', `${px / 16}rem`);
}

export function clearThemeOverrides(): void {
  const root = document.documentElement;
  CSS_VARS_TO_APPLY.forEach((key) => root.style.removeProperty(`--${key}`));
  root.style.removeProperty('--radius');
  root.style.removeProperty('--font-sans');
  root.style.removeProperty('--font-display');
}

export function exportThemeConfig(config: ThemeConfig): string {
  return JSON.stringify(config, null, 2);
}

export function importThemeConfig(json: string): ThemeConfig | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed.presetId && typeof parsed.radius === 'number') {
      // Backfill defaults para configs antigas sem mode (compat retroativa)
      return { ...getDefaultConfig(), ...parsed } as ThemeConfig;
    }
  } catch {
    // JSON inválido: import falha silenciosamente
  }
  return null;
}
