import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';
import type { Json } from '@/integrations/supabase/types';

/**
 * Extrai com segurança um objeto de preferências do valor JSON do perfil.
 * `profile.preferences` é tipado como Json (pode ser primitivo, array ou null),
 * então só fazemos spread quando for um objeto puro — evita TS2698 em build e
 * a criação de chaves-lixo em runtime.
 */
const asPrefsObject = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/**
 * Define as configurações de visibilidade por tema (light/dark).
 */
interface ThemeSettings {
  light: boolean;
  dark: boolean;
}

interface BadgeVisibilityStore {
  /**
   * Mapa de path -> tema -> habilitado.
   * Exemplo: { "/produtos": { "light": true, "dark": false } }
   */
  routeSettings: Record<string, ThemeSettings>;

  /**
   * Estado legado para compatibilidade ou fallback global.
   */
  badgesEnabled: boolean;

  /**
   * Indica se a última sincronização com o backend falhou.
   */
  syncError: string | null;

  /**
   * Alterna a visibilidade para a rota e tema atuais.
   * Se um userId for fornecido, sincroniza com o backend.
   */
  toggleBadges: (path: string, theme: string, userId?: string) => Promise<boolean>;

  /**
   * Define explicitamente a visibilidade para uma rota/tema.
   */
  setBadgesEnabled: (
    path: string,
    theme: string,
    enabled: boolean,
    userId?: string,
  ) => Promise<boolean>;

  /**
   * Retorna se os badges devem estar visíveis para a rota e tema informados.
   */
  isBadgeEnabled: (path: string, theme: string) => boolean;

  /**
   * Inicializa o store a partir das preferências do perfil do usuário.
   */
  initializeFromProfile: (preferences: unknown) => void;
}

/**
 * Controla a visibilidade dos badges de status (Novidade, Promoção, Destaque, Kit)
 * com persistência por rota, por tema e sincronização com o backend.
 */
export const useBadgeVisibilityStore = create<BadgeVisibilityStore>()(
  persist(
    (set, get) => ({
      routeSettings: {},
      badgesEnabled: true,
      syncError: null,

      isBadgeEnabled: (path, theme) => {
        const settings = get().routeSettings[path];
        if (settings) {
          return theme === 'dark' ? settings.dark : settings.light;
        }
        return get().badgesEnabled;
      },

      toggleBadges: async (path, theme, userId) => {
        const currentSettings = get().routeSettings[path] || {
          light: get().badgesEnabled,
          dark: get().badgesEnabled,
        };

        const isDark = theme === 'dark';
        const nextEnabled = isDark ? !currentSettings.dark : !currentSettings.light;

        const nextSettings = {
          ...currentSettings,
          [isDark ? 'dark' : 'light']: nextEnabled,
        };

        const newRouteSettings = {
          ...get().routeSettings,
          [path]: nextSettings,
        };

        set({
          routeSettings: newRouteSettings,
          badgesEnabled: nextEnabled,
          syncError: null,
        });

        if (userId) {
          try {
            const supabase = await getSupabaseClient();
            // Primeiro busca as preferências atuais para evitar sobrescrever outros campos
            const { data: profile, error: fetchError } = await supabase
              .from('profiles')
              .select('preferences')
              .eq('user_id', userId)
              .maybeSingle();

            if (fetchError) throw fetchError;

            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                preferences: {
                  ...asPrefsObject(profile?.preferences),
                  badge_visibility: newRouteSettings,
                } as unknown as Json,
              })
              .eq('user_id', userId);

            if (updateError) throw updateError;
            return true;
          } catch (err) {
            console.error('[BadgeVisibilityStore] Sync failed:', err);
            set({
              syncError:
                'Erro ao sincronizar preferências com o servidor. As alterações foram salvas apenas localmente.',
            });
            return false;
          }
        }
        return true;
      },

      setBadgesEnabled: async (path, theme, enabled, userId) => {
        const currentSettings = get().routeSettings[path] || { light: true, dark: true };
        const isDark = theme === 'dark';

        const nextSettings = {
          ...currentSettings,
          [isDark ? 'dark' : 'light']: enabled,
        };

        const newRouteSettings = {
          ...get().routeSettings,
          [path]: nextSettings,
        };

        set({
          routeSettings: newRouteSettings,
          badgesEnabled: enabled,
          syncError: null,
        });

        if (userId) {
          try {
            const supabase = await getSupabaseClient();
            const { data: profile, error: fetchError } = await supabase
              .from('profiles')
              .select('preferences')
              .eq('user_id', userId)
              .maybeSingle();

            if (fetchError) throw fetchError;

            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                preferences: {
                  ...asPrefsObject(profile?.preferences),
                  badge_visibility: newRouteSettings,
                } as unknown as Json,
              })
              .eq('user_id', userId);

            if (updateError) throw updateError;
            return true;
          } catch (err) {
            console.error('[BadgeVisibilityStore] Sync failed:', err);
            set({ syncError: 'Erro ao salvar alterações no servidor.' });
            return false;
          }
        }
        return true;
      },

      initializeFromProfile: (preferences) => {
        if (
          preferences !== null &&
          typeof preferences === 'object' &&
          !Array.isArray(preferences) &&
          'badge_visibility' in (preferences as Record<string, unknown>)
        ) {
          const bv = (preferences as Record<string, unknown>).badge_visibility;
          if (bv !== null && typeof bv === 'object' && !Array.isArray(bv)) {
            const isValidEntry = (v: unknown): v is ThemeSettings =>
              v !== null &&
              typeof v === 'object' &&
              !Array.isArray(v) &&
              typeof (v as Record<string, unknown>).light === 'boolean' &&
              typeof (v as Record<string, unknown>).dark === 'boolean';
            const allValid = Object.values(bv as Record<string, unknown>).every(isValidEntry);
            if (!allValid) {
              console.warn('[BadgeVisibilityStore] Invalid badge_visibility structure, ignoring.');
              return;
            }
            set({
              routeSettings: bv as Record<string, ThemeSettings>,
              syncError: null,
            });
          }
        }
      },
    }),
    {
      name: 'badge-visibility-v2', // Versão 2 para evitar conflitos com o formato anterior
      partialize: (state) => ({
        routeSettings: state.routeSettings,
        badgesEnabled: state.badgesEnabled,
      }),
    },
  ),
);
