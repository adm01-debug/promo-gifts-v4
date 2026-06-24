/**
 * QuoteAutoSave - Constantes de strings de status
 * SSOT para textos exibidos pelo indicador de auto-save.
 * Importado pelo componente e pelos testes (unit + E2E).
 */

export type SaveStatus = 'error' | 'idle' | 'offline' | 'saved' | 'saving';

export const QUOTE_AUTOSAVE_STATUS_TEXT = {
  saving: 'Salvando...',
  savedNow: 'Salvo agora',
  /** Função para texto com minutos (ex: "Salvo há 3 min") */
  savedMinutesAgo: (mins: number) => `Salvo há ${mins} min`,
  /** Função para texto com hora (ex: "Salvo às 14:32") */
  savedAtTime: (time: string) => `Salvo às ${time}`,
  savedGeneric: 'Salvo',
  error: 'Erro ao salvar',
  offline: 'Offline',
  unsaved: 'Alterações não salvas',
  unsavedBadge: 'Não salvo',
  idle: '',
} as const;

/** String explicitamente proibida (regressão removida — ver mem://) */
export const FORBIDDEN_AUTOSAVE_TEXT = 'Salvo automaticamente';

/** aria-label do container do indicador (acessibilidade) */
export const QUOTE_AUTOSAVE_ARIA_LABEL = 'Status de salvamento do orçamento';
