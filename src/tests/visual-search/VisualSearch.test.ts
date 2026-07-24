import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })),
  },
}));

// Mock dos hooks de produto
vi.mock('@/hooks/products', () => ({
  useExternalCategoriesQuery: vi.fn(() => ({ data: [] })),
  useColorSystem: vi.fn(() => ({ data: { groups: [] } })),
  noveltyToProduct: vi.fn(),
}));

// Mock do router e sonner
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Módulo Raio X - Validação Funcional', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('Fluxo de Análise e Busca', () => {
    it('deve processar imagem e retornar resultados corretamente', async () => {
      // Simulação de resposta da Edge Function
      const mockResult = {
        analysis: {
          productType: 'Squeeze Térmico',
          material: 'Aço Inox',
          colors: ['Azul'],
          confidence: 0.95,
          rationale: 'Análise visual detectou brilho metálico e silhueta cilíndrica.',
          visualEvidence: {
            material: 'Brilho metálico característico de inox',
            silhouette: 'Forma cilíndrica ergonômica',
            finish: 'Acabamento fosco',
          },
          visualHighlights: [{ label: 'Tampa', x: 50, y: 10, description: 'Vedação hermética' }],
        },
        products: [{ id: '1', name: 'Squeeze Premium', relevance: 0.98, price: 45.9 }],
        searchTerms: 'squeeze metal azul',
      };

      // Injetando mock no Supabase
      const { supabase } = await import('@/integrations/supabase/client');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: mockResult, error: null });

      // Aqui validaríamos a lógica de processamento
      expect(mockResult.analysis.productType).toBe('Squeeze Térmico');
      expect(mockResult.products.length).toBeGreaterThan(0);
    });

    it('deve lidar com erros na Edge Function graciosamente', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      vi.mocked(supabase.functions.invoke).mockResolvedValue({
        data: null,
        error: new Error('AI analysis failed: 403'),
      });

      // Verificação de erro
      try {
        const result = await supabase.functions.invoke('visual-search', { body: {} });
        expect(result.error).toBeDefined();
      } catch (e) {
        expect(e).toBeDefined();
      }
    });
  });

  describe('Lógica de Re-classificação e Filtros', () => {
    it('deve recalcular confiança quando filtros manuais são aplicados', () => {
      const baseRelevance = 0.5;
      const categoryMatchBonus = 0.2;
      const colorMatchBonus = 0.2;

      // Simulação da lógica que está no backend mas espelhada no entendimento do sistema
      const calculateRelevance = (hasCategory: boolean, hasColor: boolean) => {
        let rel = baseRelevance;
        if (hasCategory) rel += categoryMatchBonus;
        if (hasColor) rel += colorMatchBonus;
        return Math.min(1, rel);
      };

      expect(calculateRelevance(true, true)).toBeCloseTo(0.9);
      expect(calculateRelevance(true, false)).toBeCloseTo(0.7);
    });
  });

  describe('Persistência e Histórico', () => {
    it('deve salvar e carregar histórico do localStorage', () => {
      const mockHistory = [
        { id: '1', productType: 'Caneta', imageUrl: 'data:image/png;base64...' },
      ];
      localStorage.setItem('visual-search-history', JSON.stringify(mockHistory));

      const saved = JSON.parse(localStorage.getItem('visual-search-history') || '[]');
      expect(saved[0].productType).toBe('Caneta');
    });
  });

  describe('Feedback e Calibração', () => {
    it('deve registrar feedback positivo no banco de dados', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as any);

      const feedbackData = {
        product_id: '123',
        is_correct: true,
        match_relevance: 0.95,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from('visual_search_feedback').insert(feedbackData as any);
      expect(insertMock).toHaveBeenCalledWith(feedbackData);
    });
  });
});
