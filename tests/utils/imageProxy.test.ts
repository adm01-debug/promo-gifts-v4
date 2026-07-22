import { describe, it, expect } from 'vitest';
import {
  deriveSpotOriginalUrlFromWorker,
  getProxiedImageUrl,
  needsProxy,
} from '@/utils/imageProxy';

describe('imageProxy', () => {
  describe('getProxiedImageUrl', () => {
    it('retorna null para url null', () => {
      expect(getProxiedImageUrl(null)).toBeNull();
    });

    it('retorna null para url undefined', () => {
      expect(getProxiedImageUrl(undefined)).toBeNull();
    });

    it('retorna url original para domínios não-proxiados', () => {
      const url = 'https://imagedelivery.net/abc123/public';
      expect(getProxiedImageUrl(url)).toBe(url);
    });

    it('proxia URLs do www.spotgifts.com.br', () => {
      const url = 'https://www.spotgifts.com.br/fotos/produtos/12345.jpg';
      const result = getProxiedImageUrl(url);
      expect(result).toContain('functions/v1/image-proxy');
      expect(result).toContain(encodeURIComponent(url));
    });

    it('proxia URLs do spotgifts.com.br (sem www)', () => {
      const url = 'https://spotgifts.com.br/fotos/produtos/12345.jpg';
      const result = getProxiedImageUrl(url);
      expect(result).toContain('functions/v1/image-proxy');
    });

    it('não proxia URLs de outros domínios', () => {
      const url = 'https://example.com/image.jpg';
      expect(getProxiedImageUrl(url)).toBe(url);
    });

    it('retorna a URL original para URLs inválidas', () => {
      expect(getProxiedImageUrl('not-a-url')).toBe('not-a-url');
    });

    it('retorna string vazia como está', () => {
      // Empty string is falsy, returns null
      expect(getProxiedImageUrl('')).toBeNull();
    });
  });

  describe('needsProxy', () => {
    it('retorna false para null', () => {
      expect(needsProxy(null)).toBe(false);
    });

    it('retorna false para undefined', () => {
      expect(needsProxy(undefined)).toBe(false);
    });

    it('retorna true para www.spotgifts.com.br', () => {
      expect(needsProxy('https://www.spotgifts.com.br/foto.jpg')).toBe(true);
    });

    it('retorna true para spotgifts.com.br', () => {
      expect(needsProxy('https://spotgifts.com.br/foto.jpg')).toBe(true);
    });

    it('retorna false para imagedelivery.net', () => {
      expect(needsProxy('https://imagedelivery.net/abc/public')).toBe(false);
    });

    it('retorna false para URL inválida', () => {
      expect(needsProxy('not-a-url')).toBe(false);
    });

    it('retorna false para string vazia', () => {
      expect(needsProxy('')).toBe(false);
    });
  });

  describe('deriveSpotOriginalUrlFromWorker', () => {
    it('deriva a origem oficial da Spot para URLs do worker legado', () => {
      expect(
        deriveSpotOriginalUrlFromWorker(
          'https://promo-brindes-images.adm01.workers.dev/spot/94297_106-c.jpg',
        ),
      ).toBe('https://www.spotgifts.com.br/fotos/produtos/94297_106-c.jpg');
    });

    it('retorna null para hosts não reconhecidos', () => {
      expect(deriveSpotOriginalUrlFromWorker('https://example.com/spot/94297_103.jpg')).toBeNull();
    });
  });
});
