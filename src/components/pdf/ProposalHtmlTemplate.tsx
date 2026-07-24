import { forwardRef } from 'react';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  boleto: 'Boleto Bancário',
  pix_transferencia: 'Transferência Bancária / Pix',
} as const;

const PAYMENT_TERMS_LABELS: Record<string, string> = {
  '7_dias': '7 dias a partir da entrega',
  '14_dias': '14 dias a partir da entrega',
  '21_dias': '21 dias a partir da entrega',
  '28_dias': '28 dias a partir da entrega',
  '7_14_dias': '7 e 14 dias a partir da entrega',
  '50_50': '50% entrada / 50% após entrega',
} as const;

const DELIVERY_TIME_LABELS: Record<string, string> = {
  '7_dias': '7 dias após aprovação',
  '14_dias': '14 dias após aprovação',
  '21_dias': '21 dias após aprovação',
  '28_dias': '28 dias após aprovação',
  '45_dias': '45 dias após aprovação',
} as const;
import {
  HeaderSection,
  ClientBar,
  ProductsTable,
  TotalsSection,
  NotesSection,
  FooterSection,
} from './ProposalSections';

export interface ProposalItemPersonalization {
  technique_name: string;
  location_name?: string;
  material?: string;
  colors_count?: number;
  width_cm?: number;
  height_cm?: number;
  area_cm2?: number;
  unit_cost?: number;
  setup_cost?: number;
  total_cost?: number;
  notes?: string;
}

export interface ProposalItem {
  name: string;
  sku?: string;
  composedCode?: string;
  colorHex?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  color?: string;
  size?: string;
  gender?: string;
  imageUrl?: string;
  material?: string;
  personalizations?: ProposalItemPersonalization[];
  kit_group_id?: string | null;
  kit_name?: string | null;
}

export interface ProposalTemplateData {
  quoteNumber: string;
  date: string;
  validUntil: string;
  client: {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    contactName?: string;
    cnpj?: string;
  };
  seller: {
    name: string;
    email?: string;
    phone?: string;
    signatureUrl?: string;
  };
  items: ProposalItem[];
  subtotal: number;
  discount?: number;
  shippingCost?: number;
  shippingType?: string;
  total: number;
  notes?: string;
  paymentMethod?: string;
  paymentTerms?: string;
  deliveryTime?: string;
}

export function formatPaymentMethod(value?: string): string {
  return value ? PAYMENT_METHOD_LABELS[value] || value : '';
}

export function formatPaymentTerms(value?: string): string {
  return value ? PAYMENT_TERMS_LABELS[value] || value : '';
}

export function formatDeliveryTime(value?: string): string {
  if (!value) return '';
  if (value.startsWith('date:')) {
    const iso = value.slice(5); // esperado: YYYY-MM-DD
    const [y, m, d] = iso.split('-');
    // FIX: validar que y/m/d são numéricos antes de formatar.
    // Sem validação, "date:nao-e-data" gerava "Entrega até data/e/nao"
    // ao invés de retornar o valor raw — comportamento incorreto.
    if (y && m && d && /^\d{4}$/.test(y) && /^\d{1,2}$/.test(m) && /^\d{1,2}$/.test(d)) {
      return `Entrega até ${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }
    return value; // formato inválido: retorna raw sem explodir
  }
  return DELIVERY_TIME_LABELS[value] || value;
}

export function formatShipping(type?: string, cost?: number): string {
  if (!type) return 'A combinar';
  if (type === 'cif') return 'CIF — Frete grátis (Cortesia)';
  if (type === 'fob') return 'FOB — Repassado ao cliente';
  if (type === 'fob_pre') {
    const amount =
      typeof cost === 'number' && cost > 0
        ? ` (${cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`
        : '';
    return `FOB — Valor pré-negociado${amount}`;
  }
  return type;
}

export const ProposalHtmlTemplate = forwardRef<HTMLDivElement, { data: ProposalTemplateData }>(
  ({ data }, ref) => {
    const company = data.client.company || data.client.name;
    const contact = data.client.contactName || '';

    return (
      <div
        ref={ref}
        style={{
          width: '794px',
          minHeight: '1123px',
          backgroundColor: '#fff',
          fontFamily: "'Roboto', 'Segoe UI', Helvetica, Arial, sans-serif",
          color: '#333',
          position: 'relative',
          boxSizing: 'border-box',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <HeaderSection data={data} />
        <div style={{ padding: '0 50px', flex: 1 }}>
          <ClientBar company={company} contact={contact} cnpj={data.client.cnpj} />
          <ProductsTable items={data.items} />
          <TotalsSection data={data} />
          <NotesSection data={data} />
        </div>
        <FooterSection data={data} />
      </div>
    );
  },
);

ProposalHtmlTemplate.displayName = 'ProposalHtmlTemplate';
