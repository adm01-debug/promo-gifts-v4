/**
 * Catálogo de fixtures de proposta usado pela suíte de PDF headless.
 *
 * Cada entrada renderiza um HTML separado em `qa/exports/proposal-<id>.html`
 * (via `exportSampleProposal.test.tsx`) que depois vira PDF via
 * `scripts/qa/generate-proposal-pdf.mjs`. Adicione novas variações aqui
 * — o loop de export, o gate WCAG e o workflow `pdf-quality` pegam
 * automaticamente sem alteração adicional.
 *
 * Requisitos p/ boas fixtures:
 *  - `id` slug-safe (kebab-case) — vira nome do arquivo.
 *  - `label` humano — aparece no banner do HTML e no comentário do PR.
 *  - `data` determinístico (sem Date.now/random) — snapshots estáveis.
 *  - Cobrir combinações relevantes: nº de itens, presença/ausência de
 *    gravação, tipo de frete, prazo de pagamento, cor exótica no swatch.
 */
import type { ProposalTemplateData } from '../../../ProposalHtmlTemplate';
import { PROPOSAL_10015_26 } from './proposal-10015-26';

const PROPOSAL_MINIMAL: ProposalTemplateData = {
  quoteNumber: '00001/26',
  date: '01/01/2026',
  validUntil: '15/01/2026',
  client: {
    name: 'Contato Teste',
    company: 'Cliente Único LTDA',
    contactName: 'Ana Souza',
    cnpj: '11.222.333/0001-44',
  },
  seller: { name: 'Vendedor Padrão' },
  items: [
    {
      name: 'Chaveiro metálico',
      sku: 'CH-001',
      color: 'PRATA',
      colorHex: '#c0c0c0',
      description: 'Chaveiro simples em zamac cromado.',
      quantity: 50,
      unitPrice: 4.5,
      personalizations: [],
    },
  ],
  subtotal: 225,
  total: 225,
  shippingType: 'fob',
  paymentMethod: 'pix_transferencia',
  paymentTerms: '7_dias',
  deliveryTime: '7_dias',
};

const PROPOSAL_COMPLEX: ProposalTemplateData = {
  quoteNumber: '99999/26',
  date: '10/12/2026',
  validUntil: '25/12/2026',
  client: {
    name: 'Contato Enterprise',
    company: 'MegaCorp Distribuidora S.A.',
    contactName: 'Ricardo Fernandes',
    cnpj: '98.765.432/0001-10',
    email: 'ricardo@megacorp.com.br',
    phone: '(21) 4002-8922',
  },
  seller: {
    name: 'Fernanda Contas',
    email: 'fernanda@promogifts.com.br',
    phone: '(11) 3000-9999',
  },
  items: [
    {
      name: 'Mochila executiva antifurto USB',
      sku: 'MO-8801',
      color: 'GRAFITE',
      colorHex: '#2a2a2a',
      description: 'Mochila resistente a água, entrada USB externa, notebook até 15".',
      quantity: 300,
      unitPrice: 189.9,
      personalizations: [
        { technique_name: 'Bordado', location_name: 'Bolso frontal', colors_count: 3, width_cm: 8, height_cm: 4 },
        { technique_name: 'Transfer digital', location_name: 'Alça', colors_count: 4, width_cm: 6, height_cm: 2 },
      ],
    },
    {
      name: 'Copo térmico 500 ml parede dupla',
      sku: 'CP-4400',
      color: 'AMARELO NEON',
      colorHex: '#fff200',
      description: 'Aço inox 304 dupla parede, mantém quente/frio 12h.',
      quantity: 1000,
      unitPrice: 47.8,
      personalizations: [
        { technique_name: 'Fiber Laser', location_name: 'Frente', colors_count: 1, width_cm: 5, height_cm: 3 },
      ],
    },
    {
      name: 'Kit escritório sustentável',
      sku: 'KT-7702',
      color: 'BRANCO',
      colorHex: '#ffffff',
      description: 'Kit ecológico com caneta bambu, bloco reciclado e sacola algodão cru.',
      quantity: 500,
      unitPrice: 34.5,
      personalizations: [],
    },
    {
      name: 'Squeeze em PP 700 ml',
      sku: 'SQ-3210',
      color: 'VERMELHO',
      colorHex: '#d32f2f',
      description: 'Squeeze parede simples, tampa flip, isento de BPA.',
      quantity: 800,
      unitPrice: 9.9,
      personalizations: [
        { technique_name: 'Silk 4 cores', location_name: 'Corpo', colors_count: 4, width_cm: 7, height_cm: 5 },
      ],
    },
  ],
  subtotal: 300 * 189.9 + 1000 * 47.8 + 500 * 34.5 + 800 * 9.9,
  discount: 3000,
  shippingType: 'fob_pre',
  shippingCost: 1450,
  total: 300 * 189.9 + 1000 * 47.8 + 500 * 34.5 + 800 * 9.9 - 3000 + 1450,
  notes: 'Aprovação de layout digital antes do início da produção. Entregas parceladas mediante alinhamento.',
  paymentMethod: 'boleto',
  paymentTerms: '50_50',
  deliveryTime: '45_dias',
};

export interface ProposalFixture {
  id: string;
  label: string;
  data: ProposalTemplateData;
}

export const PROPOSAL_FIXTURES: ProposalFixture[] = [
  { id: '10015-26', label: 'Proposta 10015/26 (referência do PO)', data: PROPOSAL_10015_26 },
  { id: 'minimal-00001-26', label: 'Proposta mínima — 1 item, sem gravação, FOB', data: PROPOSAL_MINIMAL },
  { id: 'complex-99999-26', label: 'Proposta complexa — 4 itens, multi-gravação, FOB pré-negociado', data: PROPOSAL_COMPLEX },
];

export function getFixture(id: string): ProposalFixture | undefined {
  return PROPOSAL_FIXTURES.find((f) => f.id === id);
}
