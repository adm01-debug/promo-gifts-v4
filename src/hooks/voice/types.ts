export interface VoiceAgentAction {
  action:
    | 'search'
    | 'filter'
    | 'navigate'
    | 'sort'
    | 'clear'
    | 'answer'
    | 'open_oracle'
    | 'open_cart';
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
      gender?: 'Unissex' | 'Masculino' | 'Feminino' | 'Infantil';
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

export type VoiceAgentPhase = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

export interface UseVoiceAgentOptions {
  onAction?: (action: VoiceAgentAction) => void;
  onError?: (error: string) => void;
}
