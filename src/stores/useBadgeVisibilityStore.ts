import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getSupabaseClient } from '@/integrations/supabase/lazy-client';

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
   * Alterna a visibilidade para a rota e tema atuais.
   * Se um userId for fornecido, sincroniza com o backend.
   */
  toggleBadges: (path: string, theme: string, userId?: string) => Promise<void>;
  
  /**
   * Define explicitamente a visibilidade para uma rota/tema.
   */
  setBadgesEnabled: (path: string, theme: string, enabled: boolean, userId?: string) => Promise<void>;
  
  /**
   * Retorna se os badges devem estar visíveis para a rota e tema informados.
   */
  isBadgeEnabled: (path: string, theme: string) => boolean;
  
  /**
   * Inicializa o store a partir das preferências do perfil do usuário.
   */
  initializeFromProfile: (preferences: any) => void;
}

/**
 * Controla a visibilidade dos badges de status (Novidade, Promoção, Destaque, Kit)
 * com persistência por rota, por tema e sincronização com o backend.
 */
export const useBadgeVisibilityStore = create<BadgeVisibilityStore>()(
  persist(
    (set, get) => ({
      routeSettings: {},
      badgesEnabled: true, // Mantido para compatibilidade inicial

      isBadgeEnabled: (path, theme) => {
        const settings = get().routeSettings[path];
        if (settings) {
          return theme === 'dark' ? settings.dark : settings.light;
        }
        // Se não houver configuração específica para a rota, usa o estado global legado
        return get().badgesEnabled;
      },

      toggleBadges: async (path, theme, userId) => {
        const currentSettings = get().routeSettings[path] || { 
          light: get().badgesEnabled, 
          dark: get().badgesEnabled 
        };
        
        const isDark = theme === 'dark';
        const nextEnabled = isDark ? !currentSettings.dark : !currentSettings.light;
        
        const nextSettings = {
          ...currentSettings,
          [isDark ? 'dark' : 'light']: nextEnabled
        };

        const newRouteSettings = {
          ...get().routeSettings,
          [path]: nextSettings
        };

        set({ 
          routeSettings: newRouteSettings,
          // Sincroniza o estado global com a última alteração para manter consistência em rotas não configuradas
          badgesEnabled: nextEnabled 
        });

        if (userId) {
          try {
            const supabase = await getSupabaseClient();
            const { error } = await supabase
              .from('profiles')
              .update({ 
                preferences: { 
                  ...((await supabase.from('profiles').select('preferences').eq('user_id', userId).single()).data?.preferences || {}),
                  badge_visibility: newRouteSettings
                } 
              })
              .eq('user_id', userId);

            if (error) console.error('[BadgeVisibilityStore] Error syncing with backend:', error);
          } catch (err) {
            console.error('[BadgeVisibilityStore] Sync failed:', err);
          }
        }
      },

      setBadgesEnabled: async (path, theme, enabled, userId) => {
        const currentSettings = get().routeSettings[path] || { light: true, dark: true };
        const isDark = theme === 'dark';
        
        const nextSettings = {
          ...currentSettings,
          [isDark ? 'dark' : 'light']: enabled
        };

        const newRouteSettings = {
          ...get().routeSettings,
          [path]: nextSettings
        };

        set({ routeSettings: newRouteSettings, badgesEnabled: enabled });

        if (userId) {
          try {
            const supabase = await getSupabaseClient();
            const { error } = await supabase
              .from('profiles')
              .update({ 
                preferences: { 
                  ...((await supabase.from('profiles').select('preferences').eq('user_id', userId).single()).data?.preferences || {}),
                  badge_visibility: newRouteSettings
                } 
              })
              .eq('user_id', userId);
            
            if (error) console.error('[BadgeVisibilityStore] Error syncing with backend:', error);
          } catch (err) {
            console.error('[BadgeVisibilityStore] Sync failed:', err);
          }
        }
      },

      initializeFromProfile: (preferences) => {
        if (preferences?.badge_visibility) {
          set({ routeSettings: preferences.badge_visibility });
        }
      },
    }),
    { 
      name: 'badge-visibility-v2', // Versão 2 para evitar conflitos com o formato anterior
      partialize: (state) => ({ 
        routeSettings: state.routeSettings,
        badgesEnabled: state.badgesEnabled 
      }),
    },
  ),
);
