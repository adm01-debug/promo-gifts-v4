/**
 * Shared types and constants for ProductVideoGallery
 */
import { Video, Play, Film, Star, Clapperboard, Mic, Sparkles } from 'lucide-react';

export interface ExternalVideo {
  id: string;
  product_id: string;
  url_stream: string | null;
  url_hls: string | null;
  url_thumbnail: string | null;
  url_original: string | null;
  source_youtube_id: string | null;
  cloudflare_video_id: string | null;
  cloudflare_status: string | null;
  video_type: string | null;
  display_order: number;
  is_primary: boolean;
  is_active: boolean;
  title: string | null;
  description: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
}

export interface VariantLink {
  id: string;
  video_id: string;
  variant_id: string;
  variant_name: string | null;
  variant_color_hex: string | null;
  supplier_code: string | null;
  product_id: string;
}

export interface VideoVariant {
  id: string;
  name: string;
  color_name: string | null;
  color_hex: string | null;
  supplier_code?: string;
}

export const VIDEO_TYPES = [
  { value: 'product_video', label: 'Produto', icon: Video, color: 'text-info' },
  { value: 'tutorial', label: 'Tutorial', icon: Play, color: 'text-success' },
  { value: 'unboxing', label: 'Unboxing', icon: Film, color: 'text-warning' },
  { value: 'review', label: 'Review', icon: Star, color: 'text-warning' },
  { value: 'demo', label: 'Demonstração', icon: Clapperboard, color: 'text-primary' },
  { value: 'recording', label: 'Gravação', icon: Mic, color: 'text-sky-500' },
  { value: 'lifestyle', label: 'Lifestyle', icon: Sparkles, color: 'text-primary' },
];

export const ACCEPTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/mpeg',
  'video/ogg',
];
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function extractThumbnailFromVideo(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.remove();
    };

    video.addEventListener('loadeddata', () => {
      video.currentTime = Math.min(1, video.duration || 0);
    });

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(video.videoWidth, 640);
        canvas.height = Math.round(canvas.width * (video.videoHeight / video.videoWidth));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          resolve(null);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            cleanup();
            resolve(blob);
          },
          'image/jpeg',
          0.8,
        );
      } catch {
        cleanup();
        resolve(null);
      }
    });

    video.addEventListener('error', () => {
      cleanup();
      resolve(null);
    });
    setTimeout(() => {
      cleanup();
      resolve(null);
    }, 10000);
  });
}

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const YOUTUBE_URL_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
];

/**
 * Parse YouTube URL or ID and return the video ID, or null if not valid.
 */
export function parseYouTubeId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (YOUTUBE_ID_RE.test(trimmed)) return trimmed;
  for (const p of YOUTUBE_URL_PATTERNS) {
    const m = trimmed.match(p);
    if (m) return m[1];
  }
  return null;
}
