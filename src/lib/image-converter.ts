/**
 * Image Converter Utilities
 *
 * Automatically converts unsupported image formats (SVG, WebP, BMP, etc.)
 * to PNG using an offscreen canvas for browser-side rasterization.
 */

const SUPPORTED_FORMATS = ['image/png', 'image/jpeg', 'image/jpg'];

/**
 * Check if a file needs conversion to PNG.
 */
export function needsConversion(file: File): boolean {
  return !SUPPORTED_FORMATS.includes(file.type);
}

/**
 * Convert any browser-supported image file to PNG via canvas rasterization.
 * Returns a new File object with the converted PNG data.
 */
export async function convertToPng(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Use a reasonable max size to avoid memory issues
        const maxDim = 2048;
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        // For SVGs with no intrinsic size, default to 512
        if (width === 0 || height === 0) {
          width = 512;
          height = 512;
        }

        // Scale down if too large
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas toBlob failed'));
              return;
            }
            const baseName = file.name.replace(/\.[^.]+$/, '');
            const converted = new File([blob], `${baseName}.png`, {
              type: 'image/png',
            });
            resolve(converted);
          },
          'image/png',
          1.0,
        );
      };

      img.onerror = () => {
        reject(new Error('Não foi possível carregar a imagem para conversão'));
      };

      // For SVG data URIs, we need to handle them properly
      const dataUrl = reader.result as string;
      img.src = dataUrl;
    };
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo'));
    reader.readAsDataURL(file);
  });
}

/**
 * Ensure a file is in a supported format (PNG/JPG).
 * If not, converts it to PNG automatically.
 * Returns the original file if already supported, or a converted PNG.
 */
export async function ensureSupportedFormat(file: File): Promise<File> {
  if (!needsConversion(file)) return file;
  return convertToPng(file);
}
