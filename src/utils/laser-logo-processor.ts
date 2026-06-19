/**
 * laserLogoProcessor — Converte logo para tom laser sólido via Canvas API
 *
 * Abordagem correta: pixel a pixel
 * - Pixels transparentes (alpha < 30) → mantém transparente
 * - Pixels near-white (luminância > 230) → mantém branco/transparente (preserva espaços entre elementos)
 * - Qualquer outro pixel (colorido, cinza, preto) → substitui pelo tom laser sólido
 *
 * Isso preserva os espaços brancos entre elementos (ex: triângulos do SICOOB)
 * enquanto converte TODOS os pixels "visíveis" para um único tom sólido.
 */

export interface LaserToneConfig {
  /** Hex color for laser tone, e.g. "#C0C0C0" for claro, "#3D3D3D" for escuro */
  hex: string;
  /** Alpha multiplier 0-1 for the final tone */
  opacity?: number;
  /** Luminance threshold above which pixels are treated as "white/background" (0-255, default 230) */
  whiteThreshold?: number;
}

const LASER_TONES: Record<'claro' | 'escuro', LaserToneConfig> = {
  claro: { hex: '#BEBEBE', opacity: 0.85, whiteThreshold: 220 },
  escuro: { hex: '#3A3A3A', opacity: 0.92, whiteThreshold: 220 },
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Processes a logo image URL and returns a data URL where every
 * non-transparent, non-white pixel has been replaced by the laser tone color.
 * White gaps between logo elements are preserved.
 */
export async function processLogoForLaser(
  imageUrl: string,
  tone: 'claro' | 'escuro',
): Promise<string> {
  const config = LASER_TONES[tone];
  const [tR, tG, tB] = hexToRgb(config.hex);
  const whiteThreshold = config.whiteThreshold ?? 220;

  // Load image — handle CORS by fetching as blob first
  const blob = await fetchAsBlob(imageUrl);
  const blobUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Canvas 2D context not available'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(blobUrl);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Skip fully/mostly transparent pixels
        if (a < 30) {
          data[i + 3] = 0;
          continue;
        }

        // Calculate perceived luminance (ITU-R BT.709)
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        // White/near-white pixels = background or intentional gaps between elements
        // → make transparent to preserve spaces (e.g. between SICOOB triangles)
        if (luminance > whiteThreshold && a > 200) {
          data[i + 3] = 0; // transparent
          continue;
        }

        // All other pixels = logo content → replace with solid laser tone
        // 100% monochromatic: every visible pixel gets EXACTLY the same tone at full opacity
        data[i] = tR;
        data[i + 1] = tG;
        data[i + 2] = tB;
        data[i + 3] = 255; // Full opacity — no gradients, no anti-aliasing variation
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error('Failed to load image'));
    };

    img.src = blobUrl;
  });
}

// ─── Serigrafia processor ─────────────────────────────────────────────────────

/**
 * Processes a logo for serigrafia (screen printing):
 * - Transparent/white pixels → transparent (preserve gaps)
 * - Each visible pixel → snapped to the nearest selected Pantone color (solid, no gradients)
 *
 * For 1 color: everything becomes that single solid color.
 * For N colors: each pixel is mapped to the closest selected color by RGB distance.
 */
export async function processLogoForSerigrafia(
  imageUrl: string,
  selectedColors: Array<{ hex: string; pantoneCode: string }>,
): Promise<string> {
  if (selectedColors.length === 0) {
    // No colors selected — return original
    const blob = await fetchAsBlob(imageUrl);
    return URL.createObjectURL(blob);
  }

  // Pre-parse all selected colors to RGB
  const palette = selectedColors.map((c) => ({ ...c, rgb: hexToRgbInternal(c.hex) }));

  const blob = await fetchAsBlob(imageUrl);
  const blobUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('Canvas 2D context not available'));
        return;
      }

      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(blobUrl);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const WHITE_THRESHOLD = 220;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Skip fully/mostly transparent pixels
        if (a < 30) {
          data[i + 3] = 0;
          continue;
        }

        // White/near-white pixels → transparent (preserve internal gaps)
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (luminance > WHITE_THRESHOLD && a > 200) {
          data[i + 3] = 0;
          continue;
        }

        // Find nearest color in palette by squared RGB distance
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let p = 0; p < palette.length; p++) {
          const [pR, pG, pB] = palette[p].rgb;
          const dist = (r - pR) ** 2 + (g - pG) ** 2 + (b - pB) ** 2;
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = p;
          }
        }

        const [tR, tG, tB] = palette[bestIdx].rgb;
        data[i] = tR;
        data[i + 1] = tG;
        data[i + 2] = tB;
        data[i + 3] = 255; // Solid — 100% monochromatic per color
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error('Failed to load image for serigrafia processing'));
    };

    img.src = blobUrl;
  });
}

function hexToRgbInternal(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

async function fetchAsBlob(url: string): Promise<Blob> {
  // For blob: and data: URLs, fetch directly
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    const response = await fetch(url);
    return response.blob();
  }

  // For remote URLs, fetch with no-cors fallback
  try {
    const response = await fetch(url, { mode: 'cors' });
    return await response.blob();
  } catch {
    // Fallback: try without CORS mode (may lose some headers but works for same-origin)
    const response = await fetch(url);
    return response.blob();
  }
}
