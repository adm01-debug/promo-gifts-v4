import { supabase } from '@/integrations/supabase/client';

export interface CnpjData {
  razao_social: string | null;
  nome_fantasia: string | null;
  cnpj: string;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  pais: string;
  cnae_principal: string | null;
  cnae_descricao: string | null;
  situacao_cadastral: string | null;
  data_abertura: string | null;
  natureza_juridica: string | null;
  porte: string | null;
  capital_social: number | null;
  email: string | null;
  telefone: string | null;
}

export async function fetchCnpjData(cnpj: string): Promise<CnpjData | null> {
  const { data, error } = await supabase.functions.invoke('cnpj-lookup', {
    body: { cnpj },
  });

  if (error) {
    console.error('[CNPJ-Lookup] Error:', error);
    throw new Error(error.message || 'Erro ao consultar CNPJ');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Erro na consulta do CNPJ');
  }

  return data.data as CnpjData;
}
