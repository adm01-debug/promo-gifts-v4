import { useEffect, useMemo } from 'react';
import { useExternalSuppliers, type ExternalSupplier } from './useExternalDatabase';

export interface SupplierOption {
  id: string;
  name: string;
  code?: string;
  leadTimeDays?: number;
  isActive?: boolean;
  defaultMarkupPercent?: number | null;
}

/**
 * Hook para buscar fornecedores do banco externo
 * Substitui o uso de SUPPLIERS do mockData
 */
export function useSuppliers() {
  const { data, isLoading, error, fetchAll, refetch } = useExternalSuppliers();

  // Buscar fornecedores ao montar
  useEffect(() => {
    fetchAll({ 
      orderBy: { column: 'name', ascending: true },
      limit: 100 
    });
  }, []);

  // Transformar dados para o formato usado pelos componentes
  const suppliers = useMemo((): SupplierOption[] => {
    if (!data?.length) return [];
    
    return data.map((supplier: ExternalSupplier) => ({
      id: supplier.id,
      name: supplier.name,
      code: supplier.code,
      leadTimeDays: supplier.lead_time_days,
      isActive: supplier.is_active ?? true,
      defaultMarkupPercent: supplier.default_markup_percent ?? null,
    }));
  }, [data]);

  return {
    suppliers,
    isLoading,
    error,
    refetch,
  };
}
