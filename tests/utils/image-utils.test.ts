import { describe, it, expect } from 'vitest';
import {
  getCdnUrl,
  getSrcSet,
  isImageDeliveryUrl,
  getImageSizes,
  getCardImage,
  getHeroImage,
  getOgImage,
  getColorImages,
  getAvailableColors,
  getColorThumbnail,
  categorizeImages,
  type ProductImageMeta,
} from '@/utils/image-utils';

// Helper to create test image
const makeImage = (overrides: Partial<ProductImageMeta> = {}): ProductImageMeta => ({
  id: 'img-1',
  url_cdn: 'https://imagedelivery.net/abc/img1/public',
  url_original: null,
  image_type: 'main',
  is_primary: false,
  is_og_image: false,
  applies_to_color: null,
  supplier_code: null,
  alt_text: null,
  title_text: null,
  display_order: 0,
  ...overrides,
});

describe('image-utils', () => {
  describe('getCdnUrl', () => {
    it('retorna placeholder para URL vazia', () => {
      expect(getCdnUrl('')).toBe('/placeholder.svg');
    });

    it('troca variante em URLs do Cloudflare', () => {
      const url = 'https://imagedelivery.net/abc/img1/public';
      expect(getCdnUrl(url, 'card')).toBe('https://imagedelivery.net/abc/img1/card');
      expect(getCdnUrl(url, 'thumbnail')).toBe('https://imagedelivery.net/abc/img1/thumbnail');
      expect(getCdnUrl(url, 'large')).toBe('https://imagedelivery.net/abc/img1/large');
    });

    it('mantém variante public por default', () => {
      const url = 'https://imagedelivery.net/abc/img1/public';
      expect(getCdnUrl(url)).toBe(url);
    });

    it('retorna URL original para domínios não-Cloudflare', () => {
      const url = 'https://www.spotgifts.com.br/foto.jpg';
      expect(getCdnUrl(url)).toBe(url);
    });

    it('retorna URL original para domínios desconhecidos', () => {
      const url = 'https://other-cdn.com/image.jpg';
      expect(getCdnUrl(url)).toBe(url);
    });
  });

  describe('getSrcSet', () => {
    it('retorna vazio para URL vazia', () => {
      expect(getSrcSet('')).toBeUndefined();
    });

    it('gera srcSet com todas as variantes', () => {
      const srcSet = getSrcSet('https://imagedelivery.net/abc/img1/public');
      expect(srcSet).toContain('thumbnail 150w');
      expect(srcSet).toContain('small 400w');
      expect(srcSet).toContain('card 480w');
      expect(srcSet).toContain('medium 800w');
      expect(srcSet).toContain('large 1200w');
    });
  });

  describe('isImageDeliveryUrl — validação de host (anti substring-bypass)', () => {
    it('aceita o host canônico e subdomínios', () => {
      expect(isImageDeliveryUrl('https://imagedelivery.net/abc/img/public')).toBe(true);
      expect(isImageDeliveryUrl('https://cdn.imagedelivery.net/abc/img/public')).toBe(true);
    });

    it('rejeita hosts maliciosos que contêm a string mas não são o host', () => {
      expect(isImageDeliveryUrl('https://evil.com/?x=imagedelivery.net')).toBe(false);
      expect(isImageDeliveryUrl('https://imagedelivery.net.evil.com/img')).toBe(false);
      expect(isImageDeliveryUrl('https://evil.com/imagedelivery.net/img')).toBe(false);
    });

    it('rejeita nulo, vazio e URLs malformadas', () => {
      expect(isImageDeliveryUrl(null)).toBe(false);
      expect(isImageDeliveryUrl(undefined)).toBe(false);
      expect(isImageDeliveryUrl('')).toBe(false);
      expect(isImageDeliveryUrl('/relativo/img.png')).toBe(false);
      expect(isImageDeliveryUrl('não-é-url')).toBe(false);
    });

    it('getCdnUrl/getSrcSet ignoram URLs com host forjado', () => {
      const forged = 'https://evil.com/imagedelivery.net/abc/img/public';
      expect(getCdnUrl(forged)).toBe(forged); // não transforma
      expect(getSrcSet(forged)).toBeUndefined();
    });
  });

  describe('getImageSizes', () => {
    it('retorna sizes correto para card', () => {
      expect(getImageSizes('card')).toContain('640px');
    });
    it('retorna sizes correto para gallery', () => {
      expect(getImageSizes('gallery')).toContain('768px');
    });
    it('retorna sizes correto para hero', () => {
      expect(getImageSizes('hero')).toContain('768px');
    });
    it('retorna sizes correto para thumb', () => {
      expect(getImageSizes('thumb')).toBe('80px');
    });
  });

  describe('getCardImage', () => {
    it('prioriza is_og_image', () => {
      const images = [
        makeImage({ id: '1', is_og_image: true, image_type: 'main' }),
        makeImage({ id: '2', is_primary: true, image_type: 'set' }),
      ];
      expect(getCardImage(images)?.id).toBe('1');
    });

    it('fallback para main se sem og_image', () => {
      const images = [
        makeImage({ id: '1', image_type: 'gallery' }),
        makeImage({ id: '2', image_type: 'main' }),
      ];
      expect(getCardImage(images)?.id).toBe('2');
    });

    it('fallback para is_primary se sem main', () => {
      const images = [
        makeImage({ id: '1', image_type: 'gallery' }),
        makeImage({ id: '2', is_primary: true, image_type: 'set' }),
      ];
      expect(getCardImage(images)?.id).toBe('2');
    });

    it('retorna primeira se nenhum critério bate', () => {
      const images = [
        makeImage({ id: '1', image_type: 'gallery' }),
        makeImage({ id: '2', image_type: 'ambient' }),
      ];
      expect(getCardImage(images)?.id).toBe('1');
    });

    it('retorna null para array vazio', () => {
      expect(getCardImage([])).toBeNull();
    });
  });

  describe('getHeroImage', () => {
    it('prioriza is_primary', () => {
      const images = [
        makeImage({ id: '1', is_og_image: true }),
        makeImage({ id: '2', is_primary: true }),
      ];
      expect(getHeroImage(images)?.id).toBe('2');
    });

    it('fallback para og_image', () => {
      const images = [
        makeImage({ id: '1', is_og_image: true }),
        makeImage({ id: '2', image_type: 'gallery' }),
      ];
      expect(getHeroImage(images)?.id).toBe('1');
    });
  });

  describe('getOgImage', () => {
    it('prioriza is_og_image', () => {
      const images = [
        makeImage({ id: '1', is_primary: true }),
        makeImage({ id: '2', is_og_image: true }),
      ];
      expect(getOgImage(images)?.id).toBe('2');
    });
  });

  describe('getColorImages', () => {
    it('retorna hero genérico + imagens específicas da cor', () => {
      const images = [
        makeImage({ id: '1', applies_to_color: true, supplier_code: '001', image_type: 'main' }),
        makeImage({ id: '2', applies_to_color: true, supplier_code: '002', image_type: 'gallery' }),
        makeImage({ id: '3', applies_to_color: false, image_type: 'main' }),
        makeImage({ id: '4', applies_to_color: null, image_type: 'gallery' }),
      ];
      const result = getColorImages(images, '001');
      expect(result.length).toBe(2); // hero generic + 1 specific
      expect(result[0].id).toBe('3'); // generic main hero first
      expect(result[1].id).toBe('1'); // specific after
    });

    it('retorna apenas específicas se cor não encontrada', () => {
      const images = [
        makeImage({ id: '1', applies_to_color: true, supplier_code: '001', image_type: 'gallery' }),
        makeImage({ id: '2', applies_to_color: false, image_type: 'main' }),
      ];
      const result = getColorImages(images, '999');
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('2');
    });
  });

  describe('getAvailableColors', () => {
    it('retorna supplier_codes únicos numéricos', () => {
      const images = [
        makeImage({ applies_to_color: true, supplier_code: '001' }),
        makeImage({ applies_to_color: true, supplier_code: '002' }),
        makeImage({ applies_to_color: true, supplier_code: '001' }), // duplicado
        makeImage({ applies_to_color: true, supplier_code: 'red' }), // não numérico
      ];
      const colors = getAvailableColors(images);
      expect(colors).toEqual(['001', '002']);
    });

    it('retorna array vazio se nenhuma cor', () => {
      const images = [makeImage({ applies_to_color: false })];
      expect(getAvailableColors(images)).toEqual([]);
    });
  });

  describe('getColorThumbnail', () => {
    it('prioriza main da cor', () => {
      const images = [
        makeImage({ id: '1', applies_to_color: true, supplier_code: '001', image_type: 'gallery' }),
        makeImage({ id: '2', applies_to_color: true, supplier_code: '001', image_type: 'main' }),
      ];
      expect(getColorThumbnail(images, '001')?.id).toBe('2');
    });

    it('fallback para gallery', () => {
      const images = [
        makeImage({ id: '1', applies_to_color: true, supplier_code: '001', image_type: 'gallery' }),
      ];
      expect(getColorThumbnail(images, '001')?.id).toBe('1');
    });

    it('retorna null se cor não encontrada', () => {
      expect(getColorThumbnail([], '001')).toBeNull();
    });
  });

  describe('categorizeImages', () => {
    it('separa imagens por categoria', () => {
      const images = [
        makeImage({ id: '1', is_primary: true, image_type: 'set' }),
        makeImage({ id: '2', image_type: 'main' }),
        makeImage({ id: '3', image_type: 'gallery' }),
        makeImage({ id: '4', image_type: 'logo' }),
        makeImage({ id: '5', image_type: 'ambient' }),
        makeImage({ id: '6', image_type: 'box' }),
        makeImage({ id: '7', image_type: 'pouch' }),
      ];
      const result = categorizeImages(images);
      expect(result.hero?.id).toBe('1');
      expect(result.main.length).toBe(1);
      expect(result.gallery.length).toBe(1);
      expect(result.logo.length).toBe(1);
      expect(result.ambient.length).toBe(1);
      expect(result.packaging.length).toBe(2);
    });

    it('retorna hero null se sem is_primary', () => {
      const images = [makeImage({ image_type: 'main' })];
      expect(categorizeImages(images).hero).toBeNull();
    });
  });
});
