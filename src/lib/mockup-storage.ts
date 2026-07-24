/**
 * Mockup Storage Utilities
 *
 * Handles uploading logos and mockup assets to the storage bucket
 * instead of storing base64 in the database.
 */

import { supabase } from '@/integrations/supabase/client';

import { logger } from '@/lib/logger';
/**
 * Upload a base64 image to the mockup-assets bucket.
 * Returns the public URL of the uploaded file.
 */
export async function uploadLogoToStorage(
  userId: string,
  base64Data: string,
  fileName?: string,
): Promise<string | null> {
  try {
    // Convert base64 to blob
    const base64Content = base64Data.split(',')[1];
    if (!base64Content) return null;

    const mimeMatch = /data:([^;]+);/.exec(base64Data);
    const mimeType = mimeMatch?.[1] || 'image/png';
    const extension = mimeType.split('/')[1] || 'png';

    // BUG-09 FIX: Uint8Array.from with a mapping callback is ~10× faster than a manual
    // for-loop iterating char by char over strings that can reach ~2.7 MB (2 MB logo → base64).
    const byteArray = Uint8Array.from(atob(base64Content), (c) => c.charCodeAt(0));
    const blob = new Blob([byteArray], { type: mimeType });

    // Generate unique file path: userId/logos/timestamp-name.ext
    const safeName = (fileName || 'logo').replace(/[^a-zA-Z0-9-_]/g, '_');
    const filePath = `${userId}/logos/${Date.now()}-${safeName}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('mockup-assets')
      .upload(filePath, blob, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      logger.error('[mockup-storage] Upload error:', uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage.from('mockup-assets').getPublicUrl(filePath);

    return urlData?.publicUrl || null;
  } catch (err) {
    logger.error('[mockup-storage] Exception during upload:', err);
    return null;
  }
}

/**
 * Download an image from a URL as a blob and trigger browser download.
 * Works for cross-origin URLs by fetching the image first.
 */
export async function downloadImageFromUrl(url: string, fileName: string): Promise<void> {
  try {
    const response = await fetch(url, { cache: 'no-store' });
    // BUG-07 FIX: without this check a 404/CORS error body was silently turned into a corrupt
    // blob, which then downloaded as a broken file with no user-visible error.
    if (!response.ok) {
      throw new Error(`Falha ao baixar imagem (${response.status})`);
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Cleanup blob URL after short delay
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    logger.error('[mockup-storage] Download error:', err);
    // Fallback: open in new tab
    window.open(url, '_blank');
  }
}

/**
 * Download an image URL wrapped inside a single-page PDF.
 */
export async function downloadImageAsPdfFromUrl(url: string, fileName: string): Promise<void> {
  try {
    const [{ jsPDF }, response] = await Promise.all([
      import('jspdf'),
      fetch(url, { cache: 'no-store' }),
    ]);

    if (!response.ok) {
      throw new Error(`Falha ao baixar imagem (${response.status})`);
    }

    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    const imageInfo = await getImageInfo(dataUrl);

    const orientation = imageInfo.width > imageInfo.height ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imageRatio = imageInfo.width / imageInfo.height;
    const pageRatio = pageWidth / pageHeight;

    let renderWidth = pageWidth;
    let renderHeight = pageHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (imageRatio > pageRatio) {
      renderHeight = pageWidth / imageRatio;
      offsetY = (pageHeight - renderHeight) / 2;
    } else {
      renderWidth = pageHeight * imageRatio;
      offsetX = (pageWidth - renderWidth) / 2;
    }

    const imageFormat = blob.type.includes('png') ? 'PNG' : 'JPEG';
    pdf.addImage(
      dataUrl,
      imageFormat,
      offsetX,
      offsetY,
      renderWidth,
      renderHeight,
      undefined,
      'FAST',
    );

    const pdfFileName = fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
    pdf.save(pdfFileName);
  } catch (err) {
    logger.error('[mockup-storage] PDF download error:', err);
    window.open(url, '_blank');
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Falha ao converter blob para data URL'));
    reader.readAsDataURL(blob);
  });
}

function getImageInfo(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Falha ao carregar imagem para PDF'));
    img.src = src;
  });
}
