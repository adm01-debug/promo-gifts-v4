import { logger } from '@/lib/logger';
/**
 * Product Bounds Detector
 *
 * Detects the actual bounding box of a product within its catalog image
 * using an offscreen canvas. Works best with white/transparent backgrounds
 * (standard for catalog photos).
 *
 * Returns the fraction of the image that the product occupies, which is
 * then used to calculate accurate cm-to-px scaling.
 */

export interface ProductBounds {
  /** Fraction of image width occupied by product (0-1) */
  fractionX: number;
  /** Fraction of image height occupied by product (0-1) */
  fractionY: number;
  /** Product center X as fraction of image (0-1) */
  centerX: number;
  /** Product center Y as fraction of image (0-1) */
  centerY: number;
  /** Whether detection succeeded or fell back to default */
  detected: boolean;
  /** Natural aspect ratio of the source image (width / height) */
  imageAspectRatio: number;
}

const DEFAULT_BOUNDS: ProductBounds = {
  fractionX: 0.85,
  fractionY: 0.85,
  centerX: 0.5,
  centerY: 0.5,
  detected: false,
  imageAspectRatio: 1,
};

// Cache to avoid reprocessing the same image
const boundsCache = new Map<string, ProductBounds>();

/**
 * Detect the product's bounding box in the image by scanning for
 * non-background pixels. Background is identified as near-white or
 * near-transparent pixels.
 *
 * @param imageUrl URL of the product image
 * @param options.whiteThreshold Pixel brightness above which is "background" (0-255, default 245)
 * @param options.alphaThreshold Alpha below which is "transparent" (0-255, default 10)
 * @param options.margin Extra margin fraction to add around detected bounds (default 0.02)
 * @param options.maxSize Max canvas dimension for performance (default 512)
 */
export async function detectProductBounds(
  imageUrl: string,
  options?: {
    whiteThreshold?: number;
    alphaThreshold?: number;
    margin?: number;
    maxSize?: number;
  },
): Promise<ProductBounds> {
  // Check cache
  const cached = boundsCache.get(imageUrl);
  if (cached) return cached;

  const { whiteThreshold = 245, alphaThreshold = 10, margin = 0.02, maxSize = 512 } = options || {};

  try {
    const img = await loadImageCors(imageUrl);

    // Capture natural aspect ratio before scaling
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    if (natW === 0 || natH === 0) return DEFAULT_BOUNDS;
    const imageAspectRatio = natW / natH;

    // Scale down for performance
    let w = natW;
    let h = natH;

    const scale = Math.min(1, maxSize / Math.max(w, h));
    w = Math.round(w * scale);
    h = Math.round(h * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return DEFAULT_BOUNDS;

    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const { data } = imageData;

    let minX = w,
      maxX = 0,
      minY = h,
      maxY = 0;
    let productPixels = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Skip transparent pixels
        if (a < alphaThreshold) continue;

        // Skip near-white pixels (background)
        if (r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold) continue;

        // This pixel belongs to the product
        productPixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    // If too few product pixels found, the image might have a complex background
    // or be all-white. Fall back to default.
    const totalPixels = w * h;
    const productRatio = productPixels / totalPixels;
    if (productPixels < 100 || productRatio < 0.01) {
      const fallback: ProductBounds = { ...DEFAULT_BOUNDS, imageAspectRatio };
      boundsCache.set(imageUrl, fallback);
      return fallback;
    }

    // If product fills almost the entire image (>95%), likely no background to detect
    if (productRatio > 0.95) {
      const fullBounds: ProductBounds = {
        fractionX: 0.95,
        fractionY: 0.95,
        centerX: 0.5,
        centerY: 0.5,
        detected: true,
        imageAspectRatio,
      };
      boundsCache.set(imageUrl, fullBounds);
      return fullBounds;
    }

    // Calculate fractions with margin
    const boundsW = maxX - minX;
    const boundsH = maxY - minY;
    const fractionX = Math.min(1, boundsW / w + margin * 2);
    const fractionY = Math.min(1, boundsH / h + margin * 2);
    const centerX = (minX + boundsW / 2) / w;
    const centerY = (minY + boundsH / 2) / h;

    const result: ProductBounds = {
      fractionX,
      fractionY,
      centerX,
      centerY,
      detected: true,
      imageAspectRatio,
    };

    boundsCache.set(imageUrl, result);
    return result;
  } catch (err) {
    logger.warn('[ProductBoundsDetector] Failed to detect bounds, using fallback:', err);
    return DEFAULT_BOUNDS;
  }
}

/**
 * Load an image handling CORS. First tries direct load,
 * then falls back to fetch+blob if CORS blocks canvas read.
 */
function loadImageCors(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = async () => {
      // Fallback: fetch as blob to bypass CORS
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const img2 = new Image();
        img2.onload = () => {
          URL.revokeObjectURL(blobUrl);
          resolve(img2);
        };
        img2.onerror = () => {
          URL.revokeObjectURL(blobUrl);
          reject(new Error('Failed to load image via blob fallback'));
        };
        img2.src = blobUrl;
      } catch (e) {
        reject(e);
      }
    };
    img.src = url;
  });
}

/**
 * Clear the bounds cache (useful if images are updated).
 */
export function clearBoundsCache() {
  boundsCache.clear();
}
