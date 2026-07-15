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
 *
 * @fix_version cors-bounds-xbz-2026-07
 * ANTI-REGRESSÃO: Não reverter — remove fetch() fallback que causava:
 *   1. Violação de CSP connect-src para cdn.xbzbrindes.com.br e outros CDNs externos
 *   2. CORS error redundante no console (imagem já carrega sem crossOrigin via img-src)
 * Substituído por retry-sem-crossOrigin: canvas fica tainted → getImageData() joga
 * SecurityError → retorna DEFAULT_BOUNDS com imageAspectRatio correto. Zero violações CSP.
 *
 * Semáforo MAX_CONCURRENT_DETECTIONS=6 para evitar 200+ requests simultâneos
 * no carregamento da grade de produtos.
 */

export interface ProductBounds {
  fractionX: number;
  fractionY: number;
  centerX: number;
  centerY: number;
  detected: boolean;
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

// In-flight deduplication: garante que URLs idênticas requisitadas
// simultaneamente compartilhem a mesma Promise (sem N detecções redundantes).
// @fix_version bounds-inflight-dedup-2026-07
// ANTI-REGRESSÃO: crítico para grades com mesmo produto repetido ou
// virtual-scroll que re-renderiza o mesmo card enquanto detecção está em curso.
const _pendingDetections = new Map<string, Promise<ProductBounds>>();

// ---------------------------------------------------------------------------
// Semáforo de concorrência — evita centenas de loads simultâneos
// ---------------------------------------------------------------------------
const MAX_CONCURRENT_DETECTIONS = 6;
let _activeDetections = 0;
const _detectionQueue: Array<() => void> = [];

function acquireDetectionSlot(): Promise<void> {
  return new Promise((resolve) => {
    if (_activeDetections < MAX_CONCURRENT_DETECTIONS) {
      _activeDetections++;
      resolve();
    } else {
      _detectionQueue.push(resolve);
    }
  });
}

function releaseDetectionSlot(): void {
  const next = _detectionQueue.shift();
  if (next) {
    next(); // passa o slot direto para o próximo
  } else {
    _activeDetections--;
  }
}

/**
 * Detect the product's bounding box in the image by scanning for
 * non-background pixels.
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
  const cached = boundsCache.get(imageUrl);
  if (cached) return cached;

  // In-flight deduplication: se outra chamada para a mesma URL está em curso,
  // compartilha a mesma Promise em vez de disparar uma nova detecção.
  const inFlight = _pendingDetections.get(imageUrl);
  if (inFlight) return inFlight;

  const { whiteThreshold = 245, alphaThreshold = 10, margin = 0.02, maxSize = 512 } = options || {};

  // Registra a Promise desta detecção para deduplicação concurrent.
  // Removida do Map em finally (sucesso ou falha).
  const detectionPromise = _runDetection(imageUrl, { whiteThreshold, alphaThreshold, margin, maxSize });
  _pendingDetections.set(imageUrl, detectionPromise);
  try {
    return await detectionPromise;
  } finally {
    _pendingDetections.delete(imageUrl);
  }
}

// Implementação interna — chamada apenas pela função pública (jamais diretamente).
async function _runDetection(
  imageUrl: string,
  { whiteThreshold, alphaThreshold, margin, maxSize }: Required<{
    whiteThreshold: number;
    alphaThreshold: number;
    margin: number;
    maxSize: number;
  }>,
): Promise<ProductBounds> {

  await acquireDetectionSlot();
  try {
    const img = await loadImageCors(imageUrl);

    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    if (natW === 0 || natH === 0) return DEFAULT_BOUNDS;
    const imageAspectRatio = natW / natH;

    const scale = Math.min(1, maxSize / Math.max(natW, natH));
    const w = Math.round(natW * scale);
    const h = Math.round(natH * scale);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return DEFAULT_BOUNDS;

    ctx.drawImage(img, 0, 0, w, h);

    let imageData: ImageData;
    try {
      imageData = ctx.getImageData(0, 0, w, h);
    } catch {
      // Tainted canvas — imagem carregada sem CORS (CDN externo).
      // Retorna defaults com imageAspectRatio correto.
      const fallback: ProductBounds = { ...DEFAULT_BOUNDS, imageAspectRatio };
      boundsCache.set(imageUrl, fallback);
      return fallback;
    }

    const { data } = imageData;
    let minX = w, maxX = 0, minY = h, maxY = 0, productPixels = 0;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < alphaThreshold) continue;
        if (r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold) continue;
        productPixels++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }

    const totalPixels = w * h;
    const productRatio = productPixels / totalPixels;
    if (productPixels < 100 || productRatio < 0.01) {
      const fallback: ProductBounds = { ...DEFAULT_BOUNDS, imageAspectRatio };
      boundsCache.set(imageUrl, fallback);
      return fallback;
    }

    if (productRatio > 0.95) {
      const fullBounds: ProductBounds = {
        fractionX: 0.95, fractionY: 0.95,
        centerX: 0.5, centerY: 0.5,
        detected: true, imageAspectRatio,
      };
      boundsCache.set(imageUrl, fullBounds);
      return fullBounds;
    }

    const boundsW = maxX - minX;
    const boundsH = maxY - minY;
    const result: ProductBounds = {
      fractionX: Math.min(1, boundsW / w + margin * 2),
      fractionY: Math.min(1, boundsH / h + margin * 2),
      centerX: (minX + boundsW / 2) / w,
      centerY: (minY + boundsH / 2) / h,
      detected: true,
      imageAspectRatio,
    };

    boundsCache.set(imageUrl, result);
    return result;
  } catch (err) {
    logger.warn('[ProductBoundsDetector] Failed to detect bounds, using fallback:', err);
    return DEFAULT_BOUNDS;
  } finally {
    releaseDetectionSlot();
  }
}

/**
 * Domínios que suportam CORS headers para uso com crossOrigin='anonymous'.
 * Apenas CDNs Cloudflare retornam Access-Control-Allow-Origin: * para qualquer origem.
 * CDNs de fornecedores (XBZ, SPOT, ASIA, Só Marcas etc.) NÃO têm CORS headers —
 * tentar crossOrigin gera erro no console sem nenhum benefício.
 *
 * @fix_version bounds-cors-capable-2026-07
 * ANTI-REGRESSÃO: não reverter. Elimina CORS errors no console para imagens XBZ.
 */
const CORS_CAPABLE_HOSTNAMES = new Set(['imagedelivery.net', 'videodelivery.net']);

function isCorsCapable(url: string): boolean {
  try {
    return CORS_CAPABLE_HOSTNAMES.has(new URL(url).hostname);
  } catch {
    return false; // URL relativa, blob:, data: etc. → sem crossOrigin
  }
}

/**
 * Carrega imagem para detecção de bounds, com estratégia baseada no domínio:
 *
 * CDNs CF (imagedelivery.net / videodelivery.net):
 *   → crossOrigin='anonymous' → getImageData() funciona → bounds detection completa
 *   → se falhar (ex: Lovable preview fora da allowlist), retry sem crossOrigin
 *
 * CDNs de fornecedores (XBZ, SPOT, ASIA, Só Marcas etc.):
 *   → carrega SEM crossOrigin (sem CORS error no console!)
 *   → canvas fica tainted → getImageData() joga SecurityError
 *   → retornamos DEFAULT_BOUNDS com imageAspectRatio correto
 *
 * @fix_version bounds-cors-capable-2026-07
 */
function loadImageCors(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    if (!isCorsCapable(url)) {
      // CDN sem CORS (XBZ, SPOT, ASIA etc.) — carrega direto SEM crossOrigin.
      // Evita CORS error no console. Canvas ficará tainted → DEFAULT_BOUNDS+aspectRatio.
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error(`[ProductBoundsDetector] image load failed: ${url.substring(0, 80)}`));
      img.src = url;
      return;
    }

    // CF Images (imagedelivery.net) suporta CORS → tenta com crossOrigin
    // para permitir getImageData() e bounds detection completa.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      // CORS falhou (ex: origem Lovable preview não na allowlist) — retry sem crossOrigin.
      const img2 = new Image();
      img2.onload = () => resolve(img2);
      img2.onerror = () =>
        reject(new Error(`[ProductBoundsDetector] image load failed: ${url.substring(0, 80)}`));
      img2.src = url;
    };
    img.src = url;
  });
}
