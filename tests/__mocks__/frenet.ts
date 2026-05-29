/**
 * tests/__mocks__/frenet.ts
 *
 * Static response fixtures for the Frenet freight API.
 * Import and use with vi.mock() or as fetch-mock stubs so tests never
 * need live Frenet credentials.
 *
 * Usage:
 *   import { frenetQuoteResponse, frenetZipResponse } from '../__mocks__/frenet';
 *   vi.mock('@/lib/freight/frenet', () => ({ quoteFrete: vi.fn().mockResolvedValue(frenetQuoteResponse) }));
 */

export const frenetZipResponse = {
  ZipCode: '01310-100',
  Street: 'Avenida Paulista',
  Complement: '',
  Neighborhood: 'Bela Vista',
  City: 'São Paulo',
  State: 'SP',
  Error: false,
  Message: '',
};

export const frenetQuoteResponse = {
  ShippingSevicesArray: [
    {
      ServiceCode: 'FR',
      ServiceDescription: 'Frenet',
      Carrier: 'Jadlog',
      CarrierCode: 'JD',
      ShippingPrice: 18.5,
      DeliveryTime: 3,
      Error: false,
      Msg: '',
    },
    {
      ServiceCode: 'FR',
      ServiceDescription: 'Frenet Econômico',
      Carrier: 'Jadlog',
      CarrierCode: 'JD',
      ShippingPrice: 14.0,
      DeliveryTime: 7,
      Error: false,
      Msg: '',
    },
  ],
  Error: false,
  Msg: '',
};

export const frenetQuoteError = {
  ShippingSevicesArray: [],
  Error: true,
  Msg: 'CEP de destino não atendido.',
};

export const frenetTrackResponse = {
  TrackingEvents: [
    {
      EventType: 'ENTREGUE',
      EventDescription: 'Objeto entregue ao destinatário',
      EventDate: '2025-01-15',
      EventTime: '14:23:00',
      City: 'São Paulo',
      State: 'SP',
    },
  ],
  Error: false,
  Msg: '',
};
