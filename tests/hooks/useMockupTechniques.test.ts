import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useFilteredTechniques } from '@/hooks/mockup/useMockupTechniques';
import { useQuery } from '@tanstack/react-query';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

describe('useFilteredTechniques', () => {
  const mockTechniques = [
    { id: '1', name: 'Laser', code: 'LAS' },
    { id: '2', name: 'Silk', code: 'SIL' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve retornar lista vazia enquanto customizationData é undefined (loading)', () => {
    (useQuery as any).mockReturnValue({ data: undefined });
    
    const { result } = renderHook(() => useFilteredTechniques(mockTechniques, { id: 'prod1' }));
    
    expect(result.current).toEqual([]);
  });

  it('deve retornar todas as técnicas se o produto tiver zero locations (fallthrough)', () => {
    (useQuery as any).mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'mockup-customization-options') {
        return { data: { locations: [] } };
      }
      return { data: new Map() };
    });
    
    const { result } = renderHook(() => useFilteredTechniques(mockTechniques, { id: 'prod1' }));
    
    expect(result.current.length).toBe(2);
    expect(result.current[0].name).toBe('Laser');
  });

  it('deve filtrar técnicas baseadas no customizationData', () => {
    (useQuery as any).mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === 'mockup-customization-options') {
        return { 
          data: { 
            locations: [
              {
                location_name: 'Frente',
                options: [
                  { technique_id: '1', tecnica_nome: 'Laser', efetiva_largura_max: 5, efetiva_altura_max: 5 }
                ]
              }
            ] 
          } 
        };
      }
      return { data: new Map() };
    });
    
    const { result } = renderHook(() => useFilteredTechniques(mockTechniques, { id: 'prod1' }));
    
    expect(result.current.length).toBe(1);
    expect(result.current[0].name).toBe('Laser');
  });
});
