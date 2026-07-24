export interface VoiceAgentAction {
  action:
    | 'answer'
    | 'clear'
    | 'filter'
    | 'navigate'
    | 'open_cart'
    | 'open_oracle'
    | 'search'
    | 'sort';
  response: string;
  data?: {
    query?: string;
    route?: string;
    sortBy?: string;
    oracleMessage?: string;
    filters?: {
      category?: string;
      color?: string;
      material?: string;
      maxPrice?: number;
      minPrice?: number;
      inStock?: boolean;
      isKit?: boolean;
      // FIX-5: campos adicionais mapeados para FilterState
      gender?: 'Feminino' | 'Infantil' | 'Masculino' | 'Unissex';
      featured?: boolean;
      isNew?: boolean;
      hasPersonalization?: boolean;
      onSale?: boolean;
      minStock?: number;
      publicoAlvo?: string;
      endomarketing?: boolean;
    };
  };
}

export type VoiceAgentPhase = 'error' | 'idle' | 'listening' | 'processing' | 'speaking';

export interface UseVoiceAgentOptions {
  onAction?: (action: VoiceAgentAction) => void;
  onError?: (error: string) => void;
}
