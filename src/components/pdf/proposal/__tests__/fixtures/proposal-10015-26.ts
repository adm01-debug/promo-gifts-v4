/**
 * Fixture canônica de proposta usada em:
 *  - Auto-export HTML (exportSampleProposal.test.tsx)
 *  - Snapshots por seção (ProposalSections.snapshots.test.tsx)
 *  - Relatório de contraste WCAG (pdfContrastReport.test.ts)
 *
 * Reproduz o orçamento nº 10015/26 usado como referência visual pelo PO
 * (mesmos itens, gravações e cliente). Determinística — sem Date.now().
 */
import type { ProposalTemplateData } from '../../../ProposalHtmlTemplate';

export const PROPOSAL_10015_26: ProposalTemplateData = {
  quoteNumber: '10015/26',
  date: '15/03/2026',
  validUntil: '30/03/2026',
  client: {
    name: 'Contato ACME',
    email: 'compras@acme.com.br',
    phone: '(11) 98765-4321',
    company: 'ACME Indústria e Comércio LTDA',
    contactName: 'Maria Silva',
    cnpj: '12.345.678/0001-99',
  },
  seller: {
    name: 'João Vendedor',
    email: 'joao@promogifts.com.br',
    phone: '(11) 3000-0000',
  },
  items: [
    {
      name: 'Garrafa esportiva em alumínio 400 ml',
      sku: '94297-7.1',
      color: 'LARANJA',
      colorHex: '#ff8800',
      description: 'Garrafa esportiva parede simples, tampa rosca, ideal para brindes esportivos.',
      quantity: 200,
      unitPrice: 32.05,
      personalizations: [
        { technique_name: 'Fiber Laser', location_name: 'Lado A', colors_count: 1, width_cm: 3, height_cm: 5 },
        { technique_name: 'Fiber Laser', location_name: 'Lado B', colors_count: 1, width_cm: 3, height_cm: 4 },
      ],
    },
    {
      name: 'Caneta metálica premium',
      sku: 'PV-10570',
      color: 'PRETO',
      colorHex: '#111111',
      description: 'Caneta esferográfica corpo metálico, ponta 1.0 mm, tinta azul.',
      quantity: 500,
      unitPrice: 12.90,
      personalizations: [
        { technique_name: 'Gravação Laser', location_name: 'Corpo', colors_count: 1, width_cm: 4, height_cm: 0.6 },
      ],
    },
    {
      name: 'Bloco de anotações capa dura',
      sku: 'BL-2201',
      color: 'AZUL',
      colorHex: '#0055aa',
      description: '80 folhas pautadas, capa em couro sintético.',
      quantity: 100,
      unitPrice: 18.50,
      personalizations: [],
    },
  ],
  subtotal: 200 * 32.05 + 500 * 12.90 + 100 * 18.50, // 14710
  discount: 210,
  shippingType: 'cif',
  shippingCost: 0,
  total: 200 * 32.05 + 500 * 12.90 + 100 * 18.50 - 210, // 14500
  notes: 'Prazo de produção após aprovação de arte.',
  paymentMethod: 'boleto',
  paymentTerms: '14_dias',
  deliveryTime: '21_dias',
};
