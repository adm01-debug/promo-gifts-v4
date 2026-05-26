export interface SupplierContact {
  id: string;
  role: string;
  name: string;
  signature: string;
  nickname: string;
  email: string;
  phone: string;
}

export interface Supplier {
  id: string;
  name: string;
  code: string;
  trading_name: string | null;
  cnpj: string | null;
  active: boolean;
  organization_id: string | null;
  contact_name: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  phone2: string | null;
  address: string | null;
  website: string | null;
  default_markup_percent: number | null;
  min_order_value: number | null;
  minimum_order_value: number | null;
  delivery_time_days: number | null;
  payment_terms: string | null;
  shipping_terms: string | null;
  priority: number | null;
  notes: string | null;
  is_product_supplier: boolean;
  is_engraving_supplier: boolean;
  logo_url: string | null;
  contacts: string | null;
  inscricao_estadual: string | null;
  tax_regime: string | null;
  state_uf: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  youtube: string | null;
  tiktok: string | null;
  // Endereço estruturado
  tipo_logradouro: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  pais: string | null;
  ponto_referencia: string | null;
  google_maps_url: string | null;
  google_place_id: string | null;
  latitude: number | null;
  longitude: number | null;
  horario_funcionamento: string | null;
  instrucoes_entrega: string | null;
  created_at: string;
  updated_at: string;
  // Dynamic fields from JSON parsing
  address_details?: string;
  social_details?: string;
}

export interface PixKey {
  id: string;
  tipo: string;
  chave: string;
  favorecido: string;
  principal: boolean;
}

export const CONTACT_ROLES = [
  'Proprietário',
  'Diretor',
  'Gerente',
  'Vendedor',
  'Financeiro',
  'Compras',
  'Logística',
  'Suporte',
  'Outro',
] as const;

export const EMPTY_SUPPLIER: Partial<Supplier> = {
  name: '',
  code: '',
  trading_name: '',
  cnpj: '',
  contact_name: '',
  contact_person: '',
  email: '',
  phone: '',
  phone2: '',
  address: '',
  website: '',
  default_markup_percent: null,
  min_order_value: null,
  delivery_time_days: null,
  payment_terms: '',
  shipping_terms: '',
  priority: 50,
  notes: '',
  is_product_supplier: true,
  is_engraving_supplier: false,
  active: true,
  logo_url: null,
  inscricao_estadual: '',
  tax_regime: '',
  state_uf: '',
  tipo_logradouro: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',
  pais: 'Brasil',
  ponto_referencia: '',
  google_maps_url: '',
  google_place_id: '',
  latitude: null,
  longitude: null,
  horario_funcionamento: '',
  instrucoes_entrega: '',
};

export const ORGANIZATION_ID = '5db5aee1-064b-4ef4-9193-345dcd8274ea';

export const createEmptyContact = (): SupplierContact => ({
  id: crypto.randomUUID(),
  role: '',
  name: '',
  signature: '',
  nickname: '',
  email: '',
  phone: '',
});

export const createEmptyPixKey = (principal = false): PixKey => ({
  id: crypto.randomUUID(),
  tipo: '',
  chave: '',
  favorecido: '',
  principal,
});
