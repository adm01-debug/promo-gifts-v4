const CLOUDFLARE_STREAM_ID_REGEX = /(?:^|\/)([a-f0-9]{32})(?:[/?#]|$)/i;

// Cloudflare Stream customer subdomain (accountHash, NOT accountId).
// Must match the value used by the DB functions (fn_*_link_video) and the VPS importer.
const CF_STREAM_SUBDOMAIN = 'customer-ksi0mrlcw6rwzezz.cloudflarestream.com';

export function extractCloudflareStreamId(url: string | null | undefined): string | null {
  if (!url) return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  if (/^[a-f0-9]{32}$/i.test(trimmed)) {
    return trimmed;
  }

  try {
    const pathname = new URL(trimmed).pathname;
    const match = CLOUDFLARE_STREAM_ID_REGEX.exec(pathname);
    return match?.[1] ?? null;
  } catch {
    const match = CLOUDFLARE_STREAM_ID_REGEX.exec(trimmed);
    return match?.[1] ?? null;
  }
}

interface CloudflareThumbnailOptions {
  time?: string;
  height?: number;
  width?: number;
  fit?: 'crop' | 'scale-down' | 'contain';
}

function appendThumbnailOptions(url: URL, options: CloudflareThumbnailOptions = {}) {
  if (options.time) url.searchParams.set('time', options.time);
  if (typeof options.height === 'number') url.searchParams.set('height', String(options.height));
  if (typeof options.width === 'number') url.searchParams.set('width', String(options.width));
  if (options.fit) url.searchParams.set('fit', options.fit);
}

export function getCloudflareThumbnailUrl(
  url: string | null | undefined,
  options: CloudflareThumbnailOptions = {},
) {
  const streamId = extractCloudflareStreamId(url);
  if (!streamId) return null;

  const thumbnailUrl = new URL(
    `https://${CF_STREAM_SUBDOMAIN}/${streamId}/thumbnails/thumbnail.jpg`,
  );
  appendThumbnailOptions(thumbnailUrl, options);

  return thumbnailUrl.toString();
}

interface CloudflareEmbedOptions {
  autoplay?: boolean;
  poster?: string | null;
}

function normalizeCloudflarePoster(
  url: string | null | undefined,
  poster: string | null | undefined,
) {
  const streamId = extractCloudflareStreamId(url);
  if (!streamId) return poster?.trim() || null;

  const derivedPoster = getCloudflareThumbnailUrl(streamId, { time: '1s', height: 720 });
  if (!poster) return derivedPoster;

  const posterId = extractCloudflareStreamId(poster);
  if (posterId === streamId) return derivedPoster;

  return poster.trim();
}

export function getCloudflareEmbedUrl(
  url: string | null | undefined,
  options: CloudflareEmbedOptions = {},
) {
  const streamId = extractCloudflareStreamId(url);
  if (!streamId) return null;

  const embedUrl = new URL(`https://iframe.cloudflarestream.com/${streamId}`);

  if (options.autoplay) {
    embedUrl.searchParams.set('autoplay', 'true');
  }

  const poster = normalizeCloudflarePoster(url, options.poster);
  if (poster) {
    embedUrl.searchParams.set('poster', poster);
  }

  return embedUrl.toString();
}

export function getCloudflareHlsUrl(url: string | null | undefined) {
  const streamId = extractCloudflareStreamId(url);
  if (!streamId) return null;
  return `https://${CF_STREAM_SUBDOMAIN}/${streamId}/manifest/video.m3u8`;
}

export function getCloudflareMp4Url(url: string | null | undefined) {
  const streamId = extractCloudflareStreamId(url);
  if (!streamId) return null;
  return `https://${CF_STREAM_SUBDOMAIN}/${streamId}/downloads/default.mp4`;
}
