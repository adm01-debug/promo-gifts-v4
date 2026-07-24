/**
 * tests/__mocks__/totalexpress.ts
 *
 * Static response fixtures for the Total Express freight API.
 * Import and use with vi.mock() or as fetch-mock stubs so tests never
 * need live Total Express credentials.
 *
 * Usage:
 *   import { totalexpressQuoteResponse } from '../__mocks__/totalexpress';
 *   vi.mock('@/lib/freight/totalexpress', () => ({ calcularFrete: vi.fn().mockResolvedValue(totalexpressQuoteResponse) }));
 */

export const totalexpressQuoteResponse = {
  Success: true,
  ErrorMessage: null,
  Quotations: [
    {
      ServiceCode: '40010',
      ServiceDescription: 'SEDEX',
      Price: 35.9,
      DeliveryTime: 2,
      Weight: 1.0,
      Volume: 0.001,
    },
    {
      ServiceCode: '41106',
      ServiceDescription: 'PAC',
      Price: 22.5,
      DeliveryTime: 8,
      Weight: 1.0,
      Volume: 0.001,
    },
  ],
};

export const totalexpressQuoteError = {
  Success: false,
  ErrorMessage: 'CEP de destino não atendido pela Total Express.',
  Quotations: [],
};

export const totalexpressTrackResponse = {
  Success: true,
  ErrorMessage: null,
  TrackingCode: 'TE123456789BR',
  Events: [
    {
      Code: 'BDE',
      Description: 'Objeto entregue ao destinatário',
      Date: '2025-01-15',
      Time: '14:23',
      Local: 'São Paulo / SP',
    },
    {
      Code: 'OEC',
      Description: 'Objeto saiu para entrega ao destinatário',
      Date: '2025-01-15',
      Time: '08:10',
      Local: 'São Paulo / SP',
    },
  ],
};

export const totalexpressDeliveryEstimate = {
  Success: true,
  ErrorMessage: null,
  OriginZipCode: '01310-100',
  DestinationZipCode: '20040-020',
  EstimatedDays: 3,
  CutoffTime: '18:00',
};

export const totalexpressZipValidation = {
  Success: true,
  ErrorMessage: null,
  ZipCode: '01310-100',
  Covered: true,
  ServiceTypes: ['SEDEX', 'PAC'],
};

export const totalexpressZipNotCovered = {
  Success: false,
  ErrorMessage: 'CEP não coberto.',
  ZipCode: '99999-000',
  Covered: false,
  ServiceTypes: [],
};
