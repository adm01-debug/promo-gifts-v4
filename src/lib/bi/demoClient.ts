/**
 * Cliente fictício para "Modo Demo" do BI.
 * Permite visualizar todas as 6 zonas com dados mockados, sem depender do CRM real.
 */
export const DEMO_CLIENT_ID = 'demo-client-bi-preview';

export const DEMO_COMPANY = {
  id: DEMO_CLIENT_ID,
  nome_fantasia: 'Acme Brindes Corporativos (Demo)',
  razao_social: 'Acme Indústria e Comércio LTDA',
  cnpj: '12.345.678/0001-90',
  ramo_atividade: 'Tecnologia',
  cidade: 'São Paulo',
  estado: 'SP',
  is_customer: true,
  deleted_at: null,
} as const;

export function isDemoClient(id?: string | null): boolean {
  return id === DEMO_CLIENT_ID;
}
