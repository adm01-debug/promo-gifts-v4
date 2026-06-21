import { useState, useEffect, useCallback } from 'react';
import { Save, Palette, Sparkles, Check, Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { m as motion } from 'framer-motion';
import { useTheme } from '@/contexts/ThemeContext';
import { toast } from 'sonner';
import {
  THEME_PRESETS,
  type ThemeConfig,
  loadThemeConfig,
  saveThemeConfig,
  applyThemePreset,
  applyRadius,
  clearThemeOverrides,
  getDefaultConfig,
} from '@/lib/theme-presets';
import { PresetCard } from '@/components/settings/theme/PresetCard';
import { BorderRadiusControl } from '@/components/settings/theme/BorderRadiusControl';

import { ThemeResetDialog } from '@/components/settings/theme/ThemeResetDialog';
import { PageSEO } from '@/components/seo/PageSEO';

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.4, ease: 'easeOut' },
  }),
};

const classicPresets = THEME_PRESETS.filter((p) => p.category !== 'gx');
const gxPresets = THEME_PRESETS.filter((p) => p.category === 'gx');

export default function AdminTemasPage() {
  const { actualTheme: _actualTheme } = useTheme();
  const [config, setConfig] = useState<ThemeConfig>(loadThemeConfig);
  const [savedConfig, setSavedConfig] = useState<ThemeConfig>(loadThemeConfig);

  const hasUnsavedChanges = JSON.stringify(config) !== JSON.stringify(savedConfig);

  const applyAll = useCallback((cfg: ThemeConfig) => {
    applyThemePreset(cfg.presetId, 'dark');
    applyRadius(cfg.radius);
  }, []);

  useEffect(() => {
    applyAll(config);
  }, [config, applyAll]);

  const updateConfig = (partial: Partial<ThemeConfig>) => {
    let next = { ...config, ...partial };
    // Quando o usuário troca de preset, sincroniza o slider de raio de borda:
    // · GX preset (borderRadius definido) → snap para o valor angular do preset
    // · Saindo de GX para classic → restaura o raio padrão (não deixa 4px angular
    //   travado num skin clássico que não exige bordas retas)  [BUG-THEME-13]
    if (partial.presetId && partial.presetId !== config.presetId) {
      const nextPreset = THEME_PRESETS.find((p) => p.id === partial.presetId);
      const prevPreset = THEME_PRESETS.find((p) => p.id === config.presetId);
      if (nextPreset?.borderRadius !== undefined) {
        next = { ...next, radius: nextPreset.borderRadius };
      } else if (prevPreset?.borderRadius !== undefined) {
        next = { ...next, radius: getDefaultConfig().radius };
      }
    }
    setConfig(next);
    // Auto-save on every change for instant feedback.
    // Sync savedConfig only when save succeeds; if localStorage is unavailable
    // (private browsing / quota exceeded) hasUnsavedChanges will remain true
    // so the "Salvar" button stays active — the user can still try a manual save.
    // (BUG-THEME-04: pulsating red dot was shown even when data was already saved).
    const saved = saveThemeConfig(next);
    if (saved) setSavedConfig(next);
  };

  const handleSave = () => {
    const saved = saveThemeConfig(config);
    if (saved) {
      setSavedConfig(config);
      toast.success('Tema salvo com sucesso!', {
        description: `Skin "${THEME_PRESETS.find((p) => p.id === config.presetId)?.name}" aplicada.`,
      });
    } else {
      toast.error('Não foi possível salvar o tema', {
        description:
          'O armazenamento local está indisponível ou cheio. Tente em uma janela normal.',
      });
    }
  };

  const handleReset = () => {
    clearThemeOverrides();
    const def = getDefaultConfig();
    setConfig(def);
    const saved = saveThemeConfig(def);
    if (saved) {
      setSavedConfig(def);
      toast.success('Tema restaurado ao padrão');
    } else {
      toast.error('Não foi possível salvar o tema restaurado', {
        description:
          'O armazenamento local está indisponível. O padrão será perdido ao recarregar.',
      });
    }
  };

  return (
    <>
      <PageSEO
        title="Temas"
        description="Personalize a aparência visual da plataforma."
        path="/admin/temas"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        {/* Sticky compact header */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
          className="sticky top-[calc(var(--header-h,56px)+var(--breadcrumb-h,0px))] z-10 -mx-4 border-b border-border/40 bg-background/80 px-4 py-3 backdrop-blur-lg sm:-mx-6 sm:px-6"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Palette className="h-5 w-5 shrink-0 text-primary" />
              <h1
                data-testid="page-title-temas"
                className="truncate font-display text-xl font-bold text-foreground"
              >
                Skins
              </h1>
              {/* Badge da skin ativa */}
              <span className="hidden items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary sm:inline-flex">
                <Check className="h-3 w-3" />
                {THEME_PRESETS.find((p) => p.id === config.presetId)?.name || 'Padrão'}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" onClick={handleSave} className="relative gap-1.5">
                <Save className="h-3.5 w-3.5" /> Salvar
                {hasUnsavedChanges && (
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
                )}
              </Button>
              <ThemeResetDialog onConfirm={handleReset} />
            </div>
          </div>
        </motion.div>

        {/* Classic Presets Grid */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2}>
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-semibold text-foreground">Skins clássicas</h2>
            <span className="text-xs text-muted-foreground">({classicPresets.length})</span>
          </div>
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5"
            role="radiogroup"
            aria-label="Skins clássicas"
          >
            {classicPresets.map((preset, i) => (
              <motion.div
                key={preset.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={2.5 + i * 0.05}
              >
                <PresetCard
                  preset={preset}
                  isActive={config.presetId === preset.id}
                  onSelect={(id) => updateConfig({ presetId: id })}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Opera GX Presets Grid */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2.5}>
          <div className="mb-4 flex items-center gap-2">
            <Gamepad2 className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-semibold text-foreground">Skins Opera GX</h2>
            <span className="text-xs text-muted-foreground">({gxPresets.length})</span>
            <span className="ml-1 inline-flex items-center rounded-md border border-primary/30 bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
              Gamer
            </span>
          </div>
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5"
            role="radiogroup"
            aria-label="Skins Opera GX"
          >
            {gxPresets.map((preset, i) => (
              <motion.div
                key={preset.id}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                custom={3 + i * 0.05}
              >
                <PresetCard
                  preset={preset}
                  isActive={config.presetId === preset.id}
                  onSelect={(id) => updateConfig({ presetId: id })}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Border Radius */}
        <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3.5}>
          <BorderRadiusControl
            value={config.radius}
            onChange={(v) => updateConfig({ radius: v })}
          />
        </motion.div>
      </div>
    </>
  );
}
