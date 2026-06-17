/**
 * Tipos do CRM externo (pgxfvjmuubtbowutlide)
 * Fonte única de verdade para dados de clientes/empresas
 * Schema mapeado diretamente do banco externo real
 */

// ============================================
// EMPRESAS (companies)
// ============================================

export interface CrmCompany {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  title: string | null;
  cnpj: string | null;
  ramo_atividade: string | null;
  status: string;
  source: string | null;
  // Flags de tipo
  is_customer: boolean;
  is_supplier: boolean;
  is_carrier: boolean;
  is_matriz: boolean;
  // Endereço principal (na tabela companies)
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  pais: string | null;
  endereco: string | null;
  endereco_faturamento: string | null;
  // Documentos
  inscricao_estadual: string | null;
  inscricao_municipal: string | null;
  cnae_principal: string | null;
  cnae_descricao: string | null;
  // Social
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  logo_url: string | null;
  // Organização
  grupo_economico: string | null;
  grupo_economico_id: string | null;
  matriz_id: string | null;
  central_id: string | null;
  singular_id: string | null;
  tipo_cooperativa: string | null;
  employee_count: number | null;
  annual_revenue: number | null;
  financial_health: string | null;
  // Bitrix legacy
  bitrix_company_id: string | null;
  bitrix_created_at: string | null;
  bitrix_updated_at: string | null;
  // Deprecated fields (still in DB)
  _deprecated_email: string | null;
  _deprecated_phone: string | null;
  _deprecated_phone_secondary: string | null;
  // Arrays
  tags_array: string[];
  challenges: string[];
  competitors: string[];
  // Search
  search_vector: string | null;
  // Soft delete
  deleted_at: string | null;
  deleted_by: string | null;
  // Audit
  user_id: string | null;
  assigned_by_id: string | null;
  created_by_id: string | null;
  merge_notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Nome de exibição: title > nome_fantasia > razao_social */
export function getCompanyDisplayName(company: CrmCompany): string {
  return company.title || company.nome_fantasia || company.razao_social;
}

// ============================================
// CONTATOS (contacts) — tabela separada
// ============================================

export interface CrmContact {
  id: string;
  company_id: string | null;
  first_name: string;
  last_name: string | null;
  full_name: string | null;
  nome_tratamento: string | null;
  apelido: string | null;
  cargo: string | null;
  departamento: string | null;
  role: string | null;
  cpf: string | null;
  sexo: string | null;
  birthday: string | null;
  data_nascimento: string | null;
  linkedin: string | null;
  instagram: string | null;
  notes: string | null;
  source: string | null;
  sentiment: string | null;
  relationship_score: number;
  relationship_stage: string | null;
  behavior: Record<string, unknown> | null;
  hobbies: string[];
  interests_array: string[];
  tags_array: string[];
  // Bitrix legacy
  bitrix_contact_id: number | null;
  // Soft delete
  deleted_at: string | null;
  deleted_by: string | null;
  // Audit
  user_id: string | null;
  assigned_by_id: string | null;
  created_at: string;
  updated_at: string;
  // Deprecated
  _deprecated_email: string | null;
  _deprecated_phone: string | null;
  _deprecated_whatsapp: string | null;
  // Relations (quando carregados)
  emails?: CrmContactEmail[];
  phones?: CrmContactPhone[];
}

export interface CrmContactEmail {
  id: string;
  contact_id: string;
  email: string;
  email_normalizado: string | null;
  email_type: string;
  is_primary: boolean | null;
  is_verified: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface CrmContactPhone {
  id: string;
  contact_id: string;
  numero: string;
  numero_normalizado: string | null;
  numero_e164: string | null;
  phone_type: string;
  is_primary: boolean | null;
  is_whatsapp: boolean | null;
  is_verified: boolean | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// ENDEREÇOS (company_addresses)
// ============================================

export interface CrmAddress {
  id: string;
  company_id: string;
  tipo: string | null;
  is_primary: boolean | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  pais: string | null;
  google_maps_url: string | null;
  google_place_id: string | null;
  latitude: number | null;
  longitude: number | null;
  horario_funcionamento: string | null;
  instrucoes_entrega: string | null;
  ponto_referencia: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// REDES SOCIAIS (company_social_media)
// ============================================

export type SocialPlatform =
  | 'instagram'
  | 'linkedin'
  | 'facebook'
  | 'twitter'
  | 'youtube'
  | 'tiktok'
  | 'whatsapp'
  | 'telegram'
  | 'outro';

export interface CrmSocialMedia {
  id: string;
  company_id: string;
  plataforma: SocialPlatform;
  handle: string | null;
  url: string | null;
  nome_perfil: string | null;
  is_verified: boolean | null;
  is_active: boolean;
  seguidores: number | null;
  data_ultima_verificacao: string | null;
  observacoes: string | null;
  origem: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// CUSTOMERS (customers) — dados específicos de cliente
// ============================================

export interface CrmCustomer {
  id: string;
  company_id: string;
  cliente_ativado: boolean;
  data_ativacao: string | null;
  data_primeira_ativacao: string | null;
  data_inativacao: string | null;
  motivo_inativacao: string | null;
  data_primeira_compra: string | null;
  data_ultima_compra: string | null;
  ja_comprou: boolean;
  total_pedidos: number;
  valor_total_compras: number;
  ticket_medio: number | null;
  poder_compra: string | null;
  ramo_atividade: string | null;
  perfil_preco: string | null;
  perfil_prazo: string | null;
  perfil_qualidade: string | null;
  grupo_clientes: string | null;
  tipo_cooperativa: string | null;
  vendedor_id: number | null;
  vendedor_nome: string | null;
  sdr_id: string | null;
  sdr_nome: string | null;
  sobre: string | null;
  observacoes: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// SUPPLIERS (suppliers) — dados específicos de fornecedor
// ============================================

export interface CrmSupplier {
  id: string;
  company_id: string;
  tipo_fornecedor: string | null;
  categoria: string | null;
  produtos: string | null;
  servicos: string | null;
  forma_pagamento: string | null;
  prazo_pagamento: string | null;
  prazo_entrega_medio: string | null;
  pedido_minimo: number | null;
  tem_integracao: boolean;
  api_url: string | null;
  grupo_economico: string | null;
  ramo_atividade: string | null;
  perfil_preco: string | null;
  perfil_prazo: string | null;
  perfil_qualidade: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// CARRIERS (carriers) — dados específicos de transportadora
// ============================================

export interface CrmCarrier {
  id: string;
  company_id: string;
  tipo_transporte: string | null;
  tipo_frete: string | null;
  estados_atendidos: string | null;
  cidades_atendidas: string | null;
  tabela_frete: string | null;
  prazo_por_trecho: string | null;
  transportadora_validada: boolean;
  data_validacao: string | null;
  ultimo_transporte: string | null;
  grupo_economico: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// FILTROS DE BUSCA
// ============================================

export interface CrmCompanyFilters {
  search?: string;
  ramo_atividade?: string;
  status?: string;
  cidade?: string;
  estado?: string;
  is_customer?: boolean;
  is_supplier?: boolean;
  is_carrier?: boolean;
}

// ============================================
// ADAPTADOR DE COMPATIBILIDADE
// Mapeia CrmCompany → formato antigo BitrixClient
// para facilitar a migração gradual
// ============================================

export interface LegacyClientFormat {
  id: string;
  bitrix_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  ramo: string | null;
  nicho: string | null;
  primary_color_name: string | null;
  primary_color_hex: string | null;
  logo_url: string | null;
  total_spent: number | null;
  last_purchase_date: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

/** Converte CrmCompany para o formato legado BitrixClient */
export function toLegacyClient(
  company: CrmCompany,
  customer?: CrmCustomer | null,
): LegacyClientFormat {
  const address = [
    company.logradouro,
    company.numero,
    company.bairro,
    company.cidade,
    company.estado,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    id: company.id,
    bitrix_id: company.bitrix_company_id ?? '',
    name: getCompanyDisplayName(company),
    email: company._deprecated_email || null,
    phone: company._deprecated_phone || null,
    address: address || company.endereco || null,
    ramo: company.ramo_atividade,
    nicho: null,
    primary_color_name: null,
    primary_color_hex: null,
    logo_url: company.logo_url,
    total_spent: customer?.valor_total_compras ?? null,
    last_purchase_date: customer?.data_ultima_compra ?? null,
    synced_at: company.updated_at,
    created_at: company.created_at,
    updated_at: company.updated_at,
  };
}
